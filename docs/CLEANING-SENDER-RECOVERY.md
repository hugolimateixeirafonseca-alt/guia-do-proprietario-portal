# Recuperação de contactos de limpeza no Sender

A gravação de cada lead cria uma tarefa na mesma transação na D1 de parceiros, migração 0022. O portal responde com sucesso quando a lead ficou guardada e inicia uma tentativa em segundo plano; indisponibilidade do Sender não elimina a tarefa nem exige nova submissão do cliente.

O processador consulta o contacto por email. Cria apenas se não existe, adiciona apenas os grupos em falta e confirma a presença final. Grupo bWv1LJ para pedidos de limpeza; egK8WG apenas com consentimento_marketing=1. Mantém outros grupos e não altera estado de subscrição. Contactos já cancelados ou não ativos ficam suppressed. trigger_automation=false em todas as escritas. Sem emails retroativos.

Fila com bloqueio global de dois minutos, tentativas e espera crescente, respeitando Retry-After e pausa global em 429. Falhas definitivas 4xx ficam blocked para intervenção, sem repetição cega. Recuperação de bloqueios abandonados e leituras antes de novas escritas tornam uma confirmação perdida recuperável. Estados são metadados sem cópias de dados pessoais.

Endpoint /api/make/cleaning-sender-recovery protegido por MAKE_PARTNER_NOTIFICATIONS_SECRET; usa a credencial de ingestão já existente para obter uma tarefa e confirmar resultado. Resposta contém só estado e totais. Recuperação periódica prevista num cenário Make separado a cada 15 minutos, com uma tarefa por execução, além da tentativa imediata na submissão. Configuração no repositório operacional. Não altera cenários existentes de emails.

Documentação Sender consultada: https://api.sender.net/subscribers/get-one/ e https://api.sender.net/subscribers/add-group/. Testes locais cobrem consentimento, contactos existentes, cancelados, atualização parcial, 429, reservas concorrentes, recuperação de bloqueio e duplicados. Não afirma entrega de emails.
