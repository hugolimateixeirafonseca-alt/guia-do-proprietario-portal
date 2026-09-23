# Kit Trocar Janelas em 2026

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


## Primeiro consentimento e Newsletter, 17 de setembro de 2026

- A pedido do utilizador, o primeiro consentimento passa a: «Autorizo o Guia do Proprietário a utilizar o meu email para me enviar o PDF «Trocar Janelas em 2026» que estou a pedir, bem como enviar comunicações relevantes sobre o Guia do Proprietário».
- Nova versão `kit-janelas-2026-09-b`; texto anterior preservado no catálogo. Pedidos com a versão antiga não autorizam a inscrição na Newsletter. Não há migração de contactos antigos nem consentimento retroativo.
- Cada novo pedido válido associa o contacto ao grupo Newsletter `eEvG4m` do Sender, mesmo com a segunda caixa vazia. A segunda caixa mantém o grupo comercial existente e o campo de publicidade, apenas quando assinalada. Uma caixa vazia não revoga escolhas anteriores.
- Contactos existentes mantêm os restantes grupos. Criação inclui os grupos numa só chamada; associações já presentes não são repetidas. Mantém `trigger_automation:false` e a entrega transacional do PDF.
- Auditoria na base exclusiva do Kit Janelas: `newsletter:true` nas escolhas e evento `janelas_newsletter_registered`. Consentimento de medição Meta continua independente.
- Informação sobre kits na página de privacidade alinhada com a nova escolha. Tipos da API e 45 testes direcionados aprovados, sem inscrição ou email real de teste. Publicação autorizada pelo pedido de alteração, pelo fluxo habitual. Conclusão do deployment e confirmação online não consultadas.

## Base exclusiva do Kit Janelas, 17 de setembro de 2026

- Criada em produção a D1 `guia-proprietario-kit-janelas`, ID `32fe7615-5bf4-427a-9ea0-7c4c5546497d`, binding `KIT_JANELAS_DB`. Estrutura em `migrations/kit-janelas/0001_kit_janelas.sql`, independente das migrações do Kit Estudante.
- O endpoint escreve eventos e limites de pedidos apenas nesta base. Não usa a base antiga como alternativa se faltar o novo binding. As funções utilitárias partilhadas não determinam o destino da base.
- Histórico copiado com `scripts/migrate-kit-janelas-history.mjs`, filtrado por `source='kit-trocar-janelas'`. `legacy_event_id` evita duplicados. A origem não foi alterada. Não copia contactos, sessões ou registos de outros produtos. Ficheiros temporários apagados pelo importador.
- Há uma ponte de leitura durante a transição: páginas de até 100 eventos tardios são copiadas de D1 para D1, no mesmo fornecedor, após pedidos válidos. O cursor só avança após a página completa. Pedidos repetidos consultam e copiam o respetivo histórico antes de qualquer envio para impedir repetição do PDF. Nenhuma escrita é feita em `KIT_ESTUDANTE_DB` pelo endpoint de Janelas. A ponte pode ser removida numa tarefa posterior após confirmar a conclusão da transição.
- Vistas no Studio: `resumo_inscricoes_por_dia` (hora de Lisboa com horário de verão), `inscricoes_meta` e `inscricoes_nao_enviadas_meta`. Sem email ou hashes nas vistas. `sem_registo` não significa recusa: pode ser histórico sem motivo ou envio em curso. Aceitação CAPI não equivale a atribuição à campanha.
- 43 testes direcionados e tipos da API aprovados. A base, a cópia inicial e as vistas foram verificadas antes do envio do código. Publicação autorizada no pedido de separação. Alteração do endpoint enviada pelo fluxo normal; conclusão do deployment e comportamento público não consultados.

## Robustez da medição, 17 de setembro de 2026

Publicação autorizada pelo utilizador em 17 de setembro de 2026. Alteração integrada para envio pelo fluxo habitual; conclusão do deployment e confirmação online não consultadas.

- Com consentimento de medição válido, o formulário usa o `fbclid` presente no URL para formar `fbc` quando falta o cookie do mesmo clique. Não cria identificadores de clique para visitas sem esse parâmetro. A preferência é relida na submissão e confirmada no servidor.
- O evento mantém `CompleteRegistration`, o ID partilhado com o Pixel e o envio apenas após aceitação do PDF pelo Sender. `Lead` do parceiro permanece independente.
- Pages `waitUntil` mantém o envio CAPI depois da resposta. Há até três tentativas para falhas de rede, timeout, limitação temporária ou receção vazia, com o mesmo ID e instante. Esperas de 0,5 s e 1,5 s e limite de 6 s por chamada. Não é uma fila persistente nem recupera períodos longos de indisponibilidade.
- Credenciais inválidas e erros permanentes não são repetidos. Regista apenas códigos de erro permitidos, presença de `fbc`/`fbp` e número de tentativas, sem valores publicitários ou contactos.
- Pedidos sem autorização válida passam a registar `measurement_not_authorized`. No histórico, ausência de evento Meta não prova recusa: também pode representar falta de sinal do browser ou interrupção antes do registo.
- Um `janelas_pdf_sent` confirma aceitação do envio pelo fornecedor, não entrega na caixa de entrada. Eventos aceites pela Meta não equivalem a conversões atribuídas à campanha.
- Validação direcionada: tipos da API e 36 testes locais com fornecedores simulados. Sem build integral, inscrição de teste real ou alteração da campanha.

