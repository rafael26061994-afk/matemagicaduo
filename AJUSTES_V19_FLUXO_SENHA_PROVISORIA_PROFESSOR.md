# Ajustes v19 — fluxo da senha provisória do professor

## O que mudou
- O primeiro acesso do professor agora acontece em **2 etapas**.
- Etapa 1: pedir **somente a senha provisória**.
- Etapa 2: **apenas se a senha provisória estiver correta**, o sistema libera o formulário com:
  - nome completo
  - escola
  - turma
  - e-mail
  - nova senha

## Regras aplicadas
- Sem senha provisória correta, o formulário do professor não aparece.
- Se a senha provisória estiver errada, o sistema bloqueia a continuidade.
- No cadastro final, o sistema revalida a senha provisória antes de concluir.

## Impacto prático
- O fluxo fica alinhado com a regra solicitada.
- Reduz liberação indevida do formulário de cadastro do professor.
