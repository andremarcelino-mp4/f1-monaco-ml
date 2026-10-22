# 3.12 (não 3.11): xgboost==3.4.1 exige Python >=3.12 — mesma versão usada no treino
FROM python:3.12-slim
WORKDIR /app
# libgomp1 é exigida pelo LightGBM/XGBoost
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# HF Spaces usa 7860; o Render injeta $PORT
ENV PORT=7860
# registro de modelos: copie a pasta modelos/ do projeto para api/modelos/ antes do deploy
ENV MODELOS_DIR=/app/modelos
EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
