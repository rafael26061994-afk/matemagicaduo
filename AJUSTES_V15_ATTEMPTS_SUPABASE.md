# Ajustes v15 — integração real de attempts no Supabase

## O que foi feito
- Registro de cada resposta do aluno em `public.attempts`.
- Fila local para tentativas quando não houver sessão cloud ativa no momento.
- Sincronização posterior automática ao autenticar ou voltar a ficar online.
- `client_attempt_id` único para evitar duplicação de tentativas no retry.
- Upsert de `game_sessions` em andamento para garantir chave estrangeira de `attempts`.

## Arquivos alterados
- `script.js`
- `js/pet-repositories.js`
- `js/pet-cloud-driver.js`
- `js/pet-sync.js`
- `supabase-schema.sql`

## Limites atuais
- `skill_mastery` ainda não é recalculado automaticamente por tentativa.
- O app continua priorizando fallback local; o Supabase entra como persistência cloud e relatórios.
