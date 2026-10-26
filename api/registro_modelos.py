"""Treina e exporta TODOS os modelos para um registro desacoplado:
    modelos/<id>/modelo.joblib + modelos/<id>/meta.json  e  modelos/registro.json
Alvos: tempo_s (tempo de volta) e, se existirem no voltas.csv, vel_max_kmh e vel_media_kmh.
Entrada SEMPRE só setup + carro (+ volta_stint) -> sem vazamento: nada medido durante a volta entra no X.
Este mesmo código está colado na célula "Registro de modelos" do notebook."""
import json, os, re, shutil, time, datetime
import numpy as np, pandas as pd, joblib, sklearn
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import ExtraTreesRegressor, GradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import ElasticNet, Lasso, Ridge, LinearRegression
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ALVOS = {"tempo_s": ("tempo de volta", "s"), "vel_max_kmh": ("velocidade máxima da volta", "km/h"),
         "vel_media_kmh": ("velocidade média da volta", "km/h")}

def _pre(num):
    return ColumnTransformer([("carro", OneHotEncoder(drop="first", handle_unknown="ignore"), ["carro"]),
                              ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("esc", StandardScaler())]), num)])

def espaco(num, semente=42):
    e = {"baseline_media": ("Dummy (média)", DummyRegressor(), {}),
         "so_carro": ("Regressão linear só com o carro",
                      Pipeline([("pre", ColumnTransformer([("c", OneHotEncoder(drop="first", handle_unknown="ignore"), ["carro"])])), ("m", LinearRegression())]), {}),
         "lasso": ("Lasso", Pipeline([("pre", _pre(num)), ("m", Lasso(max_iter=20000))]), {"m__alpha": list(np.logspace(-4, 0, 8))}),
         "ridge": ("Ridge", Pipeline([("pre", _pre(num)), ("m", Ridge())]), {"m__alpha": list(np.logspace(-3, 3, 8))}),
         "elastic_net": ("ElasticNet", Pipeline([("pre", _pre(num)), ("m", ElasticNet(max_iter=20000))]),
                         {"m__alpha": list(np.logspace(-4, 0, 8)), "m__l1_ratio": [0.2, 0.5, 0.8]}),
         "random_forest": ("Random Forest", Pipeline([("pre", _pre(num)), ("m", RandomForestRegressor(n_estimators=200, random_state=semente, n_jobs=1))]),
                           {"m__max_features": [0.3, 0.6, 1.0], "m__min_samples_leaf": [2, 5, 10]}),
         "extra_trees": ("Extra Trees", Pipeline([("pre", _pre(num)), ("m", ExtraTreesRegressor(n_estimators=200, random_state=semente, n_jobs=1))]),
                         {"m__max_features": [0.3, 0.6, 1.0], "m__min_samples_leaf": [2, 5, 10]}),
         "gradient_boosting": ("Gradient Boosting", Pipeline([("pre", _pre(num)), ("m", GradientBoostingRegressor(n_estimators=200, random_state=semente))]),
                               {"m__max_depth": [2, 4], "m__learning_rate": [0.03, 0.1]})}
    try:
        from xgboost import XGBRegressor
        e["xgboost"] = ("XGBoost", Pipeline([("pre", _pre(num)), ("m", XGBRegressor(n_estimators=200, random_state=semente, n_jobs=1, verbosity=0))]),
                        {"m__max_depth": [2, 4], "m__learning_rate": [0.03, 0.1], "m__min_child_weight": [1, 5]})
    except ImportError: pass
    try:
        from lightgbm import LGBMRegressor
        e["lightgbm"] = ("LightGBM", Pipeline([("pre", _pre(num)), ("m", LGBMRegressor(n_estimators=200, random_state=semente, verbose=-1, n_jobs=1))]),
                         {"m__num_leaves": [7, 15], "m__learning_rate": [0.03, 0.1], "m__min_child_samples": [5, 20]})
    except ImportError: pass
    return e

def _limpo(v):
    if isinstance(v, (np.floating, float)): return float(v)
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (int, str, bool)) or v is None: return v
    return re.sub(r"\s+", " ", str(v))[:80]

def resumo_params(est):
    m = est.named_steps["m"] if hasattr(est, "named_steps") else est
    p = m.get_params()
    chaves = ["alpha", "l1_ratio", "n_estimators", "max_depth", "max_features", "min_samples_leaf", "learning_rate",
              "min_child_weight", "num_leaves", "min_child_samples", "strategy", "fit_intercept"]
    return {k: _limpo(p[k]) for k in chaves if k in p and p[k] is not None}

def metr(y, p):
    return {"mae": float(mean_absolute_error(y, p)), "rmse": float(root_mean_squared_error(y, p)), "r2": float(r2_score(y, p))}

