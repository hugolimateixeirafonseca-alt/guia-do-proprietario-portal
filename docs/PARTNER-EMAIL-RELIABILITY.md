# Recuperação e duplicados de limpeza

## Submissões

As duas landings mantêm o eventId nas tentativas do mesmo conteúdo e bloqueiam duplo envio em curso. No serviço de parceiros, a migração 0019 e a inserção atómica impedem pedidos integralmente iguais dentro de 30 minutos. Dados de serviço diferentes são preservados. Não houve limpeza retroativa: o proprietário removeu o pedido repetido.

## Emails

EMAIL_DELIVERY_DB é uma base própria (guia-proprietario-partner-email-delivery), sem alterações à base de consentimentos. Guarda identificador do evento, hash do destinatário, estado, tentativas, prazo e código HTTP. Não guarda destinatários em claro, mensagens ou ligações de acesso. A migração está em migrations/partner-email/0001_delivery.sql.

Uma reserva atómica impede envios simultâneos ou repetidos do mesmo evento. Confirmação aceite pelo Sender passa a sent; não confirma chegada à caixa de entrada. Falhas de grupo anteriores ao envio podem repetir. Recusa explícita 429 aplica espera crescente e Retry-After; máximo seis tentativas. Falhas 4xx permanentes ficam failed. Timeout ou 5xx no envio e falha de persistência após envio ficam para revisão, sem reenvio automático, porque o Sender não documenta uma chave idempotente para este endpoint.

Make: ativar execuções incompletas e Retry no módulo HTTP após publicar a proteção. Não reproduzir execuções históricas em massa: primeiro cruzar o histórico Sender. Estados sending/uncertain requerem confirmação no fornecedor antes de qualquer alteração para retry. O registo não deve ser apagado para tentar reenviar.

Testes locais com SQLite e fetch simulado cobrem concorrência, repetição, destinatário incompatível, 429, falha de rede, falha de gravação após sucesso e formulários. Sem envio de emails reais de teste.

Estado inicial: migração dedicada aplicada; implementação e formulários preparados, publicação pendente.

## Publicação e causa confirmada

Parceiros 1d66b71 publicado em Production 2ac88a18, migração 0019 aplicada. Portal 603a1ef publicado com sucesso no job 35792523891. O novo registo identificou seis notificações recusadas pelo Sender com HTTP 429, cinco no envio e uma no grupo; Retry-After observado de cerca de 223 a 224 segundos. A causa concreta das falhas atuais é limitação de pedidos no fornecedor, antes escondida pelo 502 genérico.

Make confirmado no job 35792744390: execuções incompletas ativas, sem descarte, seis tentativas a cada cinco minutos, sem bloquear destinatários seguintes, mapeamentos/webhook preservados. Preferências de aviso, erro e desativação já estavam ativas. Não foram reproduzidas execuções históricas pelo agente.

Pausa global acrescentada em a05e5dc, migração 0002 aplicada apenas na base dedicada. Novos destinatários aguardam o prazo imposto pelo Sender, sem gastar tentativas enquanto a pausa está ativa. Publicação em curso no job 35793222397. Testes direcionados passaram; nenhuma verificação pública posterior nem envio de email de teste.
