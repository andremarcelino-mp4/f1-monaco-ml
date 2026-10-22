/* ==== CONFIGURAÇÃO DA LANDING — edite só este arquivo ==== */
window.CONFIG = {
  // URL da API do modelo (sem barra no final). Exemplos:
  //   Hugging Face: "https://SEU-USUARIO-f1-monaco-api.hf.space"
  //   Render:       "https://f1-monaco-api.onrender.com"
  //   Oracle:       "https://api.seudominio.com"  (ou https://IP.sslip.io)
  //   Local:        "http://localhost:7860"
  API_URL: "https://f1-monaco-api.onrender.com",

  // Vídeos: cole o ID do YouTube (parte depois de v=) ou deixe "".
  YOUTUBE_ID: "",
  // Post do LinkedIn: em "..." > "Incorporar publicação", copie só a URL do src do iframe.
  LINKEDIN_EMBED: "",
  // Vídeo próprio (mp4 na pasta videos/). Deixe "" se não tiver.
  MP4: "",           // ex.: "videos/volta_monaco.mp4"

  // Links
  GITHUB: "https://github.com/andremarcelino-mp4/f1-monaco-ml",
  DASHBOARD: "",     // ex.: "https://f1-monaco-dashboard.vercel.app"

  // Equipe (nome, papel). Edite à vontade.
  EQUIPE: [
    ["André Marcelino", "Piloto de testes · captura de telemetria · modelagem"],
    ["Integrante 2", "EDA · engenharia de atributos"],
    ["Integrante 3", "Modelos · validação"],
    ["Integrante 4", "Deploy · landing page"]
  ]
};
