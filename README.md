# Matemágica (v20.0) — PWA offline-first (GitHub Pages)

Projeto educacional (EF II 6º–9º) com gamificação estilo “campanha”, missões diárias de 5 minutos e acessibilidade incremental.

## Como publicar no GitHub Pages

1) Crie (ou use) um repositório no GitHub.
2) Envie **todos** os arquivos desta pasta para a **raiz** do repositório (mesmo nível do index.html).
3) Vá em **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** (/**root**)
4) Salve e abra a URL do Pages.

Arquivos obrigatórios (mínimo):
- index.html, style.css, script.js, sw.js, manifest.webmanifest
- a11y.js
- relatorio.html, relatorio.js
- professor.html, professor.js, qrcode.min.js
- icon-192.png, icon-512.png
- rafael.png, ronaldo.png, Sem titulo.png
- alert-sound.mp3

## Como forçar atualização (cache / PWA)

Quando você atualizar arquivos no GitHub Pages, o Service Worker pode manter cache antigo.

Opções (use na ordem):
1) **Recarregamento forte**:
   - PC: Ctrl+Shift+R
2) **Limpar cache do site**:
   - Chrome: Cadeado → “Configurações do site” → “Limpar dados”
3) **Desinstalar e reinstalar PWA** (se instalado).
4) **DevTools**:
   - Application → Service Workers → “Unregister”
   - Application → Clear storage → “Clear site data”

Observação: esta versão usa `CACHE_NAME = matemagica-duo-v20.0.2` em `sw.js`.

## Acessibilidade (v20)

- Foco visível forte (CSS)
- Atalhos: 1/2/3/4 para alternativas, Enter confirma, Esc fecha modal (quando aplicável)
- ARIA básico e semântica
- **VLibras (online)**: carregado por padrão via `a11y.js`
  - Offline continua funcionando normalmente (VLibras apenas não carrega sem internet)

## O que foi ajustado nesta versão (corte 9,5 / nota 10)

- **Campanha Base vs Reforço** com regra 70/30 (lição vs revisão)
- **Base**: revisão só da mesma operação + microcheck sempre após 1º erro + sem timer por padrão
- **Reforço**: revisão mix por pesos (+25%, −25%, ×23%, ÷20%, potência 4%, raiz 3%); microcheck apenas quando instabilidade
- “Tempo esgotado” não vira “Game Over” (mensagem pedagógica)
- Adição/Subtração “Padrão B” (misto com vai-um / empréstimo) conforme definido
- Relatório inclui `breakdown.bySkillTag` para intervenção do professor
- Painel do professor simplificado: 2 botões grandes (Escanear / Colar), “Limpar tudo” em “Mais”
