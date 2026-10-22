# Guia de Deploy — Engenheiro de Corrida Virtual (F1 23 · Mônaco)

Informações de preço e limites conferidas em 22/10/2026 nas páginas oficiais (Render, Hugging Face e Oracle). Elas mudam com frequência, então confira de novo antes de criar a conta.

## 1. Como as peças se encaixam

```
 Navegador do usuário
      │
      ├──► Landing page (Vercel, site estático: landing/)
      │        lê data/voltas.csv, data/amostras_leve.csv.gz, data/resultados.json
      │
      └──► API do modelo (FastAPI: api/)  ◄── simulador chama POST /prever
               carrega modelo_final_python.joblib + modelo_info_python.json
```

- **Landing (Vercel):** são só arquivos HTML, CSS, JS e CSV. Não há servidor rodando e o plano grátis é suficiente.
- **API:** é um programa Python que fica ligado esperando pedidos. Ela recebe `{"carro":"ferrari","setup":{...}}`, monta uma linha com os mesmos preditores do notebook, chama `modelo.predict()` e devolve o tempo. É a única parte que precisa de um servidor de verdade (Render, Hugging Face ou Oracle).
- **Ligação entre as duas:** em `landing/js/config.js`, troque `API_URL` pelo endereço da API. Como a API tem CORS liberado, o navegador aceita chamar outro domínio.

### Rotas da API
| Rota | Para que serve |
|---|---|
| `GET /health` | Mostra se a API está viva e qual modelo carregou (a landing usa para exibir "API online"). |
| `GET /info` | Lista os preditores, as faixas de treino, o ruído do piloto, as métricas e os setups S0 e S10. |
| `POST /prever` | Devolve o tempo previsto, a diferença em relação ao S0, uma leitura em relação ao ruído e o aviso de extrapolação. |
| `GET /docs` | Abre o Swagger, ótimo para mostrar na apresentação. |

## 2. Antes de qualquer deploy (no seu Windows)

1. Rode o `modelagem_python_colab.ipynb` com seus CSVs reais. A última célula gera 3 arquivos: `modelo_final_python.joblib`, `modelo_info_python.json` e `resultados.json`.
2. Copie os dois primeiros para `api\modelo\`, substituindo os arquivos de TESTE sintéticos. Copie `resultados.json` para `landing\data\`.
3. **Versão do scikit-learn:** um `.joblib` só abre com a mesma versão que o gerou. No Colab, rode `import sklearn; print(sklearn.__version__)`; o valor também fica em `sklearn_versao` no json. Coloque essa versão em `api\requirements.txt`, por exemplo `scikit-learn==1.6.1`. Se o modelo vencedor for XGBoost ou LightGBM, descomente a linha correspondente.
4. Teste local no PowerShell:
```
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pytest -q
uvicorn main:app --port 7860
```
Abra http://localhost:7860/docs. Em outro terminal, sirva a landing com `cd landing` e `python -m http.server 8080`, e abra http://localhost:8080. O `config.js` já aponta para `http://localhost:7860`.
5. Crie um repositório no GitHub (por exemplo `f1-monaco`) com as pastas `api/` e `landing/`. Pode instalar o GitHub Desktop, se preferir não usar o terminal. **Não suba** `amostras.csv` cru de 150 MB+ (o GitHub recusa arquivos acima de 100 MB). Suba apenas a versão leve, gerada com `preparar_dados.py --gzip`.

## 3. Opção A: Render (recomendada para a API grátis)

**Como funciona.** O Render lê o seu repositório no GitHub, constrói a imagem usando o `api/Dockerfile` e roda o container. Você recebe uma URL `https://NOME.onrender.com` com HTTPS automático, e cada `git push` gera um novo deploy.

