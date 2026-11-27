# Emails automáticos da Campanha Flash

Renderer para BF-confirmation e BF-reminder, através do executor e endpoint Sender existentes. A aplicação de parceiros é a fonte de verdade das condições aceites, datas, contagem e elegibilidade. O endpoint de entrega revalida a política e substitui o snapshot antigo pelos dados e ligação pessoal atuais.

Confirmação após o pagamento da campanha, com as regras aceites e prazo de aquisição. Lembrete devido quatro dias antes do fim dos 15 dias, indicando o número atualizado de contactos em falta. O envio é suprimido pela política quando não se aplica. Não cria novo envio em massa nem altera o executor Make, preços ou reembolsos.

Handshake campaign_emails_v1:1 permite à aplicação de parceiros entregar estes dois modelos apenas depois de o renderer estar disponível. Também se elimina a promessa de gratuitos nas boas-vindas dos parceiros que os tenham suspensos na campanha.

Validação local: testes direcionados dos renderers e do endpoint Sender, sem qualquer envio real. Publicação pelo fluxo normal do repositório. Sem verificação do deployment ou confirmação online automática posterior.
