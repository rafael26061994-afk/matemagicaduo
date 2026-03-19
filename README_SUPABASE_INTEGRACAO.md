# PET + Supabase — arquitetura pronta (v2)

Este pacote agora contém a **base real** da integração com Supabase para o PET.

## O que entrou de fato

### Banco e segurança
- `supabase-schema.sql`
  - tabelas do aluno, progresso, sessões, tentativas, domínio por habilidade, turmas e matrículas
  - funções auxiliares de segurança
  - trigger para criar `profiles` ao cadastrar usuário no Auth
  - políticas RLS para aluno, professor e admin

### Camada JavaScript adicionada
- `js/pet-config.js`
- `js/pet-config.example.js`
- `js/pet-local-driver.js`
- `js/pet-auth.js`
- `js/pet-cloud-driver.js`
- `js/pet-sync.js`
- `js/pet-repositories.js`
- `js/pet-bridge.js`

## O que esta camada resolve

1. mantém o app **offline-first**
2. preserva o **perfil local por dispositivo**
3. adiciona **conta online** para backup e continuidade entre dispositivos
4. separa **dados locais** de **persistência cloud**
5. prepara o caminho para **professor / turma / relatórios**

## Modelo de acesso

### Aluno
Pode:
- ver e editar o próprio `student_profile`
- ver e editar o próprio `student_progress`
- inserir e consultar as próprias `game_sessions`
- inserir e consultar as próprias `attempts`
- ver o próprio `skill_mastery`
- ver as próprias turmas em `classes` via matrícula

Não pode:
- ver dados de outro aluno
- mudar o próprio papel para professor/admin
- usar chave `service_role`

### Professor
Pode:
- criar e editar as próprias `classes`
- gerenciar `student_enrollments` das próprias turmas
- ler progresso, sessões, tentativas e domínio dos alunos vinculados às suas turmas

Não pode:
- ver turmas de outro professor
- alterar dados fora das próprias turmas

### Admin
Pode:
- ver tudo
- promover papéis
- operar manutenção

## Passo a passo de implantação

### 1) Criar projeto no Supabase
- criar um projeto novo
- habilitar Auth por e-mail/senha
- abrir o SQL Editor
- rodar `supabase-schema.sql`

### 2) Configurar o front
Preencha `js/pet-config.js` com:
- `supabaseUrl`
- `supabaseAnonKey`

Ou copie `js/pet-config.example.js` para `js/pet-config.js`.

### 3) Promover conta de professor/admin quando precisar
Exemplo:

```sql
update public.profiles
set role = 'teacher'
where auth_user_id = 'UUID_DO_USUARIO';
```

### 4) Fluxo atual do PET
O `index.html` já carrega os scripts da camada Supabase antes de `script.js`.

Hoje o que já fica funcional sem refatorar a UI inteira:
- cadastro online
- login online
- vínculo do perfil local com a conta online
- fila local de sincronização
- sincronização do snapshot de progresso
- sincronização do histórico de sessões
- bootstrap básico do progresso cloud para o dispositivo atual

## Limite honesto

Isto é **arquitetura pronta e encaixada**, não migração total do monólito.

O `script.js` principal já conversa com:
- `window.PETAuth`
- `window.PETRepositories`
- `window.PETSync`
- `window.PETBridge`

Mas ainda não grava **cada tentativa individual** no banco porque isso exigiria interceptar o ponto exato de resposta no motor principal.
A estrutura já está preparada para isso no schema (`attempts`).

## Próximo passo técnico correto

1. validar login e vínculo do perfil local
2. validar sync do progresso e das sessões
3. só depois ligar gravação de `attempts` e `skill_mastery`

Isso evita quebrar o jogo inteiro por tentar migrar tudo de uma vez.


## Atualização v15 — tentativas por questão
- Cada resposta do aluno agora gera um registro em `public.attempts`.
- O envio usa `client_attempt_id` único para evitar duplicação em retries de sync.
- Cada tentativa referencia a sessão cloud por `client_session_id`/`game_session_id`.
- Se o aluno estiver sem login no momento, a tentativa fica na fila local e sobe depois.
