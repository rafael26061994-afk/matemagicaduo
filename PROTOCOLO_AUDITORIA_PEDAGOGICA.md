# Protocolo de Auditoria Pedagógica das Questões

## Objetivo
Evitar contradições entre enunciado, leitura facilitada, palavra-chave, pista visual e explicação.

## Regras críticas

1. A operação da pergunta final manda no suporte pedagógico.
2. Leitura facilitada não pode trocar a operação original.
3. Palavra-chave deve seguir a operação da pergunta final.
4. Pista visual precisa ajudar a responder a pergunta, não apenas mostrar números soltos.
5. Em questões-ponte, o sistema deve registrar:
   - operação de origem
   - operação-alvo
6. Se houver divergência entre operação meta e operação detectada no enunciado, aplicar correção automática e registrar mismatch.

## Checklist automático

```text
[ ] Detectar a expressão-alvo (parte final do enunciado)
[ ] Inferir a operação semântica da expressão-alvo
[ ] Comparar com a operação meta usada no gerador
[ ] Bloquear palavra-chave incompatível
[ ] Bloquear leitura facilitada incompatível
[ ] Ajustar pista visual para a operação-alvo
[ ] Validar explicação final contra o resultado correto
```

## Regras por operação

### Subtração
- usar linguagem como: tirar, sobrar, faltar, comparar
- nunca usar: juntar, somar, totalizar
- pista visual preferida: parte-todo, reta numérica ou subtração por etapas

### Adição
- usar linguagem como: juntar, somar, total
- evitar linguagem de retirada

### Multiplicação
- usar linguagem como: grupos iguais, vezes, soma repetida

### Divisão
- usar linguagem como: repartir, distribuir, grupos iguais, quanto cabe

### Potenciação
- usar linguagem de multiplicação repetida

### Radiciação
- usar linguagem de operação inversa da potência

## Casos especiais: questões-ponte

### Adição → Subtração
Se o enunciado termina com uma subtração, toda a ajuda deve ser de subtração.

### Multiplicação → Divisão
Se o enunciado termina com divisão, toda a ajuda deve ser de divisão.

### Potência → Raiz
Se o enunciado termina com raiz, toda a ajuda deve ser de radiciação.


## Regras adicionais: explicação final e feedback de erro

1. Feedback não pode usar a operação meta da trilha quando a questão for uma questão-ponte.
2. O feedback deve usar sempre a operação semântica da pergunta final.
3. Em erro final (última tentativa), o sistema deve revelar a resposta correta com justificativa curta e coerente.
4. Em erro intermediário, o sistema não deve revelar a resposta; deve apenas orientar o raciocínio.
5. A explicação final automática deve validar:
   - operação da expressão final
   - números usados na expressão final
   - resultado correto
6. Em questões-ponte, a explicação final deve explicitar a relação inversa entre as duas operações.

### Checklist de validação do feedback

```text
[ ] O feedback usa a operação semântica da pergunta final
[ ] O feedback não contradiz a leitura facilitada
[ ] O feedback não revela resposta antes da última tentativa
[ ] Na última tentativa, a correção mostra o resultado correto
[ ] Em questão-ponte, a correção menciona a relação inversa
```


## Regras adicionais: auditoria dos distratores

1. Distrator não pode ser apenas número aleatório plausível; ele precisa representar um erro provável ou uma vizinhança de cálculo justificável.
2. Em modo estudo, priorizar distratores com diagnóstico identificável.
3. Em questões-ponte, garantir pelo menos um distrator de erro estrutural da relação inversa.
4. Evitar repetir o mesmo tipo de erro nas 3 alternativas erradas quando houver opções mais informativas.
5. Se o sistema detectar `bridgeFamily`, regenerar as alternativas depois de anexar esse metadado à questão.
6. Em questões com termo faltante (`strategyFamily`), regenerar as alternativas depois de anexar a família estratégica.
7. Distrator sem diagnóstico só entra como fallback quando faltarem opções pedagógicas suficientes.
8. As alternativas erradas devem ser auditadas contra a operação semântica final, não contra a operação meta da trilha.

### Checklist de validação dos distratores

```text
[ ] A operação usada nas alternativas segue a operação semântica final
[ ] Pelo menos 2 distratores têm diagnóstico pedagógico identificável em modo estudo
[ ] Em questão-ponte, há pelo menos 1 distrator de erro da relação inversa
[ ] Não há duplicação do mesmo código de erro quando existirem outras opções válidas
[ ] Distratores absurdos ou sem vínculo com a pergunta foram descartados
[ ] Após anexar bridgeFamily/strategyFamily, as alternativas foram regeneradas
```

## Regras adicionais: auditoria do banco por operação e nível

1. O nome da etapa precisa combinar com o tipo real de questão gerada.
2. Etapas com rótulos como **relação**, **conferência**, **comparar**, **valor faltante** ou **contexto** não podem gerar apenas cálculo cru repetido.
3. Quando a etapa pedir relação entre operações, gerar questão-ponte ou termo faltante coerente.
4. Quando a etapa pedir contexto, gerar enunciado contextual curto e não só expressão simbólica.
5. Quando a etapa pedir comparação/estimativa, a pergunta deve explicitar comparação, aproximação ou intervalo.
6. Quando a etapa pedir escrita expandida ou multiplicação repetida, a potência não pode aparecer apenas na forma compacta.
7. Se uma mesma etapa repetir o mesmo molde de enunciado muitas vezes na janela recente, forçar rotação de variante.
8. Repetição idêntica de enunciado é bloqueada; repetição excessiva do mesmo molde na mesma etapa também deve ser reduzida.

### Checklist de validação do banco

```text
[ ] O rótulo da etapa bate com o formato real da questão
[ ] Etapas de relação usam relação entre operações ou termo faltante
[ ] Etapas de contexto usam linguagem contextual mínima
[ ] Etapas de comparação/estimativa não caíram em cálculo cru simples
[ ] Etapas de escrita expandida mostram a forma expandida
[ ] Etapas de valor faltante usam incógnita real
[ ] Não houve repetição idêntica recente da questão
[ ] O mesmo molde não apareceu em excesso na mesma etapa e nível
```
