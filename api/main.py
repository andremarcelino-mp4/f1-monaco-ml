"""API do Engenheiro de Corrida Virtual (F1 23 · Mônaco) — v2: vários modelos.
Lê o registro modelos/registro.json (+ modelos/<id>/modelo.joblib e meta.json) gerado pelo notebook.
Variáveis de ambiente: MODELOS_DIR (pasta do registro) e MODELO_PADRAO (id do modelo de tempo padrão).
Compatibilidade: se não houver registro, cai no modelo único antigo (MODELO_DIR/modelo_final_python.joblib)."""
import json, os, time
from typing import List, Optional, Union
import joblib, pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

AQUI = os.path.dirname(os.path.abspath(__file__))
S0 = dict(asa_dianteira=50, asa_traseira=50, dif_com_acel=50, dif_sem_acel=53, cambagem_diant=-2.5, cambagem_tras=-1.0,
          convergencia_diant=0.05, convergencia_tras=0.25, suspensao_diant=41, suspensao_tras=13, barra_diant=7,
          barra_tras=5, altura_diant=32, altura_tras=36, freio_pressao=100, freio_balanco=53, pneu_diant=22.5, pneu_tras=20.0)
S10 = dict(S0, asa_traseira=47, dif_com_acel=50, dif_sem_acel=50, convergencia_diant=0.08, convergencia_tras=0.20,
           suspensao_diant=12, suspensao_tras=7, barra_diant=5, barra_tras=2, altura_diant=36, altura_tras=42,
           freio_balanco=54, pneu_diant=22.2, pneu_tras=20.0)
CARROS = {"ferrari", "alfaromeo"}

def _achar_registro():
    for p in [os.environ.get("MODELOS_DIR"), os.path.join(AQUI, "modelos"), os.path.join(AQUI, "..", "modelos")]:
        if p and os.path.isfile(os.path.join(p, "registro.json")):
            return os.path.abspath(p)
    return None

MODELOS, REGISTRO, PADRAO, PADRAO_ALVO = {}, None, None, {}
DIR = _achar_registro()
if DIR:
    REGISTRO = json.load(open(os.path.join(DIR, "registro.json"), encoding="utf-8"))
    for m in REGISTRO["modelos"]:
        meta = json.load(open(os.path.join(DIR, m["id"], "meta.json"), encoding="utf-8"))
        MODELOS[m["id"]] = (joblib.load(os.path.join(DIR, m["id"], "modelo.joblib")), meta)
    PADRAO_ALVO = {a: v["padrao"] for a, v in REGISTRO.get("alvos", {}).items()}
    PADRAO = os.environ.get("MODELO_PADRAO") or REGISTRO.get("padrao")
    if PADRAO not in MODELOS or MODELOS[PADRAO][1]["alvo"] != "tempo_s":
        raise RuntimeError(f"MODELO_PADRAO={PADRAO!r} não existe ou não é de tempo. Opções: "
                           f"{[k for k, v in MODELOS.items() if v[1]['alvo'] == 'tempo_s']}")
    PADRAO_ALVO["tempo_s"] = PADRAO
    INFO = {"modelo": MODELOS[PADRAO][1]["algoritmo"], "sintetico": REGISTRO.get("sintetico", False),
            "preditores": MODELOS[PADRAO][1]["colunas"], "faixas": MODELOS[PADRAO][1].get("faixas", {}),
            "ruido_piloto_s": REGISTRO.get("ruido_piloto_s"), "registro": True}
else:  # modo antigo (1 modelo)
    PASTA = os.environ.get("MODELO_DIR", os.path.join(AQUI, "modelo"))
    INFO = json.load(open(os.path.join(PASTA, "modelo_info_python.json"), encoding="utf-8"))
    PADRAO = "legado"
    MODELOS[PADRAO] = (joblib.load(os.path.join(PASTA, "modelo_final_python.joblib")),
                       {"id": PADRAO, "nome": INFO.get("modelo"), "algoritmo": INFO.get("modelo"), "alvo": "tempo_s",
                        "unidade": "s", "colunas": INFO["preditores"], "faixas": INFO.get("faixas", {}),
                        "metricas_cv": INFO.get("metricas_cv"), "metricas_teste": INFO.get("metricas_teste"),
                        "hiperparametros": INFO.get("hiperparametros", {}), "sintetico": INFO.get("sintetico", False)})
    PADRAO_ALVO = {"tempo_s": PADRAO}