## Reforço comercial do agradecimento e email, 15 de setembro de 2026

- Base: correção de backend 22a495440, já integrada antes desta edição. Alterações limitadas ao conteúdo do agradecimento, respetivo CSS e assunto/corpos do email na função existente.
- Agradecimento: título “Janelas novas com até 25% de desconto”, CTA “Pedir o meu orçamento grátis” e instrução explícita para preencher o formulário no site do parceiro, enquanto o kit chega ao email.
- Email: campanha apresentada em destaque, botão principal de orçamento e repetição da chamada à ação no fecho. Ligação ao PDF e anexo preservados. Aplica-se aos próximos envios do kit, sem reenvio para contactos anteriores.
- Condições confirmadas no módulo público https://www.nuvi.pt/assets/Janelas2026Desc25-CDbpP_xh.js em 15 de setembro: PVC, até 25%, 3 ou mais janelas, orçamento gratuito e sem compromisso após visita técnica. Mantido o âmbito comercial da Grande Lisboa.
- Reutiliza o encaminhamento existente /go/kit-trocar-janelas. Email identificado por source=kit-trocar-janelas-email, utm_medium=email e utm_content=cta-email. Não acrescenta dados pessoais ou identificadores de publicidade ao link do email. O agradecimento mantém o helper atual com atribuição e consentimento.
- Preservados backend de envio, registo de consentimentos, CompleteRegistration, deduplicação e Lead final no postback do parceiro. Nenhum email real ou clique de teste enviado.
- Validação dirigida: tipos da API e 24 testes do kit aprovados. Compilação isolada do agradecimento e CSS. Sem build integral ou confirmação online desta alteração. Publicação autorizada explicitamente pelo utilizador após revisão da alteração. Envio pelo fluxo habitual; conclusão do deployment e confirmação online não consultadas.

## Recuperação da publicação do evento, 15 de setembro de 2026

A execução 34964869636 do commit efa9b2701e14fa5062d35c32d1a980c084be9636 falhou às 12:02 UTC. O verificador Astro/TypeScript considerava externalId obrigatório na função partilhada sendMetaConversion, apesar de o identificador externo ser opcional no envio. A chamada do kit omitia-o. A compilação isolada e os testes anteriores não verificavam este contrato de tipos, e a alteração não chegou ao site por esta execução.

Correção: externalId tem agora valor por omissão vazio, mantendo o payload anterior sem acrescentar um identificador. Nova verificação dirigida tsconfig.kit-janelas-api.json reproduziu o erro TS2345 antes da correção e passou depois. O comando test:kit-janelas executa esta verificação antes dos testes de comportamento e antes da compilação de produção. 28 testes de kit e conversões aprovados. Não se alteraram o consentimento, a deduplicação, o evento Lead do parceiro ou a campanha Meta.

O Pixel emite CompleteRegistration no formulário após confirmação do envio, antes da navegação para o agradecimento. A extensão que mostra apenas eventos da página /obrigado/ pode por isso mostrar apenas PageView. Um acesso direto ao agradecimento não deve criar conversões. A atribuição a anúncio depende também de uma interação elegível com o anúncio; receber o evento no dataset e atribuí-lo a um anúncio são verificações diferentes.

## Separação de conversões Meta, 15 de setembro de 2026

