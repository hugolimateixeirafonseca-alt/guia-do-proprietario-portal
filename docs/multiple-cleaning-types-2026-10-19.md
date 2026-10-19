# Várias modalidades no formulário de limpeza

19/10/2026. O proprietário pediu seleção simultânea, por exemplo Regular + Profunda, e confirmou que apenas parceiros que prestem todas as modalidades devem receber o pedido.

A landing /servicos-limpeza/ usa caixas de seleção visíveis, exige pelo menos uma modalidade, mostra a combinação no resumo e envia uma única submissão confirmada. A API valida e normaliza serviceTypes, preservando serviceType para compatibilidade, e encaminha service_types para a plataforma. A plataforma guarda a combinação e aplica a correspondência integral antes da aquisição e das notificações. Uma frequência comum mantém-se; o cliente pode descrever diferenças na informação adicional. O percurso de alojamento local, consentimentos, notas, submissão única e encaminhamento durável não são alterados.

O modelo legado de confirmação da aquisição também apresenta todas as modalidades. O formato V2 usa os labels completos produzidos pela plataforma.

Validação: 57 testes direcionados do formulário, confirmação, deduplicação, subscribe e renderização de emails aprovados. Sem build integral local: o fluxo normal de publicação Git/Cloudflare executa o build final. A base e o backend dos parceiros devem ser publicados primeiro. Envio para main não constitui confirmação online; a confirmação visual e funcional é feita pelo proprietário.

Fonte complementar: guia-do-proprietario-parceiros/docs/multiple-cleaning-types-2026-10-19.md.