app = FastAPI(title="Engenheiro de Corrida Virtual – API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class Entrada(BaseModel):
    carro: str = Field(..., examples=["ferrari"])
    setup: dict = Field(default_factory=dict, description="ajustes; o que faltar vem do S0")
    volta_stint: Optional[int] = 3
    modelos: Optional[Union[List[str], str]] = Field(None, description='lista de ids de modelos de tempo ou "todos"; vazio = só o padrão')

def _resumo(meta):
    return {k: meta.get(k) for k in ["id", "nome", "algoritmo", "alvo", "unidade", "hiperparametros", "metricas_cv",
                                     "metricas_teste", "n_treino", "n_teste", "sklearn_versao", "data", "sintetico"]}

@app.get("/")
def raiz():
    return {"ok": True, "docs": "/docs", "rotas": ["/health", "/info", "/modelos", "/prever"]}

@app.get("/health")
def health():
    return {"status": "ok", "modelo": INFO.get("modelo"), "modelo_padrao": PADRAO, "n_modelos": len(MODELOS),
            "sintetico": INFO.get("sintetico", False)}

@app.get("/info")
def info():
    return {**INFO, "modelo_padrao": PADRAO, "setup_base_S0": S0, "setup_S10": S10, "carros": sorted(CARROS)}

@app.get("/modelos")
def modelos():
    return {"padrao": PADRAO, "padrao_por_alvo": PADRAO_ALVO, "sintetico": INFO.get("sintetico", False),
            "alvos": (REGISTRO or {}).get("alvos", {"tempo_s": {"descricao": "tempo de volta", "unidade": "s"}}),
            "modelos": [_resumo(m) for _, m in MODELOS.values()]}

def _prev(mid, linha, carro, vs):
    est, meta = MODELOS[mid]
    t0 = time.perf_counter()
    v = float(est.predict(pd.DataFrame([linha])[meta["colunas"]])[0])
    lat = (time.perf_counter() - t0) * 1000
    base = float(est.predict(pd.DataFrame([{**S0, "carro": carro, "volta_stint": vs}])[meta["colunas"]])[0])
    return v, base, lat

def _par_vel(alvo, algoritmo):
    mid = f"{alvo.replace('_kmh', '')}__{algoritmo}"
    return mid if mid in MODELOS else PADRAO_ALVO.get(alvo)

@app.post("/prever")
def prever(e: Entrada):
    carro = e.carro.lower().replace(" ", "").replace("_", "")
    if carro not in CARROS:
        raise HTTPException(422, f"carro deve ser um de {sorted(CARROS)}")
    desconhecidos = [k for k in e.setup if k not in S0]
    if desconhecidos:
        raise HTTPException(422, f"ajustes desconhecidos: {desconhecidos}")
    try:
        vs = e.volta_stint or 3
        linha = {**S0, **{k: float(v) for k, v in e.setup.items()}, "carro": carro, "volta_stint": vs}
    except (TypeError, ValueError):
        raise HTTPException(422, "valores de setup devem ser numéricos")
    de_tempo = [k for k, (_, m) in MODELOS.items() if m["alvo"] == "tempo_s"]
    if e.modelos in (None, [], ""):
        pedidos = [PADRAO]
    elif e.modelos == "todos" or e.modelos == ["todos"]:
        pedidos = de_tempo
    elif isinstance(e.modelos, str):
        raise HTTPException(422, 'modelos deve ser uma lista de ids ou "todos"')
    else:
        pedidos = list(dict.fromkeys(e.modelos))
        ruins = [m for m in pedidos if m not in de_tempo]
        if ruins:
            raise HTTPException(422, f"modelos desconhecidos (ou que não preveem tempo): {ruins}. Opções: {de_tempo}")
    fora = [{"ajuste": c, "valor": linha[c], "faixa_treino": f} for c, f in MODELOS[PADRAO][1].get("faixas", {}).items()
            if c in linha and not (f[0] <= linha[c] <= f[1])]
    ruido = INFO.get("ruido_piloto_s")
    res = []
    for mid in pedidos:
        meta = MODELOS[mid][1]
        t, base, lat = _prev(mid, linha, carro, vs)
        dif = t - base
        mae = ((meta.get("metricas_cv") or {}).get("mae"))
        tol = ruido if ruido else mae
        m, s = divmod(t, 60)
        r = {"id": mid, "nome": meta.get("nome"), "algoritmo": meta.get("algoritmo"), "padrao": mid == PADRAO,
             "tempo_previsto_s": round(t, 3), "tempo_formatado": f"{int(m)}:{s:06.3f}", "dif_vs_S0_s": round(dif, 3),
             "mae_cv_s": round(mae, 3) if mae is not None else None,
             "leitura": ("dentro do erro/ruído" if tol and abs(dif) <= tol else ("mais rápido que o S0" if dif < 0 else "mais lento que o S0")),
             "latencia_ms": round(lat, 2)}
        for alvo, chave in [("vel_max_kmh", "velocidade_max_prevista_kmh"), ("vel_media_kmh", "velocidade_media_prevista_kmh")]:
            vid = _par_vel(alvo, meta.get("algoritmo"))
            if vid:
                v, vb, vl = _prev(vid, linha, carro, vs)
                r[chave], r[chave.replace("prevista_kmh", "dif_vs_S0_kmh")] = round(v, 1), round(v - vb, 2)
                r[chave.replace("_kmh", "_modelo")] = vid
                r["latencia_ms"] = round(r["latencia_ms"] + vl, 2)
        res.append(r)
    p = next((r for r in res if r["padrao"]), res[0])
    # campos de topo = mesmo formato da v1 (compatível com o site antigo)
    return {"carro": carro, "tempo_previsto_s": p["tempo_previsto_s"], "tempo_formatado": p["tempo_formatado"],
            "dif_vs_S0_s": p["dif_vs_S0_s"], "ruido_piloto_s": round(ruido, 3) if ruido else None, "leitura": p["leitura"],
            "extrapolacao": fora, "modelo": MODELOS[p["id"]][1].get("algoritmo"), "modelo_id": p["id"],
            "velocidade_max_prevista_kmh": p.get("velocidade_max_prevista_kmh"),
            "velocidade_media_prevista_kmh": p.get("velocidade_media_prevista_kmh"),
            "sintetico": INFO.get("sintetico", False), "resultados": res}
