# PDF Casa de Banho

## Recuperação de falhas Sender, 23/09/2026

Publicado no portal em `6676703`, execução de produção `35859967346` concluída com sucesso. A falha real observada foi `marketing_lookup_429`, antes da associação ao Sender e do envio do PDF.

- O opt-in válido grava consentimento cifrado e uma tarefa persistente antes de responder. A resposta confirma a receção do pedido, não uma entrega de email inexistente.
- Migração `0002_pdf_delivery_jobs.sql` aplicada na base exclusiva deste produto. A tarefa guarda apenas a referência ao arquivo cifrado, hash e estado, nunca o email em claro.
- Página de confirmação com ligação direta para abrir e guardar o PDF enquanto o email aguarda.
- Tentativa imediata em segundo plano e recuperação pelo cenário Make `9854021`, a cada 15 minutos. Limite do Sender partilhado com sincronização de limpeza e emails de parceiros, com espaçamento e respeito por Retry-After.
- Reserva atómica e registo de entrega impedem duplicados em recuperações concorrentes. Rejeição 429 pode ser retomada; resposta perdida ou envio incerto exige revisão.
- As escolhas originais e grupos de cada produto mantêm-se. A associação não dispara automações de outros kits. CompleteRegistration passa a medir o pedido aceite e guardado, com a autorização de medição existente e deduplicação Pixel/CAPI. O evento pdf_sent continua a significar aceitação real do envio pelo fornecedor.
- Recuperação histórica limitada aos últimos sete dias, com evidência de consentimento, versão válida e erro anterior ao envio. Só o pedido mais recente do mesmo destinatário é recuperado; envios concluídos e incertos são excluídos.
- Tipos e testes dirigidos passaram: concorrência, recuperação 429, timeout sem reenvio, destinatário, consentimentos, grupos e Meta. O pipeline normal executou também as verificações dos dois kits e do arquivo.
- Verificação funcional autorizada: o pedido de teste já existente voltou a obter HTTP 200 com `delivery=accepted`, sem novo identificador. 17 pedidos históricos foram enfileirados. Isto não confirma entrega de todos os emails: a API Sender continua a devolver 429.
- Diagnóstico observado às 12:29 UTC: limite 100, restantes 0, Retry-After 858 segundos e X-RateLimit-Reset em 24/09/2026 12:29 UTC. Quota mensal no painel ainda disponível. A duração/causa exata do limite exige esclarecimento do fornecedor; não inferir que o plano precisa de upgrade.


## Correção do hero e do opt-in, 20 de setembro de 2026

- Removido o cabeçalho de navegação. A fotografia antes/depois passa a ser um elemento integral, na proporção original, sem recorte nem sobreposição da capa. Em telemóvel surge antes do formulário.
- Mockup do PDF separado da fotografia, com perspetiva moderada, lombada, sombra e texto de apoio. Removida a legenda visível Imagem ilustrativa da landing e do agradecimento, a pedido do utilizador.
- Diagnóstico autorizado do erro: configuração de produção sem PDF_CASA_BANHO_DB e base sem eventos. O handler devolve not_configured antes de contactar o Sender quando falta esse binding. A configuração anterior feita pela API não tinha sido incluída em wrangler.jsonc e o deployment substituiu-a.
- Binding reposto pela API, com resposta de sucesso, e acrescentado ao ficheiro versionado wrangler.jsonc, incluindo ID da base e diretório da migração. As próximas publicações passam a preservar a ligação.
- Teste de regressão da configuração de deployment acrescentado. Nove testes específicos aprovados. Compilação isolada da página e revisão local em computador e 390 px, sem overflow e com imagem completa. Falha de rede simulada apenas no servidor local confirmou que o botão recupera o texto original e fica novamente utilizável.
- Código preparado para envio pelo fluxo habitual. Não foram enviados emails nem criados contactos reais de teste. Conclusão do deployment e reteste público após a correção não consultados.


## Estado de implementação, 19 de setembro de 2026

Pedido do utilizador: criar a landing segundo a referência, com a imagem antes/depois e o PDF fornecidos, opt-ins iguais ao Kit Janelas, envio pelo Sender, tracking e destaque comercial no agradecimento e no email. Inclusão de todos os opt-ins no grupo `dw87gX` expressamente pedida. O utilizador confirmou mais de 1.000 downloads dos guias nesta tarefa.

Implementação pronta para envio pelo fluxo normal. Infraestrutura descrita abaixo configurada. Conclusão do deployment, confirmação pública e receção de email não consultadas nem presumidas. Não se enviaram emails, contactos, cliques ou conversões de teste reais.

## Landing e documento

