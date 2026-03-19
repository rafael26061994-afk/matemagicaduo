# Checklist de implantação Supabase no PET

## Banco
- [ ] criar projeto no Supabase
- [ ] rodar `supabase-schema.sql`
- [ ] conferir se o trigger `on_auth_user_created` foi criado
- [ ] conferir se todas as tabelas do `public` estão com RLS habilitado
- [ ] conferir se a conta de professor recebeu `role = 'teacher'`

## Front
- [ ] preencher `js/pet-config.js`
- [ ] testar cadastro online
- [ ] testar login online
- [ ] testar vínculo do perfil local com a conta online
- [ ] testar sincronização manual
- [ ] testar bootstrap do progresso cloud em outro dispositivo

## Segurança
- [ ] não publicar `service_role`
- [ ] manter só `anon key` no front
- [ ] verificar que um aluno não consegue ler outro aluno
- [ ] verificar que professor só lê alunos da própria turma

## Teste mínimo de campo
- [ ] dispositivo A: jogar e sincronizar
- [ ] dispositivo B: entrar na mesma conta e carregar progresso
- [ ] confirmar que o snapshot veio da nuvem
- [ ] confirmar que o histórico recente não duplicou


## Atualização v15 — tentativas por questão
- Cada resposta do aluno agora gera um registro em `public.attempts`.
- O envio usa `client_attempt_id` único para evitar duplicação em retries de sync.
- Cada tentativa referencia a sessão cloud por `client_session_id`/`game_session_id`.
- Se o aluno estiver sem login no momento, a tentativa fica na fila local e sobe depois.
