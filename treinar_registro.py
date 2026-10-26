"""Retreina o registro REAL do estudo (F1 23 · Mônaco) a partir de landing/data/voltas.csv.

Reproduz, com dados reais, o pipeline do modelagem_python_colab.ipynb:
  cel. 8  leitura + escopo Ferrari/Alfa            cel. 16 PARAMS (18 colunas de setup)
  cel. 10 limpeza (valida/pista, 1,07x mediana)     cel. 24 split por sessao + GroupKFold
  cel. 14 ruido do piloto (S0 inicio x fim)         cel. 41 exportar() -> modelos/
  cel. 35 ranking de todos os setups (S0-S10)       cel. 39/30 importancia por permutacao

Saida:
  api/modelos/registro.json + modelos/<id>/{modelo.joblib,meta.json}   (30 modelos, sintetico:false)
  modelos/... (copia sincronizada da raiz)
  landing/data/registro.json  (mesmo registro + notas por alvo)
  landing/data/resultados.json (melhor modelo, ruido, comparacao, importancia %, ranking, dataset)

Uso:  api/.venv/Scripts/python.exe treinar_registro.py
"""
import importlib.util
import json
import os
import shutil

import numpy as np
import pandas as pd
from scipy import stats

AQUI = os.path.dirname(os.path.abspath(__file__))
F_VOLTAS = os.path.join(AQUI, "landing", "data", "voltas.csv")
F_AMOSTRAS = os.path.join(AQUI, "amostras.csv")
SAIDA_API = os.path.join(AQUI, "api", "modelos")
SAIDA_RAIZ = os.path.join(AQUI, "modelos")
SAIDA_LANDING = os.path.join(AQUI, "landing", "data")

SETUPS = [f"S{i}" for i in range(11)]
SEMENTE = 42

_spec = importlib.util.spec_from_file_location("registro_modelos", os.path.join(AQUI, "api", "registro_modelos.py"))
regmod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(regmod)


def limpar(bruto):
    df = bruto[bruto["carro"].isin(["ferrari", "alfaromeo"])].copy()
    for col, ok in [("valida", 1), ("pista_id", 5)]:
        if col in df:
            df = df[df[col] == ok]
    df["tempo_s"] = df["tempo_volta_ms"] / 1000
    df["setup_id"] = df["setup_id"].astype(str)
    df = df[df["setup_id"].isin(SETUPS) & (df["tempo_s"] > 0)]
    med = df.groupby(["carro", "setup_id"])["tempo_s"].transform("median")
    df = df[df["tempo_s"] <= 1.07 * med].copy()
    df["session_uid"] = df["session_uid"].astype(str)
    ordem = "data_hora" if "data_hora" in df else "volta"
    df = df.sort_values(["sessao", ordem]).reset_index(drop=True)

    fase = pd.Series("", index=df.index, dtype=object)
    for _, idx in df.groupby("sessao", sort=False).groups.items():
        pos = df.loc[idx]
        valores = pos["setup_id"].values
        nao_s0 = np.where(valores != "S0")[0]
        primeira = nao_s0[0] if len(nao_s0) else len(pos)
        p = np.arange(len(pos))
        eh_s0 = valores == "S0"
        fase.loc[idx] = np.where(eh_s0, np.where(p < primeira, "inicio", "fim"), "")
    df["fase_s0"] = fase
    df["bloco"] = df["carro"] + "_" + df["sessao"].astype(str) + "_" + df["setup_id"] + "_" + df["fase_s0"]
    df["volta_stint"] = df.groupby("bloco").cumcount() + 1
    for lado, cols in [("pneu_diant", ["pneu_diant_esq_psi", "pneu_diant_dir_psi"]),
                       ("pneu_tras", ["pneu_tras_esq_psi", "pneu_tras_dir_psi"])]:
        c = [x for x in cols if x in df]
        if c:
            df[lado] = df[c].mean(axis=1)
    return df


def ruido_piloto(df):
    drift = (df[df.setup_id == "S0"].groupby(["carro", "sessao", "fase_s0"])["tempo_s"].mean()
             .unstack("fase_s0").reset_index())
    if "inicio" in drift and "fim" in drift:
        drift["drift_s"] = drift["fim"] - drift["inicio"]
        r = float(drift["drift_s"].abs().mean())
        if np.isfinite(r):
            return r
    return float(df.loc[df.setup_id == "S0", "tempo_s"].std())


