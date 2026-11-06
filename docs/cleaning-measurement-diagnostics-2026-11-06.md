# Diagnóstico da medição dos pedidos de limpeza

Em 06/11/2026, a base de parceiros confirmou 12 pedidos distintos com UTM Lisboa entre 04 e 06/11 na consulta efetuada. As capturas Meta mostram seis eventos de navegador e seis via Conversions API with Meta; a cobertura apresentada é média de sete dias. Não se podem tratar os doze envios como doze conversões únicas, nem provar a causa da diferença com estes totais. A integração gerida pela Meta foi identificada como ativa; não foi alterada e não foi criado um segundo envio CAPI.

## Implementação

A landing geral usa um helper que só invoca Lead com autorização de medição válida, mantém o eventID da submissão e impede que uma exceção do Pixel transforme um pedido guardado em erro no formulário. A escolha de newsletter não autoriza medição. A identidade de retry exclui o estado transitório do Pixel.

Após confirmar a gravação de um pedido de limpeza, subscribe escreve uma linha idempotente em cleaning_measurement_diagnostics na CONSENT_ARCHIVE_DB. Guarda apenas a chave opaca da evidência existente, hora original, segmento, escolha de medição (accepted/refused/unset/invalid) e disponibilidade declarada da função fbq ao submeter (callable/missing/unknown). Não inclui contactos, cookies, IP, URL ou identificadores de anúncios. AL usa unknown até existir uma declaração do browser. Falhas de diagnóstico não impedem a receção do pedido. Uma escrita por pedido e nenhuma operação adicional no Make.

O estado callable NÃO comprova que fbevents.js carregou ou que a Meta recebeu o evento. Invocar fbq pode apenas enfileirar. Este diagnóstico permite separar elegibilidade/recusa de disponibilidade da função; a entrega ainda exige reconciliação na Meta. Não reconstrói consentimentos históricos nem reenvia os eventos de 04–06/11.

## Migração e consulta

Aplicar apenas migrations/consent-archive/0002_cleaning_measurement_diagnostics.sql na base guia-proprietario-consentimentos. A tabela é aditiva, sem modificar a evidência original.

```sql
SELECT date(created_at) dia, source, measurement_choice, browser_pixel_state, count(*) pedidos
FROM cleaning_measurement_diagnostics
GROUP BY date(created_at),source,measurement_choice,browser_pixel_state
ORDER BY dia;
```

## Validação e publicação

45 testes direcionados aprovados, incluindo a receção do formulário, idempotência, recusa/expiração do consentimento, indisponibilidade e erro do Pixel e falha de armazenamento do diagnóstico. Frontend e endpoint validados por compilação isolada, sem build local integral. A publicação segue o envio do commit à main; não há confirmação pública automática após o envio.