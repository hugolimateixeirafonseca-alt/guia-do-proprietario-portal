# Alertas repetidos de email no Make, 07/10/2026

## Diagnóstico

O cenário 9739271 está ativo. As execuções originais podem aparecer como Success porque o módulo Retry guarda uma execução incompleta. Tentativas dessas execuções falham com HTTP 503 no endpoint /api/make/partner-lead-notification. Foram observadas tentativas a cada cinco minutos e registos com 72 tentativas. Não foram executados replays.

Consulta agregada, sem dados pessoais, do registo de entrega: 2903 enviados, 166 incertos por sender_response_unknown, 28 falhados e três em retry. Estes totais abrangem o registo de entrega, não apenas este cenário. Um resultado incerto significa que não se conhece o resultado do envio e deve ser revisto antes de qualquer reenvio.

## Alterações

- Make: opção Errors in scenario run desativada na organização. Warning, Scenario deactivation, Credit limit reached e Connection and key activity continuam ativas. Alteração confirmada na interface.
- Apenas o webhook partner-lead-notification passa a reconhecer com HTTP 200 os estados duráveis sending, uncertain e failed. Corpo mantém ok:false, review_required:true e retryable:false. Não declara entrega bem-sucedida e não altera o registo.
- Casos transitórios continuam a devolver erro e permitem nova tentativa. Preferências, autenticação, destinatário e deduplicação permanecem verificados. Outros endpoints mantêm o contrato anterior.
- Sem reenvio, remoção de histórico, alteração de saldos ou reativação de fluxos antigos.

## Validação e publicação

26 testes direcionados de entrega, webhook e acompanhamento aprovados. Correção enviada para publicação pelo fluxo normal do portal. Sem confirmação online posterior. A desativação dos emails de erro já está aplicada no Make; a interrupção das repetições terminais depende da publicação do portal. Envios incertos permanecem para revisão.