def dividir(df, params):
    modelagem = df[df.setup_id != "S10"].reset_index(drop=True)
    s10 = df[df.setup_id == "S10"].reset_index(drop=True)
    ses_exp = modelagem[modelagem.setup_id != "S0"][["carro", "sessao"]].drop_duplicates()
    if (ses_exp.groupby("carro").size() >= 2).all():
        ses_teste = ses_exp.groupby("carro")["sessao"].max().tolist()
        tipo, mascara = f"grupo: sessoes {ses_teste} no teste", modelagem.sessao.isin(ses_teste)
    else:
        from sklearn.model_selection import train_test_split
        _, idx = train_test_split(modelagem.index, test_size=.25, random_state=SEMENTE,
                                  stratify=modelagem.carro + "_" + modelagem.setup_id)
        tipo, mascara = "fallback 75/25", modelagem.index.isin(idx)
    treino = modelagem[~mascara].reset_index(drop=True)
    teste = modelagem[mascara].reset_index(drop=True)

    from sklearn.model_selection import GroupKFold
    n_folds = min(5, treino.bloco.nunique())
    mapa_fold, k = {}, 0
    for _, val in GroupKFold(n_splits=n_folds).split(treino, groups=treino.bloco):
        for b in treino.bloco.iloc[val].unique():
            mapa_fold[b] = k
        k += 1
    f = treino.bloco.map(mapa_fold).values
    cv = [(np.where(f != i)[0], np.where(f == i)[0]) for i in range(n_folds)]
    return treino, teste, s10, cv, tipo, ses_teste


def contar_amostras():
    if not os.path.exists(F_AMOSTRAS):
        return None
    n = 0
    with open(F_AMOSTRAS, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 22), b""):
            n += bloco.count(b"\n")
    return max(n - 1, 0)


ROTULOS = {
    "volta_stint": "idade do pneu (volta no stint)", "carro": "carro",
    "dif_sem_acel": "diferencial sem aceleração", "dif_com_acel": "diferencial com aceleração",
    "asa_dianteira": "asa dianteira", "asa_traseira": "asa traseira",
    "cambagem_diant": "cambagem dianteira", "cambagem_tras": "cambagem traseira",
    "convergencia_diant": "convergência dianteira", "convergencia_tras": "convergência traseira",
    "suspensao_diant": "suspensão dianteira", "suspensao_tras": "suspensão traseira",
    "barra_diant": "barra dianteira", "barra_tras": "barra traseira",
    "altura_diant": "altura do piso dianteira", "altura_tras": "altura do piso traseira",
    "freio_pressao": "pressão do freio", "freio_balanco": "balanço de freio",
    "pneu_diant": "pressão do pneu dianteiro", "pneu_tras": "pressão do pneu traseiro",
}


def nota_alvo(alvo, reg):
    L = [m for m in reg["modelos"] if m["alvo"] == alvo]
    base = next((m for m in L if m["algoritmo"] == "baseline_media"), None)
    melhor = min((m for m in L if m["algoritmo"] not in ("baseline_media", "so_carro")),
                 key=lambda m: m["metricas_cv"]["mae"])
    if not base:
        return ""
    g = (base["metricas_cv"]["mae"] - melhor["metricas_cv"]["mae"]) / base["metricas_cv"]["mae"] * 100
    if alvo == "tempo_s":
        return (f"{melhor['nome']} reduz o MAE em {g:.0f}% em relação à média pura (baseline) "
                "na validação cruzada agrupada por sessão.")
    if alvo == "vel_max_kmh":
        return (f"Melhor modelo {melhor['nome']} melhora apenas {g:.0f}% sobre a média: "
                "a velocidade máxima depende pouco do setup (pista e reta mandam).")
    return (f"Melhor modelo {melhor['nome']} reduz o MAE em {g:.0f}% sobre a média: "
            "a velocidade média da volta sim responde ao setup.")


