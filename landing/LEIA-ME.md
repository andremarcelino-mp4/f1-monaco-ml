# Landing page — Engenheiro de Corrida Virtual

- `index.html`, `css/style.css`, `js/app.js`, `js/config.js` (**edite só o config.js**).
- `data/`: coloque `voltas.csv`, `amostras_leve.csv.gz` e `resultados.json`. Sem eles, a página usa `data/demo` e `data/exemplo`, ambos marcados como EXEMPLO.
- `videos/`: o .mp4 opcional.
- `imagens/`: screenshots de teste (desktop e mobile).
- Teste local: `python -m http.server 8080` dentro de `landing/` (abrir o index.html direto com duplo clique NÃO funciona, porque o navegador bloqueia a leitura dos CSVs).
- Deploy: veja `GUIA_DEPLOY.md`, seção 6.
- `assets/`: carro_vermelho/carro_grena (webp 1280w + 640w; fonte `_640.jpg`), onboard.mp4/.webm (fundo do topo, sem áudio) e onboard_poster.webp — imagens dos carros com marcas oficiais; vídeo é ilustração gerada por IA.