- Landing: `/pdf-casa-de-banho/`. Agradecimento: `/pdf-casa-de-banho/obrigado/`. Ambas com canonical próprio, `noindex,follow` e excluídas do sitemap.
- Composição baseada na referência: cabeçalho, hero, capa em perspetiva, fotografias decorativas da referência, prova social confirmada pelo utilizador, seis capítulos, comparação, secção de destinatários, CTAs, perguntas frequentes e rodapé.
- Imagem antes/depois fornecida pelo utilizador, convertida para WebP sem alterar o conteúdo. A apresentação é identificada como ilustrativa. A capa é a primeira página real do PDF.
- Original de 20 páginas preservado em `public/downloads/guia-banheira-base-de-duche-2026.pdf`.
- SHA-256: `4A0D588B5071A07B8AABD17B8B75C119F9E63DD6655A11FC7E5548D2D16651CD`.
- Os CTAs inferiores remetem para o formulário completo, incluindo as duas escolhas de consentimento. A FAQ reflete as autorizações realmente pedidas.

## Opt-in, Sender e consentimentos

- `POST /api/pdf-casa-de-banho`, source `pdf-casa-de-banho`, consentimento `pdf-casa-banho-2026-09-a`.
- Primeira caixa obrigatória: texto do Kit Janelas com o título deste PDF. Autoriza envio e comunicações relevantes sobre o Guia do Proprietário.
- Segunda caixa desmarcada e não obrigatória: texto comercial integral do Kit Janelas, sem cedência do email aos anunciantes.
- Todos os opt-ins válidos entram na Newsletter `eEvG4m` e em `dw87gX`. Apenas a segunda caixa marcada acrescenta o grupo comercial `SENDER_GROUP_MARKETING`, por omissão `egK8WG`.
- Contactos existentes mantêm outros grupos e autorizações; associações existentes não são repetidas. `trigger_automation:false` evita automações de outros produtos. Entrega transacional direta, como no Kit Janelas.
- Mensagem do Sender com PDF em anexo e por ligação. CTA comercial destacado para a oferta existente `casa-banho-campanha`, com origem `pdf-casa-de-banho-email`.
- Token Sender e configuração de remetente existentes reutilizados. Não foram extraídos segredos nem alteradas automações. A aceitação real do próximo envio será confirmada pelo utilizador.
- Reutiliza o arquivo cifrado de consentimentos, limites de pedidos, validação de origem, honeypot, deduplicação e diagnóstico seguro. Lógica partilhada em `functions/lib/pdf-optin.ts`; configuração e email das janelas preservados.

## Bases e conversões

- D1 exclusiva `guia-proprietario-pdf-casa-banho`, ID `0035dea4-9613-4933-b7b4-9f926bf452fe`, binding de produção `PDF_CASA_BANHO_DB` configurado.
- Estrutura `migrations/pdf-casa-banho/0001_pdf_casa_banho.sql` aplicada com sucesso, nove instruções. Inclui eventos, limites e vistas de inscrições por dia de Lisboa e estado Meta. Não aceita source de outros produtos.
- `CompleteRegistration` no Pixel e na CAPI, com o mesmo ID `pdf-banho-registration-{requestId}`, só após aceitação do email pelo Sender e com autorização de medição válida. Sem autorização, regista a exclusão; falhas Meta não bloqueiam o PDF.
- Lead final continua no postback aprovado do parceiro pelo tracker existente. Não é disparado no acesso ao agradecimento nem no clique comercial.
- Agradecimento: source `pdf-casa-de-banho-obrigado`. Mantém parâmetros de atribuição permitidos, incluindo `utm_content` do anúncio quando presente, sem contactos no URL.
- PDF original: source `campanha-casa-de-banho_kit`, já presente nos links do ficheiro. Não alterado.
- Tracker: migração `0010_pdf_casa_banho_origens.sql` aplicada pelo importador oficial D1, 17 instruções, e registada em `d1_migrations`. Identifica agradecimento, email e PDF, incluindo histórico, e preserva `utm_content`, estados, IDs e totais. Não altera oferta, destino, postback ou código do Worker.
- A primeira tentativa pela API de consulta rejeitou SQL composto com `incomplete input`. Inspeção apenas do esquema confirmou rollback integral. O importador oficial concluiu a aplicação com sucesso.

## Validação

- 47 testes existentes do Kit Janelas, medição, base e Meta aprovados após extração da lógica partilhada.
- Oito testes específicos do PDF aprovados: grupos, contacto existente, falha de associação, anexo e CTA, deduplicação, consentimento Meta, isolamento da base e atribuição.
- Teste dirigido da migração do tracker aprovado com histórico e novas conversões simuladas, preservando o anúncio e sem duplicados.
- Tipos das duas APIs aprovados. Páginas e CSS compilados isoladamente. Revisão local da landing e agradecimento em computador e telemóvel, imagens carregadas e sem overflow horizontal; validação de email e caixas desmarcadas confirmadas.
- Sem compilação integral local. O fluxo normal de publicação inclui os testes específicos antes do build necessário ao deployment.
