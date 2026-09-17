# Arquivo privado de consentimentos

Estado: implementado localmente em 17/09/2026. Não publicado nem ligado a uma base de produção. Não foram consultados, importados ou alterados contactos reais.

## Utilização

Área /arquivo-consentimentos/: entrar com a chave privada, pesquisar o email completo e consultar todos os registos desse endereço. A pesquisa normaliza espaços e maiúsculas, sem pesquisa aproximada. Carregar todas as páginas antes de exportar JSON ou imprimir/guardar PDF. A chave permanece apenas na memória do separador. Sair limpa a chave e os resultados, incluindo respostas que cheguem depois da saída.

Cada registo contém email, data UTC atribuída pelo servidor, IP Cloudflare quando disponível, user-agent, versão e texto de consentimento, opções individuais, URL, origem e event_id. O texto é a definição da versão registada no servidor. A Newsletter passa a renderizar diretamente a definição guardada, com nova versão newsletter-2026-09-b; a versão anterior permanece no catálogo. A URL declarada pelo formulário é identificada como tal; nos kits é definida pelo servidor. Não se usa o IP de webhooks como se fosse o IP do visitante.

## Recolha integrada

- /api/subscribe: newsletter, manual, valor líquido, limpeza/AL e subscrição da verificação direta.
- /api/kit-trocar-janelas: PDF e newsletter, com opção comercial separada.
- /api/kit-estudante/lead: subscrição direta do kit.
- A verificação direta preserva o User-Agent original ao chamar a subscrição.
- O IP é enviado ao campo existente {$CONSENT_IP} no Sender. Nenhum fallback remove este campo para esconder uma falha. Os grupos e a autorização de envio não são alargados.

Não inclui consentimentos de formulários nativos da Meta/Make, cancelamentos no Sender, nem dados de outros produtos tratados sob outra base jurídica. Não existe backfill: registos anteriores continuam nas suas fontes, sem serem apresentados como evidência original deste arquivo. Uma repetição já concluída do Kit Janelas não cria uma declaração retroativa.

## Integridade e segurança

D1 própria, sem contactos no repositório ou no dashboard operacional. Payload AES-GCM com ID autenticado; pesquisa por HMAC do email; chaves separadas para cifragem e acesso administrativo. SHA-256 exportável do conteúdo original. A aplicação só acrescenta registos; um trigger impede UPDATE. Event_id repetido mantém a primeira evidência; mudanças de declaração com o mesmo ID falham. Novos consentimentos exigem novo event_id.

A gravação tem de concluir antes do Sender. Se falhar, não se envia o contacto. Se o Sender falhar depois, a evidência permanece. Não existe outbox/reenvio automático de email acrescentado nesta alteração.

Isto é um registo técnico da submissão, não uma confirmação de titularidade do email, assinatura digital qualificada ou certificação de conformidade. Um administrador da infraestrutura continua a ter poderes sobre a base. Eliminações controladas por retenção ou exercício de direitos continuam possíveis fora da aplicação; não tornar a retenção infinita em nome da imutabilidade. Aplicar o prazo da política existente e registar separadamente cancelamentos recebidos antes de determinar o prazo de eliminação. A interface não declara o estado atual de subscrição do Sender.

## Ativação, ainda pendente

1. Criar uma D1 exclusiva e aplicar migrations/consent-archive/0001_consent_evidence.sql.
2. Acrescentar CONSENT_ARCHIVE_DB ao wrangler.jsonc com o ID real, database_name e migrations_dir migrations/consent-archive. Não reutilizar a D1 operacional ou a base de outro produto.
3. Guardar CONSENT_ARCHIVE_KEY e CONSENT_ARCHIVE_ADMIN_TOKEN como dois secrets distintos, aleatórios, com pelo menos 32 caracteres. Guardar cópia recuperável da chave de cifragem num gestor de segredos; alterá-la sem migração torna o histórico ilegível e impede a pesquisa.
4. Verificar a existência do campo CONSENT_IP no Sender. O fluxo geral já o utiliza.
5. Publicar configuração, funções e ficheiros públicos no mesmo ciclo. Nunca publicar as funções sem o binding e a chave: as novas submissões falhariam de forma segura.
6. Não verificar o deployment ou criar contactos de teste reais automaticamente. O utilizador faz a confirmação no site.

Não é necessário um novo domínio nem Domain Connect. A área privada não é ligada à navegação pública nem ao sitemap; a API exige autenticação mesmo que alguém conheça o URL.

## Validação

Testes direcionados com SQLite em memória e Sender simulado: cifragem, deteção de adulteração, pesquisa autorizada, isolamento entre emails, paginação, conflitos de evento, preservação da evidência após falha do fornecedor e IP no Sender. Tipos das funções alteradas verificados, sem build integral.

Validação concluída: 69 testes direcionados (7 do arquivo, 30 de subscrição, 32 do Kit Janelas), mais um ensaio local do Kit Estudante com SQLite e Sender simulado. Verificação TypeScript aprovada. Nenhum build integral ou consulta de deployment.
