# Arquitetura PET + Supabase

## Núcleo da decisão

O PET continua **offline-first**, mas passa a ter **persistência cloud opcional** por conta do aluno.

### Camadas

1. **UI atual**
   - `index.html`
   - `script.js`
   - sem reescrita visual agora

2. **Local driver**
   - continua usando `localStorage` por perfil local
   - mantém compatibilidade com o projeto atual

3. **Auth**
   - conta online do aluno via Supabase Auth

4. **Cloud driver**
   - escreve no Postgres via Supabase Data API

5. **Sync queue**
   - enfileira progresso e sessão quando não há internet ou login

6. **RLS**
   - garante que cada aluno veja só os próprios dados
   - professor vê apenas os alunos das suas turmas

## Tabelas principais

### `profiles`
Papel global do usuário autenticado.

Campos:
- `auth_user_id`
- `role`
- `display_name`
- `created_at`
- `updated_at`

### `student_profiles`
Cadastro pedagógico do aluno dono da conta.

Campos:
- `id`
- `auth_user_id`
- `display_name`
- `school_name`
- `turma_label`
- `grade_year`
- `avatar_url`
- `active`
- `created_at`
- `updated_at`

### `student_device_links`
Permite um mesmo aluno usar vários dispositivos sem forçar o mesmo `device_profile_id`.

Campos:
- `id`
- `student_profile_id`
- `device_profile_id`
- `device_label`
- `last_seen_at`
- `created_at`
- `updated_at`

### `classes`
Turmas de professor.

### `student_enrollments`
Matrícula aluno ↔ turma.

### `student_progress`
Snapshot consolidado para o front carregar rápido.

### `game_sessions`
Histórico de sessões finalizadas.

### `attempts`
Granularidade por questão/respondida.

### `skill_mastery`
Domínio por habilidade/operação.

## Estratégia de sincronização

### Local continua sendo a escrita imediata
- o aluno joga
- o app salva localmente
- o app adiciona evento na fila

### Nuvem entra como continuidade
- quando existir sessão autenticada, a fila é processada
- progresso vira `student_progress`
- sessão vira `game_sessions`

## Regra de segurança central

- **anon key** apenas no front
- **service role** nunca no navegador
- todas as tabelas do `public` com RLS

## Critério de bootstrap cloud

No login de uma conta online:
1. garante `student_profile`
2. vincula `device_profile_id`
3. baixa `student_progress`
4. compara timestamp cloud vs local
5. se cloud estiver mais novo, substitui snapshot local
6. tenta trazer sessões recentes sem duplicar

## O que ainda falta para fechar 100%

- interceptar respostas individuais no motor e gravar em `attempts`
- popular `skill_mastery` automaticamente por etapa/habilidade
- painel real do professor consumindo Supabase em vez de só dados locais


## Atualização v15 — tentativas por questão
- Cada resposta do aluno agora gera um registro em `public.attempts`.
- O envio usa `client_attempt_id` único para evitar duplicação em retries de sync.
- Cada tentativa referencia a sessão cloud por `client_session_id`/`game_session_id`.
- Se o aluno estiver sem login no momento, a tentativa fica na fila local e sobe depois.
