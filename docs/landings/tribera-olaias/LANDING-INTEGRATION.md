# LANDING-INTEGRATION — Tribera Olaias

Nome da landing: Tribera Lisbon Olaias
Objetivo: Encaminhar estudantes e pais interessados para a reserva da Tribera Lisbon Olaias
URL ou rota prevista: /tribera-olaias/
Identificador sugerido: tribera_olaias
Origem da lead: Não existe lead recolhida nesta landing; conversão é clique de saída para a Tribera
Campos recolhidos: Nenhum
Campos obrigatórios: Nenhum
Campos opcionais: Nenhum
Texto exato de cada consentimento: Não aplicável
Consentimentos obrigatórios: Nenhum
Consentimentos opcionais: Nenhum
O que o utilizador recebe: Informação resumida sobre a residência, tipologias, preços base, comodidades e vantagem comercial da parceria
O que acontece depois da submissão: Não existe submissão. O utilizador é encaminhado para o sistema de reservas da Tribera
Evento de conversão pretendido: nenhum evento Lead ou Contact. Recomenda-se medir separadamente o clique outbound `tribera_booking_click`, se a infraestrutura de analytics o suportar
Grupo do Sender pretendido, se já estiver decidido: Não aplicável
Necessita de código postal e localidade: não
Necessita de envio para parceiro: não, porque o utilizador segue diretamente para a Tribera
Parâmetros de campanha esperados: o link outbound usa `utm_source=guiadoproprietario`, `utm_medium=referral`, `utm_campaign=tribera_olaias`. UTMs de entrada são preservados com prefixo `gp_` no destino para não substituir a identificação do parceiro
Mensagem de sucesso: Não aplicável
Mensagem de erro técnico: Não aplicável

## Antes de publicar

- Substituir `bookingUrl` pelo link de tracking específico fornecido pela Tribera, assim que existir.
- Se a Tribera fornecer um código promocional/identificador da parceria, decidir se deve ser mostrado na página e/ou incorporado no link.
- Confirmar com a Tribera que a vantagem de 80 € no momento da reserva, em vez de 230 €, está ativa e que a atribuição através do link/código é suficiente para a aplicar.
- Confirmar disponibilidade e preços atuais. A landing mostra os preços base publicados de 819 €/mês para Duo Apartment e 869 €/mês para Studio e não replica a promoção relâmpago de 100 €/mês, cuja validade publicada terminava às 23h59 de 23 de agosto de 2026.
- Confirmar se o parceiro autoriza hotlink das fotografias ou, em alternativa, guardar cópias aprovadas no repositório/CDN do Guia do Proprietário.
- Rever o texto de transparência da parceria depois da assinatura/validação final do acordo.

## Medição sugerida

A landing não dispara `Lead` nem `Contact`, porque não recolhe um contacto. O evento útil é o clique para a reserva. Esse evento não deve ser confundido com uma reserva concluída. A confirmação de reserva/check-in deverá vir da Tribera através do mecanismo de atribuição acordado.

## Fotografias

A versão inicial usa diretamente fotografias publicadas na página oficial da Tribera Lisbon Olaias. Antes de produção é preferível ter confirmação do parceiro para reutilização e, idealmente, servir versões otimizadas a partir do domínio do Guia do Proprietário.