- O pedido de email do kit emite `CompleteRegistration` só após o Sender aceitar o envio. Não emite `Lead`.
- Pixel e API de Conversões partilham `kit-janelas-registration-{requestId}` para deduplicação. A repetição de um pedido concluído não reenvia o PDF nem uma conversão CAPI já aceite. Falhas de medição não bloqueiam o agradecimento.
- Medição exige a preferência de cookies atual, explícita e dentro de validade. Consentimento para PDF e inscrição comercial não substituem esta escolha. O email enviado por CAPI é protegido por SHA-256; nenhuma informação pessoal entra no URL de agradecimento.
- Reutiliza `META_CAPI_ACCESS_TOKEN`, `META_DATASET_ID` (dataset oficial por omissão), `META_GRAPH_VERSION` e `META_TEST_EVENT_CODE` do portal. Credencial CAPI presente em produção, confirmada apenas pelo nome. Receção real do evento ainda não confirmada.
- O CTA continua a usar a oferta `kit-trocar-janelas`. O tracker conserva o evento `Lead` apenas no postback validado do parceiro e só o envia à Meta quando tem consentimento e identificadores de atribuição válidos. Acesso à página e clique no CTA não são leads finais.
- O conjunto Meta `AS05 | PL5 KIT | GRANDE LISBOA | BROAD` (120249702360960143) deve otimizar por `Complete registration` no dataset 1394294186173855. O anúncio associado 120249702360950143 deve apontar para `/kit-trocar-janelas/`, com `campaign_id`, `adset_id` e `ad_id` preenchidos pelas macros Meta.
- Validação local: 28 testes do kit e conversões e 10 testes direcionados do tracker aprovados com chamadas externas simuladas. Utilizador autorizou explicitamente a publicação do portal e dashboard e do conjunto AS05 com o anúncio, mantendo campanha desligada e orçamento de 15 EUR/dia. Conclusão do deployment e receção Meta não consultadas.

Estado: publicação da landing e ativação do Sender autorizadas expressamente pelo utilizador em 11 de setembro de 2026. Implementação validada e preparada para envio pelo fluxo normal de produção. Conclusão do deployment e entrega real não consultadas nem presumidas.

## Página e documento
- Novo endereço: https://guiadoproprietario.pt/kit-trocar-janelas/
- Cabeçalho e composição inspirados na referência fornecida: Casa e Obras, fundo claro, título verde, formulário de email e capa real do PDF.
- PDF original de 12 páginas preservado, sem alterações, em public/downloads/kit-trocar-janelas-2026.pdf.
- SHA-256: D29E6B113E6E4089E1A3DF9CD2460F76F1C5CCDC052F52D9E876FBA290CE66BA.
- Os dois links do PDF usam a oferta kit-trocar-janelas, source=kit-trocar-janelas-pdf e a campanha checklist-17-pontos.
- As três landings anteriores permanecem nas suas rotas. Nova página excluída do sitemap e com noindex.

## Consentimento e entrega
- Primeiro consentimento obrigatório apenas para receber o PDF, com ligação à Política de Privacidade. Não autoriza partilha com parceiros.
- Segundo consentimento de comunicações igual ao das páginas de limpeza, sem a indicação “opcional”, desmarcado e não obrigatório.
- Versão kit-janelas-2026-09-a no registo central. Política de Privacidade atualizada.
- POST /api/kit-trocar-janelas valida email, origem, versão e escolhas, limita pedidos e regista prova com identificadores protegidos por hash na base existente KIT_ESTUDANTE_DB.
- Pedido aceite pelo Sender envia email transacional com ligação e anexo do PDF. A página só confirma depois da aceitação do fornecedor.
- Apenas a segunda escolha marcada cria/atualiza inscrição no grupo de marketing do Sender. Não usa grupo de parceiros nem desencadeia outras automações. Uma escolha desmarcada não altera subscrições anteriores.
- Reutiliza SENDER_API_TOKEN, SENDER_GROUP_MARKETING, SENDER_TRANSACTIONAL_FROM_EMAIL, SENDER_TRANSACTIONAL_FROM_NAME, SESSION_SECRET e KIT_ESTUDANTE_DB. Sem novas migrações.
- Publicação e ativação externa autorizadas pelo utilizador. A função fica disponível com o deployment, usando a configuração Sender existente. Nenhum email ou contacto real de teste foi enviado nesta tarefa.

## Validação
- 13 testes direcionados aprovados, com base SQLite temporária e chamadas ao Sender simuladas.
- Compilação isolada da página, CSS, script e função aprovada. Sem compilação integral.
- Pré-visualização local observada em desktop e telemóvel, sem conteúdo fora da largura.
- Primeiro consentimento exigido e segundo desmarcado sem a palavra “opcional” confirmados no navegador.
- Integridade do PDF e dos links verificada localmente.
- Pré-visualização local em http://127.0.0.1:4329/kit-trocar-janelas/ não envia emails.
- Tracking próprio já configurado em tarefa anterior. Mapeamento de landing_url nos relatórios do tracker continua pendente, conforme documentação do tracker. Nenhum clique de teste criado.

## Agradecimento comercial
- Novo endereço: /kit-trocar-janelas/obrigado/. Apresentado apenas depois de a API aceitar o pedido.
- Confirmação do kit, título “Quanto custa trocar as suas janelas?”, fotografia e um único CTA principal: “Ver campanha e pedir orçamento”. Condições da campanha junto do botão.
- Destino: oferta ativa kit-trocar-janelas, com source=kit-trocar-janelas-obrigado e utm_content=cta-obrigado. Oferta reutilizada; não cria outra campanha nem altera o PDF.
- Conserva apenas parâmetros de atribuição permitidos na passagem entre páginas, sem email no URL. Identificadores Meta só no clique com consentimento de medição válido. Não dispara Lead ou Contact no clique.
- Ambos os endereços excluídos do sitemap e com noindex. Revisão local em desktop e telemóvel, sem overflow, aprovada.
- O workflow normal de publicação inclui os ficheiros do kit e os 13 testes direcionados. Sem build integral local, consulta de deployment ou clique real no tracker.

