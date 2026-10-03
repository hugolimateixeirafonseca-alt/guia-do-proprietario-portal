# Email das novidades para os parceiros atuais, 02/10/2026

Estado: implementação local, não publicada nem aprovada. Nenhum email enviado.

O serviço de entrega passa a reconhecer a versão commercial_news_v1 e confirma essa capacidade à plataforma de parceiros. Usa o mesmo modelo de texto e HTML da pré-visualização preparada em guia-do-proprietario-parceiros/docs/email-novidades-parceiros-preview.html. O texto anuncia preços de 2,80 € e 5 € quando disponíveis, preservação do saldo e gratuitos e continuidade da utilização da conta nas condições anteriores. Não apresenta a regra dos 15 € aos parceiros atuais. O botão usa obrigatoriamente a ligação pessoal do destinatário; a ligação fictícia só aparece no exemplo para revisão. Não contém prazo de reconfirmação, promessa de garantia ou descrição do fecho interno dos pedidos.

Antes da entrega, o serviço volta a verificar na plataforma de parceiros a aprovação da versão e a elegibilidade da conta. Uma versão não aprovada é suprimida antes de contactar Sender. A fila mantém a proteção contra duplicação e os resultados incertos continuam sujeitos a revisão.

Alterações: functions/lib/partner-news-email.mjs, functions/lib/partner-engagement-email.mjs, functions/api/make/partner-engagement-notification.ts. Onze testes direcionados aprovados, incluindo bloqueio antes de Sender e identidade entre o modelo de revisão e o de entrega. Sem compilação integral, deployment ou verificação online.

Publicação coordenada com a fase 1 dos parceiros, depois da validação do proprietário. Publicar o serviço ou disponibilizar os preços não aprova o email automaticamente. O ambiente temporário deve ser mantido enquanto houver alterações por publicar.
Revisão visual: email completo em quatro blocos numerados, com oferta opcional de dois contactos partilhados num carregamento de pelo menos 15 € para parceiros atuais. Os novos gratuitos somam-se aos anteriores. Confirmação por WhatsApp e garantia são novidades ainda planeadas; envio bloqueado na plataforma por PARTNER_NEWS_FEATURES_READY=false, além da aprovação da versão e pagamentos disponíveis. Alterações visuais também invalidam a aprovação. Sem mensagens enviadas.


Revisão visual final: modelo sincronizado com cabeçalho verde, etiqueta de confirmação, preços em dois cartões, benefícios em negrito e oferta dourada. Abertura e explicação do WhatsApp conforme pedido do proprietário. Nove testes direcionados entre plataforma e serviço de entrega aprovados. Sem publicação ou envio.


## Revisão P1 segundo regras de emails

Modelo P1 e remetente Hugo · Guia do Proprietário preparados localmente. Estilo aguarda validação; restantes modelos ainda não montados. Fonte e inventário: guia-do-proprietario-parceiros/docs/email-audit-2026-10-02.md. Sem envio ou publicação.

## Aplicação do estilo aprovado aos restantes emails

Fluxos existentes revistos com componentes comuns. Novos modelos de conteúdo P4, P5, P7 a P12 e C2 a C6 preparados sem ativar automações. P2/P3 de pausa por falta de carregamento excluídos. Boas-vindas usam o regime efetivo obtido na política do servidor; publicar essa política da plataforma antes de publicar o renderer do portal. Na ausência dos dados comerciais, o envio de boas-vindas fica bloqueado para não prometer uma oferta incorreta.

Remetente Hugo · Guia do Proprietário. Emails a parceiros incluem suporte WhatsApp. Clientes sem dourado. Preços e acesso pessoal verificados antes da entrega. Galeria de 38 variantes: guia-do-proprietario-parceiros/docs/emails-validacao.html. Textos finais aguardam validação, sem envio ou publicação. Regra dos 60 dias clarificada na fonte: apenas o novo bónus usado, também para contas antigas que o aceitem. As restantes automações e páginas de resposta ficam dependentes da fase 2.

## Emails V2 após aprovação dos previews
43 variantes, renderer integrado sob ativação V2 separada, confirmação obrigatória nos dois formulários e recusa do vídeo antigo. P4 consulta dados atuais; candidatura recebe cartões públicos; C1 abre página de resposta confirmada. Testes direcionados aprovados, sem build integral. Não publicado nem enviado. Fonte: guia-do-proprietario-parceiros/docs/emails-v2-implementacao.md. Garantia, respostas futuras C2-C6, comprovativo e eventos futuros mantêm as dependências descritas nessa fonte.

## Conclusão local dos motores, 03/10/2026

Galeria atual com 45 variantes. Motores de garantia, seguimentos P5/P7/P8/P9/P10/P11/P12/C2-C6, oferta individual e aviso administrativo implementados na plataforma, com ativação de envio desligada. Adaptador do portal aceita estes fluxos apenas após validação da política atual da plataforma. Comprovativos privados apenas quando solicitados; prazo de 15 dias começa no envio efetivo. Candidatura não presume falta de documentos. Respostas de clientes exigem confirmação explícita e não expõem acesso de parceiros. Formulários do portal exigem confirmação final. Fonte atual: guia-do-proprietario-parceiros/docs/emails-v2-implementacao.md. Registos de fases anteriores são históricos. Não publicado nem enviado nesta tarefa.


## Conclusão do formulário e dos emails, 03/10/2026

Formulário geral sem dimensão/frequência indefinida e com início obrigatório, incluindo serviços regulares. Comparação de preços é registada sem distribuição na plataforma; agradecimento próprio. Referência pública de preço vem da configuração administrativa e permanece oculta enquanto vazia. Modelos P4/P5 com ligação pessoal para dicas; P1/P4/P5 podem apresentar apenas testemunho real autorizado obtido na política do servidor. Pergunta de garantia identifica o profissional quando autorizado, preservando o caso genérico. Serviço de emails sincronizado com a plataforma. Verificações locais direcionadas aprovadas. Continua local, sem publicação ou envio. Fonte atual: parceiros/docs/partner-completion-2026-10-03.md.
