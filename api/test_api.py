from fastapi.testclient import TestClient
from main import app, S10
c = TestClient(app)

def test_health():
    r = c.get("/health"); assert r.status_code == 200 and r.json()["status"] == "ok"

def test_info():
    j = c.get("/info").json(); assert "preditores" in j and "setup_base_S0" in j

def test_prever_s0_perto_da_faixa():
    j = c.post("/prever", json={"carro": "ferrari", "setup": {}}).json()
    assert 60 < j["tempo_previsto_s"] < 90 and abs(j["dif_vs_S0_s"]) < 1e-6

def test_prever_s10_avisa_extrapolacao():
    j = c.post("/prever", json={"carro": "alfaromeo", "setup": S10}).json()
    assert j["tempo_formatado"].startswith("1:") and len(j["extrapolacao"]) > 0

def test_carro_invalido():
    assert c.post("/prever", json={"carro": "mclaren", "setup": {}}).status_code == 422

def test_ajuste_invalido():
    assert c.post("/prever", json={"carro": "ferrari", "setup": {"turbo": 9}}).status_code == 422

def test_cors():
    r = c.options("/prever", headers={"Origin": "https://exemplo.vercel.app", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") in ("*", "https://exemplo.vercel.app")


# ---------- v2: registro de vários modelos ----------
def test_modelos_lista():
    r = c.get("/modelos").json()
    tempo = [m for m in r["modelos"] if m["alvo"] == "tempo_s"]
    assert len(tempo) >= 5 and r["padrao"] in [m["id"] for m in tempo]
    assert all("mae" in m["metricas_cv"] and "mae_dp" in m["metricas_cv"] for m in tempo)
    assert any(m["alvo"] == "vel_max_kmh" for m in r["modelos"])

def test_prever_todos():
    r = c.post("/prever", json={"carro": "ferrari", "setup": {"asa_traseira": 40}, "modelos": "todos"}).json()
    assert len(r["resultados"]) >= 5
    for x in r["resultados"]:
        assert x["latencia_ms"] >= 0 and "velocidade_max_prevista_kmh" in x and "dif_vs_S0_s" in x
    assert sum(x["padrao"] for x in r["resultados"]) == 1

def test_prever_lista_e_s0():
    ids = [m["id"] for m in c.get("/modelos").json()["modelos"] if m["alvo"] == "tempo_s"][:2]
    r = c.post("/prever", json={"carro": "alfaromeo", "setup": {}, "modelos": ids}).json()
    assert [x["id"] for x in r["resultados"]] == ids and all(x["dif_vs_S0_s"] == 0 for x in r["resultados"])

def test_prever_modelo_invalido():
    assert c.post("/prever", json={"carro": "ferrari", "modelos": ["nao_existe"]}).status_code == 422
    assert c.post("/prever", json={"carro": "ferrari", "modelos": ["vel_max__ridge"]}).status_code == 422
