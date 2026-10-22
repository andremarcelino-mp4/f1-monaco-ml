---
title: F1 Monaco Engenheiro Virtual
emoji: 🏎️
colorFrom: red
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---

# API – Engenheiro de Corrida Virtual (F1 23 · Mônaco)

FastAPI que carrega `modelo/modelo_final_python.joblib` + `modelo/modelo_info_python.json` (gerados pelo notebook `modelagem_python_colab.ipynb`).

| Rota | O que faz |
|---|---|
| `GET /health` | status + nome do modelo |
| `GET /info` | preditores, faixas de treino, ruído do piloto, métricas, setups S0 e S10 |
| `POST /prever` | `{"carro":"ferrari","setup":{"asa_traseira":47}}` → tempo previsto, diferença vs S0, aviso de extrapolação |
| `GET /docs` | Swagger interativo |

**Atenção:** o modelo que vem nesta pasta é de TESTE (`"sintetico": true`), gerado por `treinar_modelo_teste.py`. Troque pelos arquivos do notebook com seus dados reais antes do deploy final.

Rodar local (Windows):
```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 7860
pytest -q
```
