# Ativação da landing do guia Vender a Casa em Portugal

## Estado

A landing, a validação do formulário e o email de entrega estão preparados. O PDF final está publicado e foi confirmado online em 4 de agosto de 2026. O fornecedor escolhido é o Sender e será usado com single opt-in. A recolha real permanece inativa até o Sender e a integração segura estarem configurados e testados.

Rota da landing: `/guias/vender-casa/`

PDF entregue por email: `/ebooks/vender-a-casa-em-portugal-3f9a2c.pdf`

Endereço público confirmado: `https://guiadoproprietario.pt/ebooks/vender-a-casa-em-portugal-3f9a2c.pdf`

Email de entrega: `emails/sender/email-0-guia-vender-casa.html`

Modelo reutilizável: `emails/sender/template-base.html`

## Configuração necessária

Configuração necessária no Sender:

- grupos criados e identificadores registados no portal;
- guardar a versão e a data de cada consentimento;
- criar a automação de entrega e colar o HTML de `emails/sender/email-0-guia-vender-casa.html`;
- validar o remetente `geral@guiadoproprietario.pt`;
- integração de `functions/api/subscribe.ts` com a API do Sender preparada;
- documentar o Sender na Política de Privacidade.

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

Os seis testes passaram. Não foram enviados contactos para o Sender durante estes testes.

O Pixel da Meta só deve ser configurado quando estiver aprovado e pronto para utilização.

## Antes de recolher contactos

- validar a redação dos dois consentimentos;
- identificar a entidade responsável pelo tratamento;
- concluir a Política de Privacidade;
- preencher e datar a lista de empresas parceiras;
- celebrar acordo escrito com cada empresa que receba contactos;
- confirmar conservação, eliminação e retirada do consentimento;
- testar subscrição repetida, autorização opcional, email entregue, cancelamento e falha do fornecedor.
