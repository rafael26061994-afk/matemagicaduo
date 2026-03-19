# Ajustes v17 — recuperação de senha e isolamento de perfis

## O que entrou
- botão **Recuperar senha** no bloco de conta online
- envio de recuperação para o **e-mail cadastrado**
- fluxo de **definir nova senha** ao voltar pelo link de recuperação
- mensagem específica para **senha incorreta**
- bloqueio para **editar perfil de outro aluno sem entrar com o PIN correto**
- isolamento da sessão cloud em **dispositivo compartilhado**

## Regras aplicadas
- perfil local sem vínculo cloud **não reaproveita** sessão cloud antiga de outro aluno
- perfil local vinculado a uma conta cloud **não aceita** outra conta online por cima
- visitante **não sincroniza**
- login cloud errado em perfil já vinculado a outro aluno é recusado
- sincronização automática não cria vínculo cloud silencioso em perfil não vinculado

## Recuperação de senha
- o botão **Recuperar senha** envia o link para o e-mail digitado
- ao abrir o link, o app mostra a tela para **definir nova senha**
- a nova senha precisa ter pelo menos **8 caracteres**

## Mensagem para senha incorreta
- ao errar a senha, o app mostra:
  - que a senha está incorreta
  - que o aluno deve tentar novamente
  - que pode usar **Recuperar senha**

## Observação
- para continuar de qualquer dispositivo com segurança, cada aluno precisa:
  1. entrar no próprio perfil local com PIN
  2. entrar na própria conta online
  3. vincular o perfil local quando ainda não estiver vinculado