**Limites do plano Free (doc oficial):**
- Depois de **15 min sem requisições** o serviço "dorme". A próxima chamada leva **cerca de 1 minuto** para acordar; a landing já avisa isso e espera até 90 s.
- São **750 horas grátis por mês** por workspace, e o tempo dormindo não conta.
- O disco é efêmero, o que não é problema, porque o modelo vem dentro da imagem.
- Não precisa de cartão para o plano Free. Se a banda do mês acabar sem cartão cadastrado, o serviço é suspenso.

**Passo a passo:**
1. Crie uma conta em render.com usando o login do GitHub.
2. Clique em **New > Blueprint** e escolha o repositório. O Render lê o `api/render.yaml`, que já define Docker, plano free, `rootDir: api` e health check em `/health`. Se preferir, use **New > Web Service** com Runtime **Docker**, Root Directory `api` e Instance Type **Free**.
3. Aguarde o build (de 3 a 6 min) e acesse `https://SEU-SERVICO.onrender.com/health`.
4. Coloque essa URL em `landing/js/config.js` (`API_URL`) e faça o push.
5. **Dica para a apresentação:** abra `/health` uns 2 minutos antes de apresentar, para a API já estar acordada.

O Dockerfile usa `${PORT:-7860}`, então funciona com a porta que o Render injeta.

| Prós | Contras |
|---|---|
| Deploy pelo GitHub, HTTPS automático, sem cartão | Dorme após 15 min, e a 1ª chamada leva ~1 min |

## 4. Opção B: Hugging Face Spaces

**Como funciona.** Um Space é um repositório git no Hugging Face. Com `sdk: docker` no cabeçalho do `README.md` (já pronto em `api/README.md`), o HF constrói o Dockerfile e expõe a porta `app_port: 7860`. A URL fica `https://USUARIO-NOME.hf.space`.

**⚠ Mudança importante, segundo a doc atual do HF:** o hardware CPU Basic (2 vCPU e 16 GB) continua sem custo por hora, mas **criar um Space Docker ou Gradio agora exige uma conta PRO** (para pessoas; organizações precisam de Team ou Enterprise). Sem assinatura, a criação falha com erro 402. Só os Spaces **estáticos** continuam grátis para todos. Contas gratuitas ainda podem ter até 2 Spaces Gradio em ZeroGPU, mas a API em FastAPI deste projeto não se encaixa nisso sem reescrever. Na prática, **sem PRO, prefira o Render ou o Oracle.**

Se você tiver PRO, o processo é este:
1. Em huggingface.co, vá em **New Space**, escolha SDK **Docker** (template Blank) e hardware **CPU basic**.
2. Clone e copie o conteúdo de `api/` para a raiz do Space:
```
git clone https://huggingface.co/spaces/SEU_USUARIO/f1-monaco-api
copy api\* f1-monaco-api\    (ou arraste pelo Explorer, incluindo a pasta modelo)
cd f1-monaco-api
git lfs install
git lfs track "*.joblib"
git add . && git commit -m "api" && git push
```
   Você também pode fazer upload pelo site em **Files > Add file**. Na hora de autenticar o push, use um *Access Token* do HF como senha.
3. A aba **Logs** mostra o build. Quando aparecer *Running*, teste `https://SEU_USUARIO-f1-monaco-api.hf.space/health`.
4. No CPU basic, o Space dorme depois de **48 h sem uso** e acorda sozinho na próxima visita.

| Prós | Contras |
|---|---|
| Vitrine conhecida em ML; 16 GB de RAM | Exige PRO para Docker; o build às vezes é lento |

## 5. Opção C: Oracle Cloud Always Free (VM sua, sempre ligada)

**Como funciona.** Você recebe uma máquina virtual Linux completa. Instala Python, roda a API com o **uvicorn**, usa o **systemd** para ela iniciar sozinha e reiniciar se cair, e o **Caddy** como "porteiro" na porta 443, que gera o certificado HTTPS automaticamente e repassa para a API na porta 7860. Ela não dorme nunca.

