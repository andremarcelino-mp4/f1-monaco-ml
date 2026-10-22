# Brief para agente de IA — Deploy do “Engenheiro de Corrida Virtual”

> Você é um agente executando o deploy **em nome do André** (aluno de Gestão de Tecnologia da FECAF). Leia tudo antes de agir. Peça confirmação ao André antes de qualquer ação irreversível ou pública (criar repositório público, conectar contas, apagar algo). **Nunca** peça, digite, armazene ou commite senhas/tokens: o login nas plataformas é feito pelo próprio André no navegador.

## 1. Contexto
- Projeto final de ML/DL (FECAF). Entrega 17/11/2026, apresentação 18/11/2026.
- Experimento no jogo **F1 23**, circuito de **Mônaco**, carros Ferrari e Alfa Romeo, setups **S0** (base) a **S10** (S1–S9 mudam 1 ajuste; S10 sugerido por IA, muda vários).
- Objetivo: prever **tempo de volta** (e **velocidade máx/média**) a partir do setup + carro, comparando vários modelos (baseline, só carro, Lasso, Ridge, Random Forest, XGBoost, LightGBM) num site com simulador.
- Arquitetura: **landing estática (Vercel)** → chama → **API FastAPI em Docker (Render, plano free)**, que carrega os modelos `.joblib`.

## 2. Estrutura do pacote (`pacote_deploy_render.zip`)
```
render.yaml                 Blueprint do Render (raiz do repo)
GUIA_DEPLOY.md / .docx      guia humano completo
INSTRUCOES_AGENTE_RENDER.md este arquivo
api/                        main.py, test_api.py, registro_modelos.py, Dockerfile, requirements.txt, render.yaml, modelo/ (v1 legado)
modelos/                    registro.json + <id>/modelo.joblib + meta.json   ← ATUALMENTE SINTÉTICOS (teste)
landing/                    index.html, css/, js/config.js, js/app.js, data/, assets/, vercel.json
```

## 3. Pré-requisitos (Windows)
- Contas: **GitHub**, **Render** (entrar com GitHub), **Vercel** (entrar com GitHub). O André faz os logins.
- Instalados: **Git for Windows**, **Python 3.11+**, (opcional) **GitHub Desktop**.
- Do Colab: o arquivo **`modelos.zip`** gerado pela célula “10. Registro de modelos” do `modelagem_python_colab.ipynb` rodado com os dados **reais** (`USAR_DADOS_SINTETICOS = False`), e a versão do scikit-learn do Colab (`import sklearn; sklearn.__version__`).

## 4. Passo a passo
### 4.1 Preparar a pasta
1. Descompacte o pacote em `C:\f1_monaco_deploy\`.
2. **Trocar modelos sintéticos pelos reais:** apague o conteúdo de `modelos\` e descompacte nele o `modelos.zip` do Colab. Confira `modelos\registro.json`: `"sintetico": false`.
3. Copie para dentro da API (o Docker do Render só vê `api/`):
   ```powershell
   cd C:\f1_monaco_deploy
   Remove-Item -Recurse -Force api\modelos -ErrorAction SilentlyContinue
   Copy-Item -Recurse modelos api\modelos
   ```
4. **Alinhar scikit-learn:** em `api\requirements.txt`, a linha `scikit-learn==X.Y.Z` deve ser igual ao `sklearn_versao` do `registro.json`. Se o Colab usou xgboost/lightgbm de outra versão, ajuste também (ou remova o pin).
5. (Opcional) Copie `modelos\registro.json` para `landing\data\registro.json` (o site usa como reserva se a API estiver dormindo) e o `resultados.json` do notebook para `landing\data\`.

### 4.2 Testar localmente
```powershell
cd C:\f1_monaco_deploy\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m pytest -q          # esperado: todos passam (11)
uvicorn main:app --port 7860
```
Abra http://localhost:7860/health (deve mostrar `n_modelos`, `"sintetico": false`), `/modelos` e `/docs`. Pare com Ctrl+C.

### 4.3 Repositório GitHub
1. Confirme com o André o nome (ex.: `f1-monaco-ml`) e se será **público** (Vercel/Render free funcionam com privado também).
2. Na raiz `C:\f1_monaco_deploy`:
   ```powershell
   git init; git add .; git commit -m "Deploy: API multi-modelos + landing"
   git branch -M main
   git remote add origin https://github.com/<usuario>/f1-monaco-ml.git
   git push -u origin main
   ```
   (autenticação pelo navegador/Git Credential Manager — não cole tokens no chat.)
3. Confirme que `api/modelos/registro.json` está no GitHub e que **não** há `.venv`, `.env` ou senhas.

### 4.4 API no Render (Blueprint)
1. Render → **New → Blueprint** → escolher o repositório → o Render lê `render.yaml` da raiz.
2. Variáveis (já no render.yaml; confira em *Environment*):
   - `MODELOS_DIR` = `/app/modelos`
   - `MODELO_PADRAO` = vazio (usa o padrão do `registro.json`) ou um id de tempo, ex. `tempo__ridge`
   - `PORT`: **não defina** — o Render injeta; o Dockerfile usa `${PORT:-7860}`.
3. **Apply**. Aguarde o build (5–10 min na 1ª vez).
4. Verifique, trocando pelo seu endereço:
   - `https://<servico>.onrender.com/health` → `"status":"ok"`, `n_modelos` > 1, `"sintetico": false`
   - `/modelos` → lista com métricas
   - `/docs` → testar `POST /prever` com `{"carro":"ferrari","setup":{},"modelos":"todos"}`
