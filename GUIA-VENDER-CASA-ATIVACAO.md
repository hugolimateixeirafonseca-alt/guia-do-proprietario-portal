# Ativação da landing do guia Vender a Casa em Portugal

## Estado

A landing, a validação do formulário e a integração com o Sender estão publicadas. O PDF final está publicado e foi confirmado online em 4 de agosto de 2026. O formulário usa single opt-in e a recolha de subscrições está ativa. A partilha com empresas parceiras permanece inativa enquanto a lista pública de parceiros estiver vazia.

Rota da landing: `/guias/vender-casa/`

Endereço público confirmado: `https://guiadoproprietario.pt/guias/vender-casa/`

PDF entregue por email: `/ebooks/vender-a-casa-em-portugal-3f9a2c.pdf`

Endereço público confirmado: `https://guiadoproprietario.pt/ebooks/vender-a-casa-em-portugal-3f9a2c.pdf`

Email de entrega: `emails/sender/email-0-guia-vender-casa.html`

Modelo reutilizável: `emails/sender/template-base.html`

## Configuração confirmada

Configuração confirmada pelo responsável no Sender e na Cloudflare:

- grupos e campos personalizados criados;
- automação de entrega ativa para o grupo `Guia - Vender Casa`;
- remetente `geral@guiadoproprietario.pt` validado;
- token da API guardado como segredo na Cloudflare;
- integração de `functions/api/subscribe.ts` publicada;
- Sender identificado na Política de Privacidade.

## Grupos configurados

| Grupo | ID |
|---|---|
| Test group (geral@guiadoproprietario.pt) | `dPlrkn` |
| Guia - Vender Casa - Parceiros | `aKBm4l` |
| Guia - Vender Casa | `dJAl59` |
| Newsletter - Ativa | `eEvG4m` |

O grupo de teste não é usado automaticamente pelo formulário público.

## Validação técnica

A integração foi testada localmente para confirmar:

- bloqueio quando falta o consentimento obrigatório;
- bloqueio quando falta o token;
- entrada direta da newsletter em `Newsletter - Ativa`;
- entrada do pedido do guia nos grupos corretos;
- entrada em parceiros apenas com autorização opcional;
- acionamento da automação ao entrar em `Guia - Vender Casa`;
- apresentação de erro quando o Sender falha.

Os sete testes passaram. Não foram enviados contactos para o Sender durante estes testes.

## Validação em produção

Em 4 de agosto de 2026:

- a publicação da Cloudflare terminou com sucesso;
- a landing, a Política de Privacidade, a lista de parceiros e o PDF responderam com estado 200;
- um pedido controlado com `geral@guiadoproprietario.pt` e sem autorização de parceiros foi aceite pela API com estado 200;
- a resposta do portal confirmou a criação ou atualização do contacto no Sender;
- a receção do email e o funcionamento do cancelamento ainda devem ser confirmados na caixa de correio.

## Correção de 5 de agosto de 2026

O primeiro teste em produção usou um contacto que já existia no Sender e validou apenas a atualização. Quando foram usados endereços novos, a criação falhou e os dois formulários apresentaram erro.

A criação foi corrigida para adicionar o novo subscritor e os respetivos grupos numa única operação. Depois da nova publicação:

- um endereço novo para o pedido do guia foi aceite com estado 200;
- um endereço novo para a newsletter foi aceite com estado 200;
- nenhum dos dois testes autorizou a partilha com empresas parceiras;
- a entrega do email do guia foi confirmada pelo responsável, tendo a primeira mensagem chegado à pasta de spam;
- o funcionamento da ligação de cancelamento continua por confirmar.

## Ajuste de interface e consentimento de 5 de agosto de 2026

- o formulário da landing deixa de mostrar o botão “A enviar...” depois do sucesso;
- a newsletter passa a mostrar “Subscrição concluída” sem cursor de espera;
- o consentimento obrigatório do portal e da landing foi uniformizado para conselhos, novidades e comunicações sobre produtos e serviços;
- as novas versões registadas são `2026-08-c` para o guia e `newsletter-2026-08-b` para a newsletter;
- os textos anteriores permanecem no histórico para preservar a correspondência com consentimentos já recolhidos.

O Pixel da Meta só deve ser configurado quando estiver aprovado e pronto para utilização.

## Antes de recolher contactos

- validar a redação dos dois consentimentos;
- identificar a entidade responsável pelo tratamento;
- concluir a Política de Privacidade;
- preencher e datar a lista de empresas parceiras;
- celebrar acordo escrito com cada empresa que receba contactos;
- confirmar conservação, eliminação e retirada do consentimento;
- testar subscrição repetida, autorização opcional, email entregue, cancelamento e falha do fornecedor.