**Limites atuais (doc oficial e aviso da Oracle de jul/2026):**
- **Ampere A1 (ARM):** em contas *Always Free*, o limite **caiu para 2 OCPUs e 12 GB de RAM no total** (1.500 OCPU-horas e 9.000 GB-horas por mês). Era 4 OCPUs e 24 GB; o que eu tinha dito antes está desatualizado. Contas pagas (PAYG) mantêm a franquia antiga.
- Há também até 2 VMs AMD *Micro* (1/8 OCPU, 1 GB).
- São 200 GB de bloco no total; cada boot volume tem no mínimo ~47–50 GB.
- O A1 Always Free só pode ser criado na **região-casa**, que você escolhe no cadastro e **não pode trocar depois**. Escolha São Paulo ou Vinhedo. Se aparecer "Out of capacity", tente outro *Availability Domain* ou outro horário.
- O cadastro pede cartão para verificação (pode haver uma pré-autorização pequena que é estornada). Recursos Always Free não são cobrados.

Para este modelo, 1 OCPU e 6 GB sobram.

### Passo a passo
**1. Criar a VM:** vá em **Compute > Instances > Create instance**.
- Image: **Ubuntu 24.04** (ou 22.04).
- Shape: **Ampere > VM.Standard.A1.Flex**, com 1 OCPU e 6 GB (aparece o selo *Always Free-eligible*).
- Networking: mantenha a VCN padrão e marque *Assign a public IPv4 address*.
- SSH keys: **Generate a key pair for me** e **baixe a chave privada** (`ssh-key-xxxx.key`). Guarde num lugar seguro e não envie para ninguém nem suba no GitHub.
- Clique em **Create** e anote o **Public IP**.

**2. Abrir as portas na Security List** (é o firewall da nuvem):
- Vá em **Networking > Virtual Cloud Networks > (sua VCN) > Subnet > Default Security List > Add Ingress Rules**.
- Source CIDR `0.0.0.0/0`, protocolo TCP, *Destination Port* **80**.
- Outra regra igual para a porta **443**. A porta 22 (SSH) já vem aberta.
- Não abra a 7860: ela fica interna, atrás do Caddy.

**3. Conectar pelo Windows** (o PowerShell já tem ssh):
```
ssh -i C:\caminho\ssh-key-xxxx.key ubuntu@SEU_IP
```
Se reclamar de permissão da chave, clique com o botão direito na chave, vá em **Propriedades > Segurança > Avançado**, desative a herança e deixe só o seu usuário com acesso.

**4. Enviar a API** (num novo PowerShell, na pasta do projeto):
```
scp -i C:\caminho\ssh-key-xxxx.key -r api ubuntu@SEU_IP:/home/ubuntu/
```
Ou, na VM, rode `git clone https://github.com/SEU_USUARIO/f1-monaco.git` e use a pasta `api` de dentro dele.

**5. Instalar e testar na VM:**
```
sudo apt update && sudo apt install -y python3-venv python3-pip
cd ~/api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest -q
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 7860   # Ctrl+C depois de ver "Application startup complete"
```

**6. Firewall do Ubuntu na VM.** As imagens Ubuntu da Oracle vêm com regras **iptables** que bloqueiam tudo, menos a porta 22. Abrir só a Security List não basta; é o erro mais comum.
```
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```
Se você preferir usar o **ufw**, não misture com as regras acima. Para isso, rode antes `sudo ufw allow 22/tcp` (senão você perde o SSH), depois `sudo ufw allow 80/tcp`, `sudo ufw allow 443/tcp` e `sudo ufw enable`. Para este projeto, o iptables acima é suficiente.

**7. Deixar a API como serviço (systemd):**
```
sudo tee /etc/systemd/system/f1api.service > /dev/null <<'EOF'
[Unit]
Description=API F1 Monaco
After=network.target
[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/api
ExecStart=/home/ubuntu/api/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 7860 --workers 2
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now f1api
sudo systemctl status f1api      # deve mostrar "active (running)"
curl http://127.0.0.1:7860/health
```
Para ver os logs: `journalctl -u f1api -f`.

