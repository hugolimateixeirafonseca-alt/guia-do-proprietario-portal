# Confirmação do pedido de limpeza

A landing /servicos-limpeza/ apresenta um sexto passo após Pedir preço e disponibilidade. O resumo mostra as preferências atuais. A caixa de compromisso de resposta começa desmarcada e ativa Confirmar e receber orçamentos. Alterar preferências conserva os dados e exige nova confirmação. O pedido só chega à API após confirmação explícita.

Mantidos os consentimentos existentes, o payload e a proteção contra envios duplicados e novas tentativas. Sem alterações à landing de alojamento local ou ao backend.

Validação: testes locais de confirmação e deduplicação, sintaxe JavaScript e compilação isolada do ficheiro Astro. Nenhum pedido real ou email de teste enviado. O envio para main inicia o fluxo normal de publicação; a confirmação online fica a cargo do utilizador.
