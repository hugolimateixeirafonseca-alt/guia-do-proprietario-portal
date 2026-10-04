# Data de início a combinar, 04/10/2026

## Alteração autorizada

Retirada a opção «Estou só curioso(a) sobre os preços» da landing de limpeza. No seu lugar, «A combinar com o profissional de limpeza», como resposta à pergunta sobre quando precisa da limpeza.

A nova escolha é guardada em inicio_pretendido=flexible e apresentada corretamente nos cartões disponíveis, obtidos, detalhes administrativos e dados dos emails. O campo de urgência legado conserva um valor compatível com o CHECK da base de dados; a apresentação usa a escolha original, sem prometer início na próxima semana. As consultas da área de parceiro e do admin incluem a escolha original.

Retiradas as indicações sobre comparar preços dos cartões da plataforma e dos emails, incluindo HTML e texto simples. Pedidos antigos conservam o histórico e continuam sujeitos às regras normais de disponibilidade. Não há migração nem alteração de saldos, compras, campanhas, agregação de pedidos ou deduplicação de emails. A API aceita ainda compare_prices para compatibilidade com submissões antigas em fila.

## Validação

Testes dirigidos de formulário, encaminhamento, consentimentos, normalização, projeção SQL, cartões e emails. Página Astro compilada isoladamente sem diagnósticos. Sintaxe e diff verificados. Sem build integral nem verificação online automática.

## Publicação

Plataforma: publicação direta em Cloudflare Pages. Landing e modelo efetivo dos emails: enviados pelo fluxo normal de publicação do portal. Confirmação visual e funcional online pelo proprietário.