**8. HTTPS com o Caddy.** É obrigatório, porque a landing no Vercel usa https e o navegador bloqueia a chamada de uma página https para uma API http (mixed content).
- Você precisa de um nome de domínio. Sem comprar um, use **sslip.io**, que transforma o IP em nome: se o IP for `129.1.2.3`, o domínio é `129.1.2.3.sslip.io`. Também serve um subdomínio grátis do DuckDNS.
```
sudo apt install -y caddy
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
129.1.2.3.sslip.io {
    reverse_proxy 127.0.0.1:7860
}
EOF
sudo systemctl reload caddy
```
- Abra `https://129.1.2.3.sslip.io/health`. O Caddy obtém o certificado da Let's Encrypt sozinho, mas para isso as portas 80 e 443 precisam estar abertas nos passos 2 e 6.
- Se o `apt install caddy` não achar o pacote, siga a instalação oficial em caddyserver.com/docs/install (repositório Cloudsmith).

**9. Atualizar o modelo depois:** envie de novo os arquivos com `scp`, com destino `api/modelo/`, e rode `sudo systemctl restart f1api`.

| Prós | Contras |
|---|---|
| Sempre ligada, sem "acordar"; você aprende Linux, systemd e HTTPS (bom para a banca) | Mais trabalhoso (2–3 h); pede cartão; pode faltar capacidade; você cuida da segurança e das atualizações |

## 6. Landing page no Vercel

1. Coloque seus dados em `landing/data/`: `voltas.csv`, `amostras_leve.csv.gz` e `resultados.json`. Para gerar a amostra leve:
```
python dashboard\preparar_dados.py --entrada telemetria\dados --saida landing\data --passo 8 --gzip
```
Depois apague a cópia de `voltas.csv` que já estava lá, se houver duplicata. Sem esses arquivos, a página mostra os dados de **EXEMPLO**, com uma faixa amarela avisando.
2. Edite `landing/js/config.js`: `API_URL`, `YOUTUBE_ID`, `LINKEDIN_EMBED`, `MP4`, `GITHUB`, `DASHBOARD` e `EQUIPE`.
3. No vercel.com, clique em **Add New > Project** e importe o repositório. Em **Root Directory**, coloque `landing` e em Framework, **Other**. Não há build command. Depois clique em **Deploy**.
   Sem GitHub, também dá: `npm i -g vercel`, depois `cd landing` e `vercel --prod`.
4. Abra o site, role até **Simulador** e confira se aparece "● API online".

## 7. Comparação e recomendação

| | Render | Hugging Face | Oracle Always Free |
|---|---|---|---|
| Custo | Grátis | CPU grátis, mas Docker exige PRO | Grátis (pede cartão) |
| Dorme? | Sim, após 15 min (~1 min para acordar) | Sim, após 48 h | Não |
| Dificuldade | ⭐ fácil | ⭐ fácil (com PRO) | ⭐⭐⭐ média |
| HTTPS | Automático | Automático | Caddy |
| Melhor para | Entregar rápido e sem cartão | Quem já tem PRO | Ficar 100% online e mostrar infraestrutura |

**Recomendação para a entrega de 17/11:**
1. **Render** como API principal: fica pronto em ~20 min e é grátis sem cartão. Acorde a API antes da apresentação.
2. **Oracle** como diferencial, se sobrar tempo. Se der certo, troque o `API_URL`; se não der, o Render continua.
3. **Shiny** no shinyapps.io, se o professor exigir o padrão R.
4. Na apresentação, mostre também o `/docs` (Swagger) e o `pytest` passando. Isso conta para os 30 pontos de deploy.

