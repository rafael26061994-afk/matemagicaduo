# Auditoria amostral automática do banco de questões

## Escopo real da auditoria
- Varredura estrutural das **240 etapas** do banco (`6 operações × 4 níveis × 10 etapas`)
- Checagem da coerência entre **nome pedagógico da etapa** e **família real de questão gerada**
- Ampliação da matriz de auditoria para estágios que antes caíam em **conta crua disfarçada**
- Esta auditoria foi **estática/estrutural** no gerador. Não substitui uma sessão longa manual no navegador com dezenas de itens por trilha.

## Resultado objetivo
- Cobertura anterior de etapas com auditoria pedagógica dedicada: **38 / 240**
- Cobertura atual após correção: **70 / 240**
- Ganho estrutural: **+32 etapas** com auditoria dirigida por tipo de raciocínio

## Cobertura dedicada por operação
- **Adição:** 3 → 10
- **Subtração:** 2 → 14
- **Multiplicação:** 4 → 4
- **Divisão:** 4 → 12
- **Potenciação:** 8 → 11
- **Radiciação:** 17 → 19

## Onde o banco estava mais fraco
### Risco alto
1. **Adição e subtração contextual**
   - Etapas com rótulos como `contexto`, `composição`, `situações-problema`, `interpretação da diferença` e `estratégias mentais`
   - Problema: várias caíam em **expressão numérica simples**, sem cumprir a promessa pedagógica do nome da etapa

2. **Divisão avançada**
   - Etapas como `Estimativa do quociente`, `Erros comuns de divisão`, `Escolher entre quociente e resto`
   - Problema: parte delas ainda se resolvia como divisão comum sem explicitar o raciocínio alvo

### Risco médio
3. **Potenciação avançada**
   - Etapas como `Reconhecer erro comum`, `Aplicação em contexto`, `Comparar valores de potências`
   - Problema: algumas ainda pareciam treino de cálculo puro, não discriminação conceitual

4. **Radiciação avançada**
   - O banco já estava melhor do que os demais, mas ainda faltava reforço em `Reconhecer quadrado perfeito` e `Leitura de raiz em expressão curta`

## Correções aplicadas nesta rodada
### Adição
- Contexto curto de composição
- Estimativa por arredondamento
- Decomposição guiada
- Estratégia mental por ancoragem em centena/dezena
- Termo faltante auditado com mais coerência

### Subtração
- Contexto de sobra
- Diferença entre quantidades
- Decomposição guiada
- Estratégia mental por compensação
- Minuendo/subtraendo desconhecidos mais alinhados ao nome da etapa

### Multiplicação
- Mantive a cobertura que já estava boa na relação multiplicação/divisão
- Acrescentei auditoria dedicada para:
  - contexto multiplicativo com grupos grandes
  - dobrar para multiplicar
  - distributiva simples

### Divisão
- Contexto de agrupamento
- Estimativa do quociente
- Perguntas centradas em resto
- Erro comum de “grupos completos antes de sobrar”
- Relação multiplicação/divisão reforçada

### Potenciação
- Comparação entre potências/produtos
- Escrita expandida
- Valor faltante em potência
- Erro comum `potência ≠ multiplicação simples`
- Aplicação em contexto

### Radiciação
- Reconhecimento de quadrado perfeito
- Leitura de raiz em expressão curta
- Relação inversa com potência mantida
- Estimativa e comparação mantidas

## Diagnóstico brutalmente honesto
O problema central do banco não era “falta de questão”. Era **falta de fidelidade pedagógica entre o nome da etapa e o raciocínio realmente exigido**.

Isso é perigoso porque:
- o professor acha que está treinando uma habilidade
- o sistema entrega outra
- o relatório de progresso fica mais bonito do que verdadeiro

## O que ainda não está resolvido 100%
1. **Multiplicação** ainda tem pouca auditoria dedicada em etapas de comutatividade e padrões. Não é falha grave, mas ainda é cobertura rasa.
2. **Revisões mistas** e **domínio final** continuam heterogêneos por desenho. Isso é normal, mas exige amostragem manual para evitar repetição silenciosa.
3. Esta rodada corrigiu a **matriz de geração**. Ela não prova, sozinha, a qualidade final percebida em sessões longas no celular.

## Prioridade de teste manual agora
1. Adição avançada: `Adição com leitura de valores`, `Problemas de composição`, `Estratégias mentais de soma`
2. Subtração avançada: `Interpretação da diferença`, `Estratégias mentais de cálculo`
3. Divisão avançada: `Escolher entre quociente e resto`, `Estimativa do quociente`, `Erros comuns de divisão`
4. Potenciação avançada: `Reconhecer erro comum`, `Aplicação em contexto`
5. Radiciação avançada: `Leitura de raiz em expressão curta`

## Regra técnica consolidada
**Se o nome da etapa indicar estratégia, contexto, estimativa, comparação, erro comum ou termo faltante, o gerador não pode cair em conta crua genérica como saída padrão.**