## Correção de publicação em 12 de setembro de 2026

O envio original ed66c38d0 falhou no workflow 34607102980: a página de agradecimento omitia a propriedade obrigatória imagemOg do layout Squeeze. A verificação Astro bloqueou a publicação integral. A propriedade foi corrigida com a imagem já existente da campanha. A verificação direcionada reproduziu o erro original e passou com a correção (3 ficheiros, zero erros). Foi acrescentada uma verificação de tipos das páginas do kit antes do build de produção.

O publicador de artigos executou diariamente às 07:00 UTC nos oito dias consultados (08:00 de Lisboa). Em 12 de setembro, a execução 34679580639 moveu adaptar-casa-pais-idosos.mdx para artigos no commit 7024a474a. O deployment 0716b842-4887-4bdc-9914-66df9841f0da falhou na etapa de build, com aviso do observador de proximidade ao limite de 20 minutos; o detalhe do erro desse build Cloudflare não foi consultado. Nove artigos continuam na fila válida, um por execução. O próximo é alargar-porta-casa-banho.mdx. Oito testes de fila e datas aprovados. Não se alterou a cadência nem se anteciparam os nove artigos.

Antes da correção, landing, agradecimento e artigo adaptar-casa-pais-idosos devolveram HTTP 404. Correção autorizada pelo pedido do utilizador. Confirmação de publicação será registada no dashboard após a recuperação.

## Diagnóstico e correção Sender em 12 de setembro de 2026

O pedido original das 16:07 UTC falhou antes do registo de marketing; a resposta específica perdeu-se no diagnóstico genérico. As consultas autorizadas confirmaram grupo egK8WG existente e contacto de teste já associado, com consentimento comercial. A API aceita os campos existentes. CONSENT_PUBLICIDADE não existe no inventário de 34 campos, mas a atualização testada foi aceite; não se atribui a causa original a esse campo sem evidência.

Um pedido pelo endpoint público às 16:20 UTC registou marketing com sucesso e falhou no envio exatamente após 12 segundos. O histórico Sender não tinha emails enviados. O único teste de email autorizado foi concluído diretamente com a mesma função e mensagem, sem nova inscrição: Sender HTTP 200 em 1689 ms; histórico transacional got às 17:21:54 de Lisboa, assunto O seu kit para trocar janelas em 2026. Mensagem inclui a ligação e anexo por URL do PDF original. Aceitação e registo no fornecedor confirmados; receção na caixa do utilizador não observada.

Correção: libertar respostas de marketing antes da chamada seguinte, aguardar até 45 segundos no envio deste kit (restantes clientes mantêm 12 segundos), registar passo/HTTP ou send_timeout sem contactos, tratar timeout como entrega por confirmar e sem repetição automática. Compatibilidade com a ausência do campo adicional de publicidade, mantendo CONSENT_MARKETING e a versão de consentimento. 21 testes direcionados aprovados. Não se presume que o aumento do limite resolva todas as falhas do fornecedor; formulário após publicação aguarda novo teste pelo utilizador. Sem alterações às outras landings, PDF, grupos, cadência editorial ou automações comerciais.

## Associação repetida ao grupo, 12 de setembro de 2026

A publicação 62e1a8fc124973fe0458f257f694ebede15625d8 terminou com sucesso no workflow 34705139927 às 16:40:28 UTC. Os novos pedidos das 16:43 UTC identificaram marketing_group_400, antes do envio de email. Consulta de leitura ao Sender confirmou que o contacto do teste já estava ativo e associado ao grupo egK8WG. O código repetia a associação depois de criar o contacto com esse mesmo grupo e também para contactos já associados.

Correção: usar subscriber_tags da resposta Sender para reconhecer associação existente e atualizar apenas os campos de consentimento. Na criação, usar a associação incluída em groups sem outro POST. Para contactos existentes fora do grupo, manter associação explícita sem substituir grupos anteriores. Em erros 400/409 de associação concorrente, só prosseguir se uma releitura confirmar o grupo; caso contrário conservar a falha. Respostas consumidas para libertar as ligações do Worker. 25 testes direcionados aprovados, incluindo erro sem associação, associação concorrente, contacto novo e contacto existente. PDF, consentimentos, automações e restantes landings preservados. A publicação desta segunda correção e o percurso público serão registados no dashboard após confirmação.
