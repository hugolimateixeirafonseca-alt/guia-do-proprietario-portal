# Retirada de Premium e motivos de substituição, 27/11/2026

Pedido do proprietário: retirar tudo o que pertence ao Premium, incluindo Pedidos Premium, contador, perfis e aviso para rever a agenda. O formulário Problema com o contacto deve mostrar apenas os motivos acordados.

Plataforma: retirados menu, vista, painel administrativo oculto, editores, controlos, scripts/estilos e etiquetas de perfis. Leituras normais de parceiros e estatísticas deixam de consultar ou apresentar os campos Premium. O script antigo premium.js apenas limpa elementos de páginas eventualmente em cache, sem chamadas à API. APIs de parceiros, administração e ingestão encerradas com HTTP 410, preservando autenticação. O agendamento da agenda é removido, os eventos antigos são inelegíveis para envio e o despacho específico é desativado. Migração 0108 suprime apenas entregas pendentes/em processamento do produto, impede novas mensagens e novos pedidos Premium. Não apaga pedidos, perfis, compras, saldos ou emails enviados.

Contacto: os dois formulários mostram exatamente quatro opções: telefone desligado em dois dias úteis diferentes; WhatsApp com um único visto durante 72 horas; número não atribuído/inexistente; número sem WhatsApp quando esse foi o canal escolhido. Ambos usam a mesma API de garantia, com declaração obrigatória, critérios de tempo/canal e pagamento e exclusão da Campanha Flash. Os motivos antigos deixam de ser aceites em novas submissões. As situações já registadas permanecem no histórico. A ausência de WhatsApp exige preferência expressa do cliente por WhatsApp. Opções ainda inelegíveis ficam desativadas, com prazo apresentado quando aplicável. Nova coluna situacao_contacto e triggers mantêm o motivo preciso e imutável.

Termos 2026-11-27.2 e regras atualizados para os quatro casos. Emails e respostas administrativas deixam de prometer substituições por outros motivos. Sem mudança de preços ou do número de compradores.

Portal: /pedir-limpeza/ e /limpeza-regular-lisboa-margem-sul/ passam para /servicos-limpeza/#pedido, preservando parâmetros de atribuição e sem transportar ligações de recuperação descontinuadas. landing.js antigo também encaminha páginas em cache. API de perfis/retoma e submissão dirigida retiradas. Entregas antigas e renderização de emails Premium bloqueadas. Cópias dos emails normais sincronizadas com as regras atuais, sem reenviar emails.

Validação: 21 testes direcionados na plataforma e 60 no portal aprovados. Incluem regras de tempo, canais, campanha, quatro opções, autenticação, APIs retiradas, bloqueio de filas, diretório/estatísticas, redirecionamento com UTMs, rejeição da submissão antiga e proteção dos envios. Sintaxe e diff verificados. Sem build integral local de rotina e sem verificações online posteriores.

Estado: implementação local validada; publicação da plataforma e envio do portal em preparação.
