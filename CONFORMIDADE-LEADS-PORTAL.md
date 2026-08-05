# Conformidade da recolha de leads no portal

Última atualização: 5 de agosto de 2026

## Estado implementado

- A newsletter e a entrega do guia usam single opt-in e registam email, data, IP, versão do texto, origem e identificador do pedido no Sender.
- O consentimento de marketing é obrigatório para a subscrição. A autorização de partilha com parceiros é independente e opcional.
- A autorização de parceiros surge apenas depois do pedido do manual, num segundo formulário independente. O nome, o telefone, o código postal e a autorização são obrigatórios para enviar esse pedido de contacto. A localidade é identificada automaticamente a partir do código postal.
- O Meta Pixel só pode ser carregado após consentimento para medição e apenas quando existir um ID configurado.
- O aviso de cookies está ativo no portal e nas landings. Permite aceitar todos, recusar opcionais, personalizar e alterar a escolha no rodapé.
- Existem páginas próprias de Privacidade, Cookies e Parceiros e fornecedores.
- As ofertas de terceiros enviadas pelo Guia estão incluídas de forma expressa no consentimento das comunicações por email. O contacto não é partilhado com a empresa anunciante.
- Todas as novas subscrições de marketing entram no grupo `Newsletter - Ofertas de terceiros` (`egK8WG`). O grupo anterior `Newsletter - Ativa` (`eEvG4m`) fica reservado como grupo histórico e não recebe novas subscrições.
- O grupo `Guia - Vender Casa` (`dJAl59`) mantém-se para a entrega do manual. O grupo `Guia - Vender Casa - Parceiros` (`aKBm4l`) mantém-se para os contactos que aceitam a partilha opcional.

## Identificação publicada

- Responsável pelo tratamento: Hugo Fonseca.
- Morada de contacto: Alameda da Índia, Parque dos Reis, 2, 8900-440.

## Antes de ativar a partilha de contactos

1. Publicar na página de parceiros o nome legal e comercial, categoria, licença AMI quando aplicável, zonas, finalidade do contacto e política de privacidade de cada empresa.
2. Definir por escrito que campos recebe cada parceiro, por que canal, com que frequência e durante quanto tempo.
3. Celebrar um acordo que clarifique responsabilidades, segurança, tratamento de pedidos dos titulares, incidentes e proibição de reutilização fora da finalidade autorizada.
4. Atualizar o texto e a versão do consentimento se mudar a finalidade, os dados, os canais ou os parceiros abrangidos.
5. Fazer um teste com dados fictícios antes de transmitir qualquer contacto real.

## Ofertas de terceiros sem partilhar o contacto

- O consentimento das comunicações por email identifica expressamente que pode incluir ofertas de empresas terceiras.
- O envio permanece sob controlo do Guia do Proprietário e o endereço de email não é transmitido à empresa anunciante.
- As versões `2026-08-e`, `2026-08-f`, `2026-08-g`, `2026-08-h`, `2026-08-i` e `newsletter-2026-08-c` identificam os subscritores que aceitaram este âmbito. Consentimentos anteriores não devem ser usados para estas ofertas sem nova aceitação.
- A empresa anunciante deve ser identificada em cada comunicação.

## Procedimentos internos necessários

- Manter um registo das atividades de tratamento, fornecedores, finalidades, bases legais, campos e prazos.
- Manter acordos de tratamento de dados com Cloudflare e Sender e os termos aplicáveis do Meta quando o Pixel for ativado.
- Definir quem responde a pedidos de acesso, correção, eliminação, portabilidade, oposição e retirada de consentimento no prazo legal.
- Definir um procedimento de incidentes e violações de dados, incluindo avaliação e eventual notificação à CNPD e aos titulares.
- Rever periodicamente acessos ao Sender, autenticação multifator, chaves da API, utilizadores autorizados e listas exportadas.
- Não colocar dados pessoais de leads em repositórios, ficheiros de demonstração, relatórios operacionais ou capturas de ecrã.
- Rever as páginas e os textos de consentimento sempre que se acrescentar um fornecedor, tecnologia, formulário ou finalidade.

## Validação técnica de 5 de agosto de 2026

- A API valida o formato do código postal, consulta o GEO API PT e guarda `CODIGO_POSTAL` e `LOCALIDADE` no Sender quando os campos personalizados existem.
- O segundo formulário apresenta mensagens específicas junto ao nome, telefone e código postal, incluindo caracteres não permitidos, quantidade incorreta de algarismos, formato inválido e código postal inexistente.
- A API aceita a autorização opcional de parceiros e adiciona o contacto ao grupo próprio quando essa opção é assinalada.
- A compilação completa gerou 683 páginas sem erros, avisos ou falhas de conteúdo.
- A auditoria das dependências terminou com zero vulnerabilidades conhecidas.
- A landing foi verificada localmente com a subscrição principal separada do pedido de contacto de parceiros. O segundo formulário usa a versão `2026-08-i`, exige nome, telefone, código postal e autorização, atualiza o contacto existente e não repete o envio do manual.

Este documento é um controlo operacional. Não substitui revisão jurídica adaptada à identidade do responsável, aos contratos celebrados e ao tratamento efetivamente realizado.
