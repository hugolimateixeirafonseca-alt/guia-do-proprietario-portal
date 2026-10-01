# Confirmação do pedido de limpeza

A landing /servicos-limpeza/ apresenta um sexto passo após Pedir preço e disponibilidade. O resumo mostra as preferências atuais. A caixa de compromisso de resposta começa desmarcada e ativa Confirmar e receber orçamentos. Alterar preferências conserva os dados e exige nova confirmação. O pedido só chega à API após confirmação explícita.

Mantidos os consentimentos existentes, o payload e a proteção contra envios duplicados e novas tentativas. Sem alterações à landing de alojamento local ou ao backend.

Validação: testes locais de confirmação e deduplicação, sintaxe JavaScript e compilação isolada do ficheiro Astro. Nenhum pedido real ou email de teste enviado. O envio para main inicia o fluxo normal de publicação; a confirmação online fica a cargo do utilizador.

## Correção da cache

O utilizador reportou envio direto após a primeira publicação. A página pública continha a confirmação, mas o script usava um URL fixo com Cache-Control public, must-revalidate, max-age=14400 (quatro horas), observado a 01/10/2026 às 14:39 UTC. Isto permite ao navegador combinar HTML novo com JavaScript antigo. Não foi inspecionada a cache do navegador do utilizador; é uma causa compatível com o relato.

O script foi movido para src e importado através de um script processado por Astro. O fluxo normal de publicação passa a gerar um recurso identificado pelo conteúdo, evitando reutilizar o URL antigo e dispensando versões manuais. Testes existentes atualizados para o novo caminho. Sem envios reais. Validação local direcionada; publicação não confirmada online após o envio.