## 8. Problemas comuns
| Sintoma | Causa provável | Solução |
|---|---|---|
| "API indisponível" na landing | `API_URL` errada ou a API está dormindo | Abra `/health` direto no navegador e espere 1 min |
| Erro ao carregar o `.joblib` (`AttributeError`/`ModuleNotFoundError`) | Versão do sklearn diferente da do Colab | Ajuste o `requirements.txt` para a versão do Colab |
| Funciona em http mas não na landing do Vercel | Mixed content | Use https (Caddy, Render ou HF) |
| Oracle: o navegador não abre nem a porta 80 | iptables da VM | Faça o passo 6 |
| Oracle: "Out of host capacity" | Falta de A1 na região | Tente outro AD ou horário, ou use uma VM Micro (AMD) |
| Os números da landing estão em amarelo "EXEMPLO" | Falta o `resultados.json` real | Copie o arquivo gerado pelo notebook para `landing/data/` |

## 9. Vários modelos (registro) — v2 da API

**De onde vêm:** a célula *“10. Registro de modelos”* do notebook Python gera `modelos.zip` com:
```
modelos/registro.json                 ← lista todos os modelos e o padrão de cada alvo
modelos/<id>/modelo.joblib + meta.json
```
ids: `tempo__<algoritmo>` (tempo de volta), `vel_max__<algoritmo>` (velocidade máxima da volta, coluna `vel_max_kmh`) e `vel_media__<algoritmo>` (`vel_media_kmh`). Algoritmos: baseline_media, so_carro, lasso, ridge, random_forest, xgboost, lightgbm. Entrada de todos: só setup + carro + volta_stint (sem vazamento).

**Onde colocar:** descompacte em `modelos/` (raiz, usado pelos testes locais) **e copie para `api/modelos/`** — no Render o Docker só enxerga a pasta `api/`.
```powershell
Copy-Item -Recurse -Force modelos api\modelos
```
Os modelos de TESTE que vêm no pacote são **sintéticos** (`"sintetico": true`) — troque-os antes da entrega.

**Variáveis de ambiente (Render → serviço → Environment):**
| variável | valor | efeito |
|---|---|---|
| `MODELOS_DIR` | `/app/modelos` | pasta do registro (já no render.yaml) |
| `MODELO_PADRAO` | ex. `tempo__ridge` | troca o modelo padrão **sem novo treino**; vazio = o do `registro.json` |
| `PORT` | o Render define sozinho | — |

Trocar o padrão: Environment → editar `MODELO_PADRAO` → *Save, rebuild and deploy*. Se o id não existir (ou não for de tempo) a API **não sobe** e o log mostra os ids válidos — de propósito, para o erro não passar despercebido.

**Adicionar um modelo novo:** crie `api/modelos/<id>/modelo.joblib` + `meta.json` (mesmos campos dos outros: `id, nome, algoritmo, alvo, colunas, metricas_cv, metricas_teste, hiperparametros…`), acrescente a entrada em `registro.json → modelos` e faça commit/push. O jeito mais seguro é incluir o algoritmo na função `espaco()` (notebook ou `api/registro_modelos.py`) e reexportar tudo. Se usar uma biblioteca nova, coloque-a no `requirements.txt`.

**Rotas novas:** `GET /modelos` (lista, métricas CV±dp/teste e hiperparâmetros) e `POST /prever` com `"modelos": ["tempo__ridge", "tempo__lasso"]` ou `"modelos": "todos"` → em `resultados[]` vem, por modelo: tempo previsto, Δ vs S0, velocidade máx/média prevista (modelo de velocidade do mesmo algoritmo) e latência em ms. Sem o campo `modelos` a resposta é igual à v1 (+ campos extras), então o site antigo continua funcionando. Sem `registro.json`, a API volta ao modo antigo (`api/modelo/modelo_final_python.joblib`).

**Site:** o simulador lê a lista de modelos de `API/modelos`; se a API estiver fora, a seção Resultados usa `landing/data/registro.json` (copie o seu) ou o exemplo sintético rotulado.

**Atenção:** `scikit-learn` do `requirements.txt` deve ser a mesma do Colab (`sklearn_versao` no `registro.json`); xgboost/lightgbm também precisam estar instalados (já no requirements; o Dockerfile instala `libgomp1`).
