# Conformidade da recolha de leads no portal

Última atualização: 5 de agosto de 2026

## Estado implementado

- A newsletter e a entrega do guia usam single opt-in e registam email, data, IP, versão do texto, origem e identificador do pedido no Sender.
- O consentimento de marketing é obrigatório para a subscrição. A autorização de partilha com parceiros é independente e opcional.
- A autorização de parceiros está desligada no site e bloqueada na API enquanto não existir pelo menos um parceiro identificado publicamente.
- O Meta Pixel só pode ser carregado após consentimento para medição e apenas quando existir um ID configurado.
- O aviso de cookies está ativo no portal e nas landings. Permite aceitar todos, recusar opcionais, personalizar e alterar a escolha no rodapé.
- Existem páginas próprias de Privacidade, Cookies e Parceiros e fornecedores.
- As ofertas de terceiros enviadas pelo Guia não estão ativas. A sua futura ativação exige um terceiro consentimento separado.

## Dados ainda necessários para completar a informação legal

- Nome civil ou denominação legal do responsável pelo tratamento.
- Morada de contacto do responsável.
- NIF ou NIPC, caso seja decidido publicá-lo.

## Antes de ativar a partilha de contactos

1. Publicar na página de parceiros o nome legal e comercial, categoria, licença AMI quando aplicável, zonas, finalidade do contacto e política de privacidade de cada empresa.
2. Definir por escrito que campos recebe cada parceiro, por que canal, com que frequência e durante quanto tempo.
3. Celebrar um acordo que clarifique responsabilidades, segurança, tratamento de pedidos dos titulares, incidentes e proibição de reutilização fora da finalidade autorizada.
4. Atualizar o texto e a versão do consentimento se mudar a finalidade, os dados, os canais ou os parceiros abrangidos.
5. Ativar em conjunto `PUBLIC_PARTNER_CONSENT_ENABLED=true` na compilação e `PARTNER_CONSENT_ENABLED=true` na função. Nunca ativar apenas uma das duas.
6. Fazer um teste com dados fictícios antes de transmitir qualquer contacto real.

## Antes de enviar ofertas de terceiros sem partilhar o contacto

1. Criar uma opção separada e opcional nos formulários.
2. Criar no Sender um campo próprio, um segmento ou grupo próprio e uma versão de consentimento própria.
3. Garantir que o cancelamento dessa finalidade não cancela automaticamente os restantes consentimentos.
4. Identificar a empresa anunciante em cada comunicação e manter o envio sob controlo do Guia do Proprietário.

## Procedimentos internos necessários

- Manter um registo das atividades de tratamento, fornecedores, finalidades, bases legais, campos e prazos.
- Manter acordos de tratamento de dados com Cloudflare e Sender e os termos aplicáveis do Meta quando o Pixel for ativado.
- Definir quem responde a pedidos de acesso, correção, eliminação, portabilidade, oposição e retirada de consentimento no prazo legal.
- Definir um procedimento de incidentes e violações de dados, incluindo avaliação e eventual notificação à CNPD e aos titulares.
- Rever periodicamente acessos ao Sender, autenticação multifator, chaves da API, utilizadores autorizados e listas exportadas.
- Não colocar dados pessoais de leads em repositórios, ficheiros de demonstração, relatórios operacionais ou capturas de ecrã.
- Rever as páginas e os textos de consentimento sempre que se acrescentar um fornecedor, tecnologia, formulário ou finalidade.

## Validação técnica de 5 de agosto de 2026

- Oito testes da API de subscrição passaram.
- A API recusa partilha de parceiros enquanto a funcionalidade estiver desligada.
- A compilação completa gerou 683 páginas sem erros, avisos ou falhas de conteúdo.
- A auditoria das dependências terminou com zero vulnerabilidades conhecidas.
- A landing foi verificada localmente com resposta HTTP 200, aviso de cookies presente e consentimento de parceiros ausente.

Este documento é um controlo operacional. Não substitui revisão jurídica adaptada à identidade do responsável, aos contratos celebrados e ao tratamento efetivamente realizado.
