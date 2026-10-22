"""Gera um modelo de TESTE (SINTÉTICO) a partir de dashboard/data/demo/voltas.csv,
no mesmo formato que o notebook modelagem_python_colab.ipynb salva.
NÃO é o resultado do estudo: serve só para testar a API e a landing.
Também exporta landing/data/exemplo/resultados.json (rotulado como exemplo)."""
import json, os, sys
import numpy as np, pandas as pd, joblib
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge, Lasso, LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.inspection import permutation_importance

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
df = pd.read_csv(os.path.join(RAIZ, "dashboard/data/demo/voltas.csv"))
for c, ok in [("valida", 1), ("volta_saida", 0), ("entrou_box", 0), ("flashbacks", 0)]:
    df = df[df[c] == ok]
df["tempo_s"] = df.tempo_volta_ms / 1000
df["pneu_diant"] = df[["pneu_diant_esq_psi", "pneu_diant_dir_psi"]].mean(axis=1)
df["pneu_tras"] = df[["pneu_tras_esq_psi", "pneu_tras_dir_psi"]].mean(axis=1)
df["bloco"] = df.carro + "_" + df.sessao.astype(str) + "_" + df.setup_id
df["volta_stint"] = df.groupby("bloco").cumcount() + 1
PARAMS = ["asa_dianteira", "asa_traseira", "dif_com_acel", "dif_sem_acel", "cambagem_diant", "cambagem_tras",
          "convergencia_diant", "convergencia_tras", "suspensao_diant", "suspensao_tras", "barra_diant",
          "barra_tras", "altura_diant", "altura_tras", "freio_pressao", "freio_balanco", "pneu_diant", "pneu_tras"]
PRED = PARAMS + ["carro", "volta_stint"]
mod = df[df.setup_id != "S10"].reset_index(drop=True)
teste_m = mod.sessao.isin([2, 4]) & (mod.setup_id != "S0")
tr, te = mod[~teste_m], mod[teste_m]
def pre(): return ColumnTransformer([("carro", OneHotEncoder(drop="first", handle_unknown="ignore"), ["carro"]),
                                     ("num", Pipeline([("imp", SimpleImputer(strategy="median")), ("esc", StandardScaler())]), PARAMS + ["volta_stint"])])
modelos = {"baseline_media": DummyRegressor(),
           "so_carro": Pipeline([("pre", ColumnTransformer([("c", OneHotEncoder(drop="first"), ["carro"])])), ("m", LinearRegression())]),
           "lasso": Pipeline([("pre", pre()), ("m", Lasso(alpha=0.01, max_iter=20000))]),
           "ridge": Pipeline([("pre", pre()), ("m", Ridge(alpha=1.0))]),
           "random_forest": Pipeline([("pre", pre()), ("m", RandomForestRegressor(300, min_samples_leaf=2, random_state=42, n_jobs=1))])}
cv = list(GroupKFold(5).split(tr, groups=tr.bloco))
def metr(y, p): return {"mae": float(mean_absolute_error(y, p)), "rmse": float(root_mean_squared_error(y, p)), "r2": float(r2_score(y, p))}
comp = []
for n, m in modelos.items():
    oof = cross_val_predict(m, tr[PRED], tr.tempo_s, cv=cv)
    m.fit(tr[PRED], tr.tempo_s)
    comp.append({"modelo": n, "cv": metr(tr.tempo_s, oof), "teste": metr(te.tempo_s, m.predict(te[PRED]))})
cand = [c for c in comp if c["modelo"] not in ("baseline_media", "so_carro")]
MELHOR = min(cand, key=lambda c: c["cv"]["mae"])["modelo"]
final = modelos[MELHOR]
s0 = mod[mod.setup_id == "S0"]
RUIDO = float(abs(s0.groupby("sessao").tempo_s.mean().diff().dropna()).mean() or 0.1)
pi = permutation_importance(final, te[PRED], te.tempo_s, scoring="neg_mean_absolute_error", n_repeats=10, random_state=42)
imp = sorted([{"variavel": v, "aumento_mae_s": float(x)} for v, x in zip(PRED, pi.importances_mean)], key=lambda d: -d["aumento_mae_s"])
rank = []
for (c, s), g in df.groupby(["carro", "setup_id"]):
    base = df[(df.carro == c) & (df.setup_id == "S0")].tempo_s.mean()
    rank.append({"carro": c, "setup_id": s, "n": int(len(g)), "media_real": float(g.tempo_s.mean()),
                 "dif_vs_s0": float(g.tempo_s.mean() - base), "previsto_medio": float(final.predict(g[PRED]).mean())})
os.makedirs(os.path.join(AQUI, "modelo"), exist_ok=True)
joblib.dump(final, os.path.join(AQUI, "modelo", "modelo_final_python.joblib"))
info = {"modelo": MELHOR, "preditores": PRED, "params": PARAMS, "ruido_piloto_s": RUIDO,
        "faixas": {c: [float(mod[c].min()), float(mod[c].max())] for c in PARAMS},
        "metricas_teste": next(c["teste"] for c in comp if c["modelo"] == MELHOR),
        "divisao": "grupo: sessões 2 e 4 (exceto S0) no teste", "sintetico": True,
        "aviso": "MODELO DE TESTE treinado com dados SINTÉTICOS do demo. Substitua pelo do notebook."}
json.dump(info, open(os.path.join(AQUI, "modelo", "modelo_info_python.json"), "w"), ensure_ascii=False, indent=1)
res = {"exemplo": True, "aviso": "DADOS DE EXEMPLO (sintéticos) — não são resultados do estudo.",
       "melhor_modelo": MELHOR, "ruido_piloto_s": RUIDO, "comparacao_modelos": comp, "importancia": imp, "ranking": rank}
out = os.path.join(RAIZ, "landing/data/exemplo/resultados.json")
json.dump(res, open(out, "w"), ensure_ascii=False, indent=1)
print("melhor:", MELHOR, info["metricas_teste"], "| salvo modelo/ e", out)