def main():
    print("== lendo voltas.csv ==")
    bruto = pd.read_csv(F_VOLTAS, dtype={"session_uid": str})
    n_total = len(bruto)
    df = limpar(bruto)
    print(f"voltas validas (dataset): {n_total} | depois da limpeza: {len(df)} "
          f"(Ferrari {int((df.carro=='ferrari').sum())}, Alfa {int((df.carro=='alfaromeo').sum())})")

    PARAMS = [c for c in ["asa_dianteira", "asa_traseira", "dif_com_acel", "dif_sem_acel", "cambagem_diant",
                          "cambagem_tras", "convergencia_diant", "convergencia_tras", "suspensao_diant",
                          "suspensao_tras", "barra_diant", "barra_tras", "altura_diant", "altura_tras",
                          "freio_pressao", "freio_balanco", "pneu_diant", "pneu_tras"] if c in df]
    RUIDO = ruido_piloto(df)
    treino, teste, s10, CV, tipo, ses_teste = dividir(df, PARAMS)
    print(f"ruido do piloto: {RUIDO:.3f} s | split: {tipo} | treino {len(treino)} / teste {len(teste)} / S10 {len(s10)}"
          f" | dobras {len(CV)}")
    print("== treinando 30 modelos (3 alvos x 10 algoritmos) ==")
    reg = regmod.exportar(treino, teste, CV, PARAMS, SAIDA_API, sintetico=False, ruido=RUIDO)

    for alvo in reg["alvos"]:
        reg["alvos"][alvo]["nota"] = nota_alvo(alvo, reg)
    melhor_id = reg["padrao"]
    melhor_algoritmo = melhor_id.split("__", 1)[1]
    print(f"melhor de tempo: {melhor_id} | padroes: "
          + ", ".join(f"{a}={v['padrao']}" for a, v in reg["alvos"].items()))

    # --- importancia por permutacao (célula 30) ---
    # O teste guarda só S7-S9 (a sessão retida não rodou os outros setups), onde 15 dos 18
    # ajustes são constantes -> a permutação lá daria 0. Usamos o conjunto de modelagem S0-S9.
    import joblib
    from sklearn.inspection import permutation_importance
    est = joblib.load(os.path.join(SAIDA_API, melhor_id, "modelo.joblib"))
    meta = json.load(open(os.path.join(SAIDA_API, melhor_id, "meta.json"), encoding="utf-8"))
    cols = meta["colunas"]
    mod_imp = pd.concat([treino, teste]).reset_index(drop=True)
    pi = permutation_importance(est, mod_imp[cols], mod_imp["tempo_s"], scoring="neg_mean_absolute_error",
                                n_repeats=30, random_state=SEMENTE)
    imp = sorted([{"variavel": v, "rotulo": ROTULOS.get(v, v.replace("_", " ")),
                   "aumento_mae_s": float(x)} for v, x in zip(cols, pi.importances_mean)],
                 key=lambda d: -d["aumento_mae_s"])
    positivos = max(sum(max(d["aumento_mae_s"], 0) for d in imp), 1e-9)
    for d in imp:
        d["percentual"] = round(max(d["aumento_mae_s"], 0) / positivos * 100, 1)
    print("importancia:", ", ".join(f"{d['variavel']} {d['percentual']:.1f}%" for d in imp[:5]))

    # --- comparacao de modelos (tempo) + placebo ---
    from sklearn.model_selection import cross_validate
    sc = {"mae": "neg_mean_absolute_error", "rmse": "neg_root_mean_squared_error", "r2": "r2"}
    comp = []
    for m in reg["modelos"]:
        if m["alvo"] != "tempo_s":
            continue
        comp.append({"modelo": m["algoritmo"],
                     "cv": {k: m["metricas_cv"][k] for k in ("mae", "rmse", "r2")},
                     "cv_dp": m["metricas_cv"].get("mae_dp"),
                     "teste": m["metricas_teste"]})
    rng = np.random.default_rng(SEMENTE)
    Xp = treino[cols].copy()
    Xp[PARAMS] = treino[PARAMS].values[rng.permutation(len(treino))]
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder, StandardScaler
    from sklearn.impute import SimpleImputer
    pre = lambda: ColumnTransformer([
        ("carro", OneHotEncoder(drop="first", handle_unknown="ignore"), ["carro"]),
        ("num", Pipeline([("imp", SimpleImputer(strategy="median")),
                          ("esc", StandardScaler())]), PARAMS + ["volta_stint"])])
    plac = Pipeline([("pre", pre()), ("m", RandomForestRegressor(
        n_estimators=200, min_samples_leaf=5, random_state=SEMENTE, n_jobs=1))])
    plac_cv = cross_validate(plac, Xp, treino["tempo_s"], cv=CV, scoring=sc, n_jobs=-1)
    comp.append({"modelo": "placebo_setup_embaralhado",
                 "cv": {k: float((-1 if k != "r2" else 1) * np.mean(plac_cv[f"test_{k}"])) for k in sc},
                 "cv_dp": float(np.std(plac_cv["test_mae"])), "teste": None})

    # --- ranking de todos os setups com o modelo vencedor (célula 35) ---
    from sklearn.base import clone
    from sklearn.model_selection import cross_val_predict
    oof = cross_val_predict(clone(est), treino[cols], treino["tempo_s"], cv=CV, n_jobs=-1)
    prev = pd.concat([
        treino.assign(previsto=oof, origem="CV (fora da dobra)"),
        teste.assign(previsto=est.predict(teste[cols]), origem="teste"),
        s10.assign(previsto=est.predict(s10[cols]), origem="S10 (nunca visto)")])
    p_setup = prev.groupby(["carro", "setup_id"]).agg(
        previsto_medio=("previsto", "mean"),
        origem_previsao=("origem", lambda s: " + ".join(sorted(set(s))))).reset_index()
    no_treino = set(map(tuple, treino[["carro", "setup_id"]].drop_duplicates().values))
    linhas = []
    for (carro, st), g in df.groupby(["carro", "setup_id"]):
        s0 = df[(df.carro == carro) & (df.setup_id == "S0")]["tempo_s"]
        p = np.nan if st == "S0" or len(g) < 2 else stats.ttest_ind(g.tempo_s, s0, equal_var=False).pvalue
        dif = g.tempo_s.mean() - s0.mean()
        ver = ("referência" if st == "S0"
               else "mais rápido" if dif < -RUIDO and np.isfinite(p) and p < .05
               else "mais lento" if dif > RUIDO and np.isfinite(p) and p < .05
               else "empate (dentro do ruído)")
        linhas.append(dict(carro=carro, setup_id=st, n=int(len(g)), media_real=float(g.tempo_s.mean()),
                           dp=float(g.tempo_s.std()), dif_vs_s0=float(dif), p_welch=(None if not np.isfinite(p) else float(p)),
                           veredito=ver, no_treino=(carro, st) in no_treino))
    ranking = (pd.DataFrame(linhas).merge(p_setup, on=["carro", "setup_id"], how="left")
                 .sort_values(["carro", "media_real"]))
    ranking["posicao"] = ranking.groupby("carro").cumcount() + 1
    ranking["erro_previsao"] = ranking["previsto_medio"] - ranking["media_real"]
    ranking_out = [{k: (None if pd.isna(v) else (v.item() if hasattr(v, "item") else v))
                    for k, v in r.items()} for r in ranking.to_dict("records")]

    # --- amostras / dataset ---
    amostras_total = contar_amostras()
    melhor_volta = float(df["tempo_s"].min())
    vmax = float(df["vel_max_kmh"].max()) if "vel_max_kmh" in df else None
    dataset = {"voltas_dataset": int(n_total), "voltas_modeladas": int(len(df)),
               "amostras_telemetria": amostras_total, "melhor_volta_s": round(melhor_volta, 3),
               "melhor_volta_fonte": df.loc[df["tempo_s"].idxmin(), ["carro", "setup_id"]].to_dict(),
               "vmax_kmh": None if vmax is None else round(vmax, 1),
               "setups": SETUPS, "carros": sorted(df["carro"].unique().tolist()),
               "split": f"{tipo} (treino {len(treino)} / teste {len(teste)} / S10 {len(s10)})"}

    res = {"exemplo": False, "aviso": "", "melhor_modelo": melhor_algoritmo,
           "melhor_modelo_id": melhor_id, "ruido_piloto_s": RUIDO, "comparacao_modelos": comp,
           "importancia": imp,
           "importancia_metodo": ("Permutação de cada variável no conjunto de modelagem S0–S9 "
                                  f"({len(mod_imp)} linhas) com o modelo vencedor ({melhor_algoritmo}); "
                                  "MAE a quantidade que cada permutação piora o erro. O teste guarda só "
                                  "S7–S9, onde a maioria dos ajustes não varia, por isso a medida é S0–S9."),
           "ranking": ranking_out, "dataset": dataset,
           "amostras_total": amostras_total}
    os.makedirs(SAIDA_LANDING, exist_ok=True)
    json.dump(res, open(os.path.join(SAIDA_LANDING, "resultados.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    json.dump(reg, open(os.path.join(SAIDA_LANDING, "registro.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump(reg, open(os.path.join(SAIDA_API, "registro.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if os.path.abspath(SAIDA_RAIZ) != os.path.abspath(SAIDA_API):
        if os.path.isdir(SAIDA_RAIZ):
            shutil.rmtree(SAIDA_RAIZ)
        shutil.copytree(SAIDA_API, SAIDA_RAIZ)

    print("== resumo ==")
    for m in sorted([m for m in reg["modelos"] if m["alvo"] == "tempo_s"],
                    key=lambda m: m["metricas_cv"]["mae"]):
        print(f"  {m['algoritmo']:20s} CV {m['metricas_cv']['mae']:.3f} ± {m['metricas_cv']['mae_dp']:.3f}"
              f" | teste {m['metricas_teste']['mae']:.3f}")
    print(f"  ruido {RUIDO:.3f}s | melhor volta {melhor_volta:.3f}s | amostras {amostras_total}")
    print("== escrito ==")
    for p in [SAIDA_API, SAIDA_RAIZ, os.path.join(SAIDA_LANDING, "registro.json"),
              os.path.join(SAIDA_LANDING, "resultados.json")]:
        print("  ", p)


if __name__ == "__main__":
    main()
