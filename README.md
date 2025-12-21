# Matemágica (GitHub Pages)

## Como publicar no GitHub Pages (passo a passo)

1. Crie um repositório no GitHub (público ou privado, mas Pages exige público em alguns planos).
2. Faça upload destes arquivos na raiz do repositório:
   - index.html
   - style.css
   - script.js
   - alert-sound.mp3
   - rafael.png
   - ronaldo.png
3. Vá em **Settings** → **Pages**
4. Em **Build and deployment**, selecione:
   - Source: **Deploy from a branch**
   - Branch: **main** (ou master) / folder: **/(root)**
5. Salve. O GitHub vai gerar o link do site.

## Recursos incluídos

- **Tabuada 0–20** na Multiplicação:
  - 🛤️ Trilha automática (todas as tabuadas 0–20 em ordem aleatória, sem repetição)
  - 🎯 Escolher tabuada (0–20)
  - 🎲 Aleatório (modo antigo)
- **Perfis A/B/C** (dados separados por aluno)
- **Painel do Professor** (botão 👨‍🏫 no canto):
  - Resumo do aluno
  - Top 3 itens mais difíceis (SRS)
  - **Missão diária** (alternada) com controles (trocar / reset)
  - Exportar dados (JSON) / Reset do perfil
- **Histórico de sessões** e **Ranking local** persistente (por perfil)

> Observação: Todo o armazenamento é local (LocalStorage do navegador).  
> Para “zerar” um aluno, use o botão **Reset perfil** no Painel do Professor.
