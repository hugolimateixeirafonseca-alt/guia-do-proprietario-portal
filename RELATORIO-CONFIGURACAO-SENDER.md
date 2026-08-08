# Relatório de configuração do Sender

## Guia do Proprietário

**Data:** 4 de agosto de 2026  
**Domínio:** `guiadoproprietario.pt`  
**Fornecedor de email:** Sender  
**Email oficial:** `geral@guiadoproprietario.pt`

## 1. Objetivo

Configurar o Sender para suportar:

- subscrição direta da newsletter através de single opt-in;
- entrega automática do guia Vender a Casa em Portugal;
- prova dos consentimentos recolhidos;
- separação entre subscritores, pedidos do guia e contactos que autorizam empresas parceiras;
- integração segura com o portal através da API;
- cancelamento simples das comunicações.

Nenhuma campanha, automação ou importação de contactos deve ser ativada antes de concluir a autenticação do domínio e os testes.

## 2. Identidade da conta

Em `Account settings → General settings`, preencher:

| Campo | Valor |
|---|---|
| Nome da marca | Guia do Proprietário |
| Site | `https://guiadoproprietario.pt` |
| País | Portugal |
| Fuso horário | Europe/Lisbon |
| Nome do remetente | Guia do Proprietário |
| Email de envio | `geral@guiadoproprietario.pt` |
| Email de resposta | `geral@guiadoproprietario.pt` |

Deve também ser indicada a morada real do responsável pelo projeto. Esta informação é necessária no rodapé das campanhas e não deve ser fictícia.

O endereço `geral@guiadoproprietario.pt` deve existir ou encaminhar mensagens para uma caixa consultada regularmente.

## 3. Autenticação do domínio

### 3.1. Adicionar o domínio

No Sender:

1. Abrir `Account settings → Domains`.
2. Selecionar `Add domain`.
3. Adicionar `guiadoproprietario.pt`.
4. Usar `geral@guiadoproprietario.pt` para confirmar a propriedade.
5. Abrir o email recebido e concluir a verificação.

### 3.2. Configurar o DNS

Depois da verificação, o Sender apresenta os registos necessários para SPF, DKIM e DMARC. Os valores apresentados na conta devem ser copiados exatamente para o DNS do domínio.

Normalmente serão semelhantes a:

| Finalidade | Tipo | Nome | Valor indicativo |
|---|---|---|---|
| DKIM | CNAME | `sender._domainkey` | `dkim.sendersrv.com` |
| SPF | TXT | `@` | `v=spf1 include:sendersrv.com ?all` |
| DMARC | TXT | `_dmarc` | `v=DMARC1; p=none;` |

Regras importantes:

- usar sempre os valores mostrados na conta Sender;
- se já existir um SPF, não criar um segundo;
- acrescentar `include:sendersrv.com` ao SPF existente;
- no Cloudflare, deixar o CNAME de DKIM como `DNS only`;
- não substituir um DMARC existente sem verificar o seu conteúdo;
- começar com DMARC em monitorização, normalmente `p=none`;
- regressar ao Sender e usar `Recheck DNS records`;
- só avançar quando SPF, DKIM e DMARC estiverem validados.

A propagação pode demorar alguns minutos ou, em casos menos frequentes, até 48 horas.

## 4. Grupos de contactos

Em `Subscribers → Groups`, criar:

| Grupo | ID | Função |
|---|---|---|
| Test group (geral@guiadoproprietario.pt) | `dPlrkn` | Testes manuais. Nunca recebe subscrições reais automaticamente |
| Newsletter - Ofertas de terceiros | `egK8WG` | Recebe imediatamente todas as novas subscrições de marketing |
| Guia - Vender Casa | `dJAl59` | Identifica quem pediu o e-book e aciona a entrega automática |
| Guia - Vender Casa - Parceiros | `aKBm4l` | Contém apenas quem autorizou expressamente a partilha |

O grupo `Newsletter - Ativa` (`eEvG4m`) fica apenas como histórico e não recebe novas subscrições.

### Regras de utilização

- uma nova subscrição entra diretamente em `Newsletter - Ofertas de terceiros`;
- não é enviado qualquer email de confirmação da subscrição;
- o pedido do e-book entra em `Guia - Vender Casa`;
- o grupo `Guia - Vender Casa - Parceiros` só recebe quem marcou a autorização opcional;
- a lista geral nunca é partilhada com empresas parceiras;
- um contacto pode pertencer a vários grupos.

## 5. Campos personalizados

Em `Subscribers → Fields` ou `Custom fields`, criar os seguintes campos:

| Campo | Tipo recomendado | Conteúdo |
|---|---|---|
| `CONSENT_DATA` | Texto | Data e hora em formato ISO |
| `CONSENT_IP` | Texto | Endereço IP associado ao pedido |
| `CONSENT_VERSAO` | Texto | Versão do texto aceite |
| `CONSENT_MARKETING` | Texto | `true` ou `false` |
| `CONSENT_PARCEIROS` | Texto | `true` ou `false` |
| `ORIGEM` | Texto | URL onde ocorreu a subscrição |
| `LEAD_SOURCE` | Texto | `newsletter` ou `ebook-vender-casa` |
| `EVENT_ID` | Texto | Identificador usado na medição e eventual deduplicação |

O tipo texto reduz incompatibilidades na API e permite guardar datas completas, valores booleanos e identificadores sem conversões.

O nome e o telefone pedidos no segundo passo da landing são guardados nos campos nativos `firstname` e `phone` do contacto no Sender. Não é necessário criar campos personalizados para estes dados.

O mesmo passo pede agora o código postal. Crie no Sender dois campos personalizados do tipo texto:

