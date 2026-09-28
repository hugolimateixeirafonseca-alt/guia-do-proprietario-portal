# Grupos Sender para limpeza

Pedido de 22/09/2026. Novas candidaturas de empresas e profissionais independentes entram no grupo aOoGvG ao processar application no circuito autenticado Make â†’ portal â†’ Sender, antes do email de candidatura. O aviso administrativo nÃ£o subscreve o administrador. Lookup/criaÃ§Ã£o e associaÃ§Ã£o de grupo suportam contactos existentes e repetiÃ§Ãµes; nÃ£o alteram o estado de subscriÃ§Ã£o nem disparam automaÃ§Ãµes de grupo. Falhas devolvem 502 para o circuito de reenvio.

Nas duas landings de limpeza, apÃ³s guardar o consentimento e o pedido no dashboard, o primeiro opt-in associa bWv1LJ. Consentimento opcional de newsletter associa tambÃ©m egK8WG. MantÃªm-se os outros grupos de contactos existentes e os percursos dos restantes produtos. NÃ£o Ã© criada autorizaÃ§Ã£o de newsletter quando apenas o primeiro opt-in foi aceite. NÃ£o hÃ¡ importaÃ§Ã£o retroativa nem contactos reais de teste nesta tarefa.

ValidaÃ§Ã£o local: testes de novos e existentes, ambos os consentimentos, falha de sincronizaÃ§Ã£o, destinatÃ¡rios e preservaÃ§Ã£o dos outros percursos. PublicaÃ§Ã£o pelo workflow normal do portal, sem verificaÃ§Ã£o online posterior.


## Correção de subscrição dos parceiros, 28/09/2026

A fila autenticada fornece consentimento_email derivado do registo de adesão. Contactos do parceiro sem subscrição de email podem passar a ACTIVE com consentimento, sem disparar automações. Cancelamentos, devoluções e denúncias de spam são preservados, bem como os estados transacionais e SMS. O grupo continua a ser aOoGvG. Uma rejeição 400 do endpoint de grupos usa PATCH individual com união dos grupos existentes e confirmação posterior. A recuperação autenticada suporta partnersOnly e até cinco tarefas por chamada, sem processar leads ou PDFs. A ausência de metadados novos em parceiros aprovados anteriores a 24/09 segue a confirmação do titular de que consentiram na adesão; não é criado um consentimento retroativo na base.