def exportar(treino, teste, cv, params, saida, sintetico, extra=("volta_stint",), alvos=None, log=print, ruido=None):
    """treino/teste: DataFrames já limpos (com carro, setup e alvos). cv: lista de (idx_treino, idx_val) no treino."""
    pred = list(params) + ["carro"] + [c for c in extra if c in treino]
    num = list(params) + [c for c in extra if c in treino]
    alvos = [a for a in (alvos or ALVOS) if a in treino and treino[a].notna().sum() > 10 and treino[a].std() > 0]
    if os.path.isdir(saida): shutil.rmtree(saida)
    os.makedirs(saida)
    sc = {"mae": "neg_mean_absolute_error", "rmse": "neg_root_mean_squared_error", "r2": "r2"}
    reg = {"gerado_em": datetime.datetime.now().isoformat(timespec="seconds"), "sintetico": bool(sintetico),
           "sklearn_versao": sklearn.__version__, "ruido_piloto_s": None if ruido is None else float(ruido), "alvos": {}, "modelos": []}
    for alvo in alvos:
        ok_tr, ok_te = treino[alvo].notna().values, teste[alvo].notna().values
        Xtr, ytr = treino.loc[ok_tr, pred], treino.loc[ok_tr, alvo]
        Xte, yte = teste.loc[ok_te, pred], teste.loc[ok_te, alvo]
        pos = np.where(ok_tr)[0]; mapa = {p: i for i, p in enumerate(pos)}
        cv_a = [(np.array([mapa[i] for i in a if i in mapa]), np.array([mapa[i] for i in b if i in mapa])) for a, b in cv]
        ids = []
        for nome, (rotulo, pipe, grade) in espaco(num).items():
            t0 = time.time()
            est = GridSearchCV(pipe, grade, cv=cv_a, scoring="neg_mean_absolute_error", n_jobs=-1).fit(Xtr, ytr).best_estimator_ if grade else pipe.fit(Xtr, ytr)
            r = cross_validate(est, Xtr, ytr, cv=cv_a, scoring=sc)
            cvm = {k: float((-1 if k != "r2" else 1) * np.mean(r[f"test_{k}"])) for k in sc}
            cvm.update({k + "_dp": float(np.std(r[f"test_{k}"])) for k in sc})
            est.fit(Xtr, ytr)
            mid = f"{'tempo' if alvo == 'tempo_s' else alvo.replace('_kmh', '')}__{nome}"
            os.makedirs(os.path.join(saida, mid))
            joblib.dump(est, os.path.join(saida, mid, "modelo.joblib"))
            meta = {"id": mid, "nome": rotulo, "algoritmo": nome, "alvo": alvo, "alvo_desc": ALVOS[alvo][0], "unidade": ALVOS[alvo][1],
                    "hiperparametros": resumo_params(est), "metricas_cv": cvm,
                    "metricas_teste": metr(yte, est.predict(Xte)) if len(yte) else None,
                    "colunas": pred, "params_setup": list(params),
                    "faixas": {c: [float(treino[c].min()), float(treino[c].max())] for c in params},
                    "n_treino": int(len(ytr)), "n_teste": int(len(yte)), "sklearn_versao": sklearn.__version__,
                    "data": reg["gerado_em"], "sintetico": bool(sintetico), "treino_s": round(time.time() - t0, 2)}
            json.dump(meta, open(os.path.join(saida, mid, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            reg["modelos"].append({k: meta[k] for k in ["id", "nome", "algoritmo", "alvo", "unidade", "metricas_cv", "metricas_teste", "hiperparametros"]})
            ids.append((cvm["mae"], nome, mid)); log(f"{mid:32s} CV MAE {cvm['mae']:.3f} ± {cvm['mae_dp']:.3f}")
        cand = [x for x in ids if x[1] not in ("baseline_media", "so_carro")] or ids
        reg["alvos"][alvo] = {"descricao": ALVOS[alvo][0], "unidade": ALVOS[alvo][1], "padrao": min(cand)[2]}
    reg["padrao"] = reg["alvos"].get("tempo_s", {}).get("padrao")
    json.dump(reg, open(os.path.join(saida, "registro.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(f"Registro: {os.path.join(saida, 'registro.json')} | padrão tempo = {reg['padrao']}")
    return reg

if __name__ == "__main__":   # modo TESTE: dados sintéticos do demo
    from sklearn.model_selection import GroupKFold
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    df = pd.read_csv(os.path.join(raiz, "dashboard/data/demo/voltas.csv"))
    for c, ok in [("valida", 1), ("volta_saida", 0), ("entrou_box", 0), ("flashbacks", 0)]: df = df[df[c] == ok]
    df["tempo_s"] = df.tempo_volta_ms / 1000
    df["pneu_diant"] = df[["pneu_diant_esq_psi", "pneu_diant_dir_psi"]].mean(axis=1)
    df["pneu_tras"] = df[["pneu_tras_esq_psi", "pneu_tras_dir_psi"]].mean(axis=1)
    df["bloco"] = df.carro + "_" + df.sessao.astype(str) + "_" + df.setup_id
    df["volta_stint"] = df.groupby("bloco").cumcount() + 1
    PARAMS = ["asa_dianteira", "asa_traseira", "dif_com_acel", "dif_sem_acel", "cambagem_diant", "cambagem_tras",
              "convergencia_diant", "convergencia_tras", "suspensao_diant", "suspensao_tras", "barra_diant", "barra_tras",
              "altura_diant", "altura_tras", "freio_pressao", "freio_balanco", "pneu_diant", "pneu_tras"]
    mod = df[df.setup_id != "S10"].reset_index(drop=True)
    te = mod.sessao.isin([2, 4]) & (mod.setup_id != "S0")
    tr, tt = mod[~te].reset_index(drop=True), mod[te].reset_index(drop=True)
    cv = list(GroupKFold(5).split(tr, groups=tr.bloco))
    exportar(tr, tt, cv, PARAMS, os.environ.get("MODELOS_DIR", os.path.join(raiz, "modelos")), sintetico=True,
             ruido=json.load(open(os.path.join(raiz, "api/modelo/modelo_info_python.json"))).get("ruido_piloto_s"))
