# PET — Programa de Estudo da Tabuada (GitHub Pages)

Aplicativo web (PWA) para prática de tabuada e operações com foco em **engajamento, acessibilidade e inclusão**.

## Como publicar no GitHub Pages
1. Crie (ou use) um repositório no GitHub.
2. Envie **todos** os arquivos deste projeto para a **raiz** do repositório (incluindo imagens e áudio).
3. Vá em **Settings > Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main** (root)
4. Salve e abra o link gerado pelo GitHub Pages.

## PWA (instalar como app)
- O projeto já inclui `manifest.webmanifest` e `sw.js` (offline).
- Se você atualizar arquivos e o navegador “não pegar”, faça:
  - Recarregar forçado (Ctrl+F5) **ou**
  - Limpar dados do site (cache) **ou**
  - Se aparecer “Atualização disponível”, clicar em **Atualizar**.

## Estrutura de arquivos (principais)
- `index.html` — telas do app
- `style.css` — estilos
- `script.js` — lógica do jogo
- `sw.js` — Service Worker (offline + cache)
- `manifest.webmanifest` — PWA
- `alert-sound.mp3` — som de alerta
- `Sem titulo.png`, `rafael.png`, `ronaldo.png` — imagens
- `icon-192.png`, `icon-512.png` — ícones do PWA

## Versão
- App: **v1.4.0** (Nível 1 + Prioridades 1–7)
  - PWA/Offline com atualização controlada (banner “Atualização disponível”)
  - Acessibilidade: foco visível, reduzir animações, contraste/zoom (quando disponível)
  - Retomar sessão salva neste dispositivo
  - Onboarding (1ª vez), resumo pós-sessão, sequência (streak) e conquistas
  - Relatório CSV de sessões (com exportação completa e filtrada)

## Uso e autoria
© 2026 Rafael Oliveira e Ronaldo Soares. Todos os direitos reservados.  
PET — Programa de Estudo da Tabuada é um projeto educacional institucional vinculado à Escola Municipal Vereador José Ferreira de Aguiar (Contagem/MG).  
Uso autorizado exclusivamente para fins educacionais. É vedada a reprodução, redistribuição, modificação ou exploração comercial, total ou parcial, sem autorização prévia e expressa de ambos os autores.  
É vedada a supressão de créditos/avisos de autoria e qualquer apresentação do projeto como de terceiros.

## Relatório CSV (sessões)
- Exportação completa: na tela inicial, clique em **🎖 Conquistas** e depois em **📄 Exportar CSV**.
- Exportação filtrada (Operação / Nível / Período): clique em **👩‍🏫 Área do Professor** (na Home) ou no botão flutuante **👩‍🏫** e use a seção **Relatório CSV (sessões)**.
- O arquivo baixado fica no formato `PET_relatorio_sessoes_YYYY-MM-DD_...csv` e contém sessões concluídas **neste dispositivo**.
- Observação: o PET não envia dados para servidor. O relatório é gerado a partir do armazenamento local (localStorage).
