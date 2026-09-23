# Atribuição de anúncios nas leads de limpeza

As duas landings de limpeza já enviam pageUrl com a URL de submissão. subscribe.ts extrai utm_content e utm_campaign através de cleaning-attribution.mjs e encaminha-os para a ingestão de parceiros. Apenas esses valores são adicionados, até 500 caracteres; URLs inválidas ou parâmetros ausentes devolvem null. Não altera consentimentos nem expõe parâmetros no dashboard.

Dependência de publicação: migração parceiros 0021_lead_utm_attribution.sql e API que grava as duas colunas na tabela leads da D1 guia-do-proprietario-parceiros. Registos históricos não são preenchidos retroativamente. Os links dos anúncios devem incluir os parâmetros para haver atribuição. Validação: dois testes do extrator e compilação isolada de subscribe.ts; 19 testes de ingestão, normalização e duplicados no projeto parceiros.
