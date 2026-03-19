# Ajustes v18 — acesso do professor com cadastro, senha e recuperação

## O que mudou
- O ícone do professor agora exige autenticação antes de abrir o painel.
- Primeiro acesso do professor:
  - pede a senha provisória `bondadejfa`
  - coleta nome completo, escola, turma, e-mail e nova senha
  - cria o cadastro do professor na nuvem
- Acesso normal do professor:
  - exige e-mail + senha cadastrados
  - se a senha estiver errada, o painel não abre
- Recuperação de senha do professor:
  - envia link para redefinir senha no e-mail cadastrado
  - fluxo separado do estudante
- O painel do professor é encerrado com logout do professor ao fechar.

## Regras implementadas
- Sem senha correta do professor, não há acesso à área do professor.
- Conta de professor sem cadastro válido em `teacher_profiles` não entra no painel.
- O acesso do professor usa cliente Supabase separado do aluno.

## Banco (Supabase)
- Nova tabela: `teacher_profiles`
- Nova função RPC: `register_teacher_access(...)`
- RLS adicionada para `teacher_profiles`

## Observação importante
A senha provisória `bondadejfa` ficou hardcoded no front-end porque foi exigida assim.
Isso funciona como barreira inicial, mas não é seguro como controle definitivo.
O ideal futuro é mover essa autorização inicial para backend ou painel admin.