5. Plano free: dorme após 15 min sem uso; a 1ª chamada demora ~1 min. Antes da apresentação, abra `/health` uns minutos antes.

### 4.5 Ligar o site à API
Em `landing/js/config.js`: `API_URL: "https://<servico>.onrender.com"` (sem barra no final). Preencha também YOUTUBE_ID/LINKEDIN_EMBED/GITHUB se o André fornecer. Commit + push.

### 4.6 Landing no Vercel
1. Vercel → **Add New → Project** → importar o repositório.
2. **Root Directory: `landing`**; Framework Preset: **Other**; sem build command; output padrão.
3. **Deploy**. Abra a URL `https://<projeto>.vercel.app`.

## 5. Checklist final
- [ ] `/health` com `"sintetico": false` e o número de modelos esperado
- [ ] `registro.json` real (nenhum aviso “EXEMPLO / SINTÉTICO” no site)
- [ ] Simulador: “● API online”, seleção de vários modelos, cards e gráfico ±MAE aparecem; modelo padrão em roxo
- [ ] Velocidade prevista aparece (se o Colab gerou modelos `vel_max__*`)
- [ ] S10 mostra aviso de extrapolação quando aplicável
- [ ] Site abre no celular sem rolagem lateral
- [ ] Links (GitHub, vídeo) funcionando; nenhum logo oficial de F1/equipe
- [ ] Enviar ao André: URL do site, URL da API, link do repositório

## 6. Problemas comuns
| sintoma | causa / solução |
|---|---|
| Build falha em `pip install` | versão pinada inexistente para Python 3.11 → ajuste o pin para a do Colab ou a mais próxima |
| API sobe mas `/health` mostra `modelo_padrao: legado` | `api/modelos/registro.json` não foi commitado → refaça o passo 4.1.3 |
| `RuntimeError: MODELO_PADRAO=...` no log | id inválido → use um id `tempo__...` listado no erro, ou deixe vazio |
| `InconsistentVersionWarning` / erro ao carregar joblib | scikit-learn diferente do Colab → alinhar requirements |
| `libgomp.so.1` não encontrado | Dockerfile alterado; manter a linha que instala `libgomp1` |
| Site: “API indisponível” | API dormindo (aguarde 1 min e recarregue) ou `API_URL` errado/com barra final |
| Site mostra dados de EXEMPLO | faltou `landing/data/voltas.csv`/`resultados.json`/`registro.json` reais |
| Repositório > 100 MB / arquivo grande | não commitar `amostras.csv` completo; use a versão leve |

## 7. O que NÃO fazer
- **Não** commitar segredos (senhas, tokens, `.env`, credenciais do Brightspace/EA/GitHub) — nem colar no chat.
- **Não** entregar com os modelos **sintéticos** do pacote nem apresentar números deles como resultado.
- **Não** inventar métricas ou editar `meta.json`/`registro.json` à mão para “melhorar” números.
- **Não** usar logos oficiais da F1/equipes ou fontes proprietárias.
- **Não** trocar o plano do Render/Vercel para pago nem cadastrar cartão sem o André autorizar.
- **Não** apagar repositórios/serviços existentes do André.
