# Executor Sender da newsletter de parceiros

Extensão do executor existente com uma fila de newsletter independente, reclamada apenas com newsletter_version:1. A aplicação de parceiros mantém o consentimento e a auditoria como fonte de verdade. O grupo GP | Parceiros | Newsletter e patrocinados é encontrado ou criado automaticamente na primeira autorização sincronizada, sem credenciais novas e sem enviar mensagens ou disparar automações.

A inclusão/remoção revalida a escolha no backend de parceiros e respeita cancelamentos/bounces/spam. A retirada remove só este grupo, sem bloquear transacionais, SMS ou outros grupos. Alterações de email produzem tarefas para limpar o endereço antigo. Estatísticas do processo incluem a nova fila. O endpoint de recuperação e o processo periódico já existentes continuam a executar a sincronização; não há novo cenário Make.

A política de privacidade descreve a opção facultativa na adesão e a retirada no perfil. Os parceiros antigos não são inscritos automaticamente. Nenhuma newsletter foi enviada. Testes direcionados do fornecedor e da entrega existente passaram com serviços simulados.

Publicação pelo fluxo normal do portal, depois da migração 0111 na base de parceiros. Sem confirmação online posterior ou prova de entrega/grupo criada nesta tarefa.
