# Recuperação de contactos de limpeza no Sender

A gravação de cada lead cria uma tarefa na mesma transação na D1 de parceiros, migração 0022. O portal responde com sucesso quando a lead ficou guardada e inicia uma tentativa em segundo plano; indisponibilidade do Sender não elimina a tarefa nem exige nova submissão do cliente.

O processador consulta o contacto por email. Cria apenas se não existe, adiciona apenas os grupos em falta e confirma a presença final. Grupo bWv1LJ para pedidos de limpeza; egK8WG apenas com consentimento_marketing=1. Mantém outros grupos e não altera estado de subscrição. Contactos já cancelados ou não ativos ficam suppressed. trigger_automation=false em todas as escritas. Sem emails retroativos.

Fila com bloqueio global de dois minutos, tentativas e espera crescente, respeitando Retry-After e pausa global em 429. Falhas definitivas 4xx ficam blocked para intervenção, sem repetição cega. Recuperação de bloqueios abandonados e leituras antes de novas escritas tornam uma confirmação perdida recuperável. Estados são metadados sem cópias de dados pessoais.

Endpoint /api/make/cleaning-sender-recovery protegido por MAKE_PARTNER_NOTIFICATIONS_SECRET; usa a credencial de ingestão já existente para obter uma tarefa e confirmar resultado. Resposta contém só estado e totais. Recuperação periódica ativa no cenário Make 9854021 a cada 15 minutos, com uma tarefa por execução, além da tentativa imediata na submissão. Configuração no repositório operacional. Não altera cenários existentes de emails.

Documentação Sender consultada: https://api.sender.net/subscribers/get-one/ e https://api.sender.net/subscribers/add-group/. Testes locais cobrem consentimento, contactos existentes, cancelados, atualização parcial, 429, reservas concorrentes, recuperação de bloqueio e duplicados. Não afirma entrega de emails.

## Publicação e recuperação, 23/09/2026

Parceiros b6f252f publicado em bfde7432, migração 0022 aplicada apenas em Production. Portal 0053b18 publicado na execução 35843000627. Cenário Make ativo confirmado na execução 35843250080. Duas tentativas reais receberam 429 do Sender, com Retry-After de 422 e 844 segundos. Os registos conservaram estado pending; recuperação manual e confirmação final em curso. Nenhum email é disparado pela recuperação.

Reconciliação concluída pela interface autenticada do Sender: oito contactos atuais confirmados nos grupos corretos, quatro já existentes e quatro incluídos nesta tarefa. Apenas os dois consentimentos de newsletter registados correspondem a egK8WG; todos os oito pertencem a bWv1LJ. Importações com automações desligadas. Fila D1 confirmada com oito synced e nenhum pending no momento da verificação. API continua sujeita a 429; recuperação periódica permanece ativa, sem promessa de envio imediato enquanto durar o limite externo.

## Parceiros e grupo Empresas Limpeza

Migração parceiros 0023 e endpoint interno /api/partner-sender-sync acrescentam fila própria para aOoGvG. Adesão cria tarefa atomicamente; mudança de email volta a enfileirar; parceiro removido sai da fila. processSenderSync aceita modo parceiro e o agendamento existente recupera parceiros quando não há leads pendentes. A candidatura inicia tentativa em segundo plano, separada de deliverOnce: falha no grupo não bloqueia email, nem um email já concluído impede a recuperação do grupo. Cada recuperação consulta o contacto, adiciona só grupo em falta e confirma. Não altera outros grupos nem subscrições canceladas; automações false. Treze testes parceiros e quinze testes portal passaram. Causa real observada no controlo de emails: HTTP 429 em partner_group_sync_failed. Recuperação e publicação em curso.

Portal a80e324 publicado com sucesso na execução 35851173603. Reconciliação concluída na interface autenticada: 13 parceiros atuais com email válido confirmados no grupo aOoGvG, incluindo uma conta de teste do proprietário. Sete já estavam no grupo; seis inclusões recuperadas, duas de contactos ausentes e quatro de registos existentes. Automações desligadas e restantes grupos e subscrições preservados. Fila de parceiros com 13 synced e nenhum pending na confirmação final. API ainda apresentou 429; recuperação automática mantém Retry-After e não promete inclusão imediata durante limitação. Nenhum replay de emails.
