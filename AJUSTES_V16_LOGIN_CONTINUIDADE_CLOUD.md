# AJUSTES V16 — Login do estudante + continuidade entre dispositivos

## O que foi corrigido

### 1) Conquistas voltou a clicar
O botão de conquistas estava sobrescrevendo a própria função global de abertura.
Resultado: o clique caía em autochamada bloqueada e o modal não abria.

Correção aplicada:
- removida a sobrescrita incorreta de `window.openPetAchievementsModal`
- mantido apenas o alias seguro `window.openPetAchievementsModalSafe`

### 2) Continuidade real entre dispositivos
Antes, a nuvem sincronizava bem o progresso agregado, mas não fechava totalmente o caso de **retomar uma sessão em andamento em outro aparelho**.

Agora o app passa a sincronizar também o **snapshot da sessão atual**, junto do progresso cloud.

### 3) Fluxo implementado
- estudante entra com e-mail e senha
- perfil local é vinculado à conta online
- o snapshot local composto passa a incluir:
  - progresso do aluno
  - sessão em andamento (`currentSession`)
- esse snapshot sobe para `student_progress.snapshot`
- ao abrir o app em outro dispositivo e entrar na mesma conta:
  - o snapshot cloud é comparado com o local
  - se o cloud estiver mais recente, ele é baixado
  - o progresso local é restaurado
  - a sessão em andamento é restaurada
  - o botão **Continuar** volta a apontar para o ponto onde o aluno parou

### 4) Skill mastery
A tabela `skill_mastery` agora é atualizada automaticamente no banco a partir das linhas inseridas em `attempts`.

Foi adicionado:
- função `compute_skill_mastery_status(...)`
- função `apply_attempt_to_skill_mastery()`
- trigger `trg_attempts_apply_skill_mastery`

## Arquivos alterados
- `script.js`
- `js/pet-local-driver.js`
- `js/pet-bridge.js`
- `js/pet-cloud-driver.js`
- `supabase-schema.sql`

## Observação importante
Para a continuidade funcionar entre dispositivos, o projeto precisa estar com:
- `supabaseUrl`
- `supabaseAnonKey`
- schema atualizado no Supabase
- login do estudante feito com a mesma conta em ambos os dispositivos
