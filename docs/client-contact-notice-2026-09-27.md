# Email ao cliente após aceitação, 27/09/2026

Modelo contact_accepted com audience client, destinatário confirmado pela política do evento. Nome comercial e telefone só são enviados mediante autorização do profissional; a aplicação volta a validar antes de entregar. Os campos históricos partner_email/partner_name do transporte passam a representar o destinatário do evento, sem alterar eventos antigos. A política de parceiros é mantida para os emails aos parceiros; no email ao cliente é a política do evento que confirma destinatário, autorização e pedido atual. Nenhum acesso privado do parceiro é incluído.

Email simples com ligação assinada para parar contactos, confirmação por POST na aplicação. GET e filtros de segurança de email nunca alteram o pedido. O assunto e a exclusividade são condicionais. Sem seguimento de 48h, reabertura pelo cliente ou devoluções automáticas.

Handshake client_contact_notice=1 impede o consumo da fila cliente por um renderer antigo. Sender mantém entrega única, controlo de chamadas e revisão de respostas ambíguas. Dez testes direcionados do Portal aprovados com envios simulados, sem emails reais.
