# Ajustes v12 — Ajuda no Modo Estudo e soma repetida

## Correção principal
- Questões de **soma repetida** da trilha de multiplicação deixaram de ser lidas como adição comum nos apoios.
- Exemplo corrigido: `4 + 4 + 4 = ?`
  - antes: leitura/keyword/pista de **adição**
  - agora: leitura/keyword/pista/dica de **multiplicação por soma repetida**

## Regra aplicada
- Se a expressão tiver parcelas iguais repetidas **e** a operação-meta da questão for `multiplication`, o sistema mantém a semântica de multiplicação para os apoios pedagógicos.

## Mantido
- Os apoios continuam aparecendo **somente no Modo Estudo**.
- No **Modo Rápido**, os apoios seguem ocultos.