| Nome | Identificador |
|---|---|
| Código postal | `CODIGO_POSTAL` |
| Localidade | `LOCALIDADE` |
| Prazo de venda | `PRAZO_VENDA` |

A localidade é identificada automaticamente a partir do código postal. O prazo de venda guarda uma das quatro respostas apresentadas no formulário. Todos os três campos são enviados para o Sender como texto. Não é necessário criar outro grupo. Estes contactos continuam a entrar em `Newsletter - Ofertas de terceiros` (`egK8WG`) e `Guia - Vender Casa - Parceiros` (`aKBm4l`). Se algum destes campos ainda não existir, o pedido continua a ser guardado com o nome e o telefone, mas sem os campos adicionais. Depois de criar os campos, as novas submissões passam a preenchê-los sem nova publicação do site.

## 6. Single opt-in da newsletter

O formulário utiliza single opt-in. Depois de a pessoa preencher o email e aceitar o consentimento obrigatório, o contacto fica imediatamente ativo.

Fluxo a configurar:

1. O portal valida o email e o consentimento obrigatório.
2. O contacto é criado ou atualizado no Sender.
3. O contacto entra diretamente em `Newsletter - Ofertas de terceiros` com estado ativo.
4. Os campos de consentimento, origem e data ficam registados.
5. O contacto pode receber a newsletter sem confirmação adicional por email.

O texto do formulário deve indicar claramente que a pessoa aceita receber o guia, conselhos e novidades por email. O registo da versão desse texto é a prova do consentimento.

## 7. Entrega automática do e-book

O HTML está preparado em `emails/sender/email-0-guia-vender-casa.html`. Existe também o modelo reutilizável `emails/sender/template-base.html` para futuras mensagens.

Criar uma segunda automação:

1. Gatilho: contacto adicionado a `Guia - Vender Casa`.
2. Enviar imediatamente o email com acesso ao guia.
3. Usar uma ligação para o PDF, sem anexar o ficheiro.
4. Incluir a ligação de cancelamento das comunicações.

Configuração recomendada:

| Campo | Valor |
|---|---|
| Assunto | O seu guia para vender casa está aqui |
| Nome do remetente | Guia do Proprietário |
| Email do remetente | `geral@guiadoproprietario.pt` |
| Texto do botão | Descarregar o guia |
| Destino | `https://guiadoproprietario.pt/ebooks/vender-a-casa-em-portugal-3f9a2c.pdf` |

## 8. Cancelamento e conformidade

Todos os emails devem incluir:

- nome verdadeiro do remetente;
- email de resposta funcional;
- morada indicada na conta;
- ligação de cancelamento visível;
- conteúdo coerente com o consentimento dado;
- ausência de contactos comprados, importados sem prova ou obtidos por terceiros.

Os contactos cancelados, devolvidos ou marcados como spam não devem voltar a receber campanhas.

## 9. Acesso à API

Depois de concluir o domínio, os grupos, os campos e as automações:

1. Abrir `Account settings → API access tokens`.
2. Selecionar `Create API token`.
3. Criar um token dedicado ao portal.
4. Copiar o token no momento da criação.
5. Guardá-lo diretamente como segredo na Cloudflare.

O token:

- não deve ser enviado por email ou chat;
- não deve ser incluído no repositório;
- não deve ser colocado em ficheiros públicos;
- deve poder ser revogado sem afetar outras integrações;
- deve ser substituído se houver suspeita de exposição.

A integração utilizará:

- base da API: `https://api.sender.net/v2/`;
- autenticação: `Authorization: Bearer TOKEN`;
- criação ou atualização de contactos;
- associação aos grupos corretos;
- gravação dos campos de consentimento;
- ativação das automações apropriadas.

## 10. Informação necessária para integrar o portal

Depois da configuração do Sender, recolher:

- identificador de `Newsletter - Ofertas de terceiros`: `egK8WG`;
- identificador de `Guia - Vender Casa`: `dJAl59`;
- identificador de `Guia - Vender Casa - Parceiros`: `aKBm4l`;
- identificador do grupo de teste: `dPlrkn`;
- confirmação de que a automação de entrega do guia está ativa;
- confirmação de que o domínio está autenticado;
- confirmação de que `geral@guiadoproprietario.pt` envia e recebe corretamente.

O token da API deve ser introduzido diretamente na Cloudflare. Não deve constar deste relatório.

## 11. Testes obrigatórios

Antes de abrir os formulários ao público:

- [ ] SPF, DKIM e DMARC apresentam validação positiva.
- [ ] O remetente é `Guia do Proprietário <geral@guiadoproprietario.pt>`.
- [ ] Uma subscrição entra diretamente em `Newsletter - Ofertas de terceiros`.
- [ ] O contacto fica ativo sem receber um pedido de confirmação.
- [ ] O pedido do e-book entra em `Guia - Vender Casa`.
- [ ] O email do guia chega e o botão abre o PDF.
- [ ] Sem autorização de parceiros, o contacto não entra em `Guia - Vender Casa - Parceiros`.
- [ ] Com autorização, entra em `Guia - Vender Casa - Parceiros`.
- [ ] Os campos de prova do consentimento ficam preenchidos.
- [ ] A ligação de cancelamento funciona.
- [ ] Uma segunda subscrição do mesmo email não cria duplicados.
- [ ] Erros da API não apresentam sucesso falso no portal.

## 12. Estado de conclusão

A configuração do Sender estará pronta quando:

1. o domínio estiver autenticado;
2. os grupos e campos existirem;
3. as automações tiverem sido testadas;
4. o token estiver guardado na Cloudflare;
5. o portal conseguir criar e atualizar contactos corretamente;
6. a Política de Privacidade identificar o Sender antes da recolha começar;
7. os formulários forem ativados apenas depois dos testes finais.
