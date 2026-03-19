# Auditoria questão a questão — v13

## O que foi acrescentado

Esta versão passou a aplicar uma auditoria em **cada questão gerada antes de exibir na tela**.

A auditoria faz 4 coisas:

1. **Revalida a operação semântica**
   - corrige casos em que o texto da questão pede uma operação diferente da operação-meta.
   - exemplo clássico: soma repetida dentro da trilha de multiplicação.

2. **Revalida a resposta esperada**
   - tenta recalcular a resposta a partir do texto da própria questão.
   - quando encontra divergência entre texto e `answer`, corrige o valor antes de mostrar.

3. **Revalida as alternativas**
   - se houver duplicidade, ausência da correta ou conjunto fraco, reconstrói as opções.

4. **Revalida os apoios pedagógicos**
   - leitura facilitada
   - pista visual
   - dica estratégica
   - palavra-chave

## Regras de bloqueio/correção

A camada de auditoria agora intercepta, entre outros:

- linguagem de adição em questão de subtração
- linguagem de adição em divisão
- soma repetida tratada como adição comum
- pista visual genérica do tipo "Leitura útil"
- apoios vazios
- pista/ajuda incompatível com grupos iguais, termo faltante, resto ou operação inversa

## Onde a auditoria roda

- fluxo normal da partida (`nextQuestion`)
- treino de erros (`nextTrainingQuestion`)

## Limite honesto

Isso **reduz bastante a chance de erro passar**, mas não prova perfeição absoluta.

Motivo:
- o banco é grande e parte dele é randômica
- existem enunciados textuais variados
- alguns padrões novos ainda podem exigir regra adicional

## Próximo uso recomendado

1. testar no app as trilhas mais críticas
2. quando aparecer um caso estranho, olhar o print e a trilha
3. corrigir a regra específica, não no escuro
