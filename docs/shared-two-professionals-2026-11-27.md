# Contactos partilhados: máximo de dois profissionais

Data: 27/11/2026. Pedido do proprietário: aplicar a regra em toda a plataforma, termos, landings e comunicações.

## Fonte de verdade e comportamento

- Cada pedido permite no máximo duas aquisições. Contactos pagos e gratuitos ocupam as mesmas vagas. Preços mantidos: 2,80 € partilhado e 5 € exclusivo.
- A migração 0112 conta destinatários atuais e o comprador original de um exclusivo libertado. Um exclusivo reaberto passa a permitir apenas mais um destinatário. Não se apagam compras, acessos ou movimentos financeiros históricos, incluindo pedidos anteriormente obtidos por três profissionais.
- Guardas na base de dados impedem uma terceira aquisição, incluindo concorrência e inserção direta. Ao atingir duas aquisições, o pedido esgota e as ofertas restantes deixam de estar disponíveis.
- Inventário de carregamento, elegibilidade da Campanha Flash, pedidos disponíveis, recuperação/reabertura administrativa, estado do marketplace, notificações push e resumos usam a mesma contagem. Mínimos de pedidos e condições da campanha preservados.
- Os resumos recalculam a ocupação antes de enviar. Um pedido já obtido por um profissional mostra uma vaga restante. Pedidos esgotados não entram nos resumos.

## Textos e consentimentos

- Adesão, dashboard, carteiras, confirmação de compra, FAQ, catálogos de resposta, emails de parceiros e clientes, termos, privacidade e landings de limpeza geral e alojamento local passam a referir dois profissionais.
- Termos de parceiros: versão 2026-11-27.3. Novos consentimentos de clientes: limpeza-2026-11-d e alojamento-local-2026-11-c. Os textos de consentimentos históricos permanecem inalterados no arquivo.
- Rótulos do histórico de aquisições não passam a atribuir retroativamente um limite de dois a compras antigas.

## Validação local

Testes direcionados da compra atómica e bloqueio sem desconto; gratuito e pago ocupam as mesmas vagas; preservação de três compradores históricos; reabertura de exclusivos com uma vaga; inventário, estados administrativos, resumos, renderização de emails, versões de consentimento e envio das landings com integrações simuladas. Sem pagamentos nem emails reais de teste.

## Publicação

Fonte de parceiros b52a17a5. Migração 0112 aplicada e registada em produção. Publicação de produção concluída pelo Wrangler: edc72229. Portal dd2d342d0 enviado para main e publicação automática, incluindo landings, consentimentos, termos, privacidade e modelos de email. 30 testes direcionados da plataforma e 66 do portal passaram. Sintaxe dos ficheiros alterados e catálogos JSON válidos. Sem confirmação online posterior, de acordo com as regras do espaço de trabalho.

Os testes históricos gerais contêm expectativas anteriores sobre quatro gratuitos iniciais, a interface Premium retirada e uma frase já inexistente de apresentação ao cliente. Essas expectativas não foram usadas para alterar o comportamento atual; as verificações relevantes à alteração passaram, incluindo os novos testes de preservação de compras anteriores e entrega simulada de emails.
