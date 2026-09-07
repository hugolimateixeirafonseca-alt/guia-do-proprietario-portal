# Campanha de seguro de vida do crédito habitação

Preparada em 7 de setembro de 2026. Fonte de verdade da implementação e das decisões desta campanha.

## Estado real

- Três artigos escritos e uma pré-landing implementada na branch local `agent/seguro-vida-campanha`.
- Sem envio para o repositório remoto, sem publicação e sem confirmação online.
- Os artigos usam `rascunho: true`: não entram nas listagens, RSS, feed, sitemap ou páginas de produção. O servidor local permite rever apenas os rascunhos com o tema `campanha-seguro-vida`.
- A landing tem `noindex,follow` e está excluída do sitemap. Não está ligada na navegação pública. O ficheiro existe apenas nesta branch até integração autorizada.
- Os campos de data dos rascunhos são provisórios para a pré-visualização. Na preparação da publicação devem ser atualizados para a data efetiva e passar pela rotina normal de datas do portal.
- Nenhuma lead foi recolhida, nenhum anúncio foi criado e nenhum link de afiliado foi aberto para testar atribuição.

## Páginas

| ID | Conteúdo | Rota prevista |
| --- | --- | --- |
| SC35 | Quanto pode poupar no seguro de vida do crédito habitação? Saiba o que comparar | /casa/seguro-vida-credito-habitacao-poupar/ |
| SC36 | Tem o seguro de vida no banco? O que deve verificar antes de mudar | /casa/mudar-seguro-vida-credito-habitacao-banco/ |
| SC37 | Seguro de vida do crédito habitação: 5 pontos a comparar além do preço | /casa/comparar-seguro-vida-credito-habitacao/ |
| Landing | A casa é a mesma. O seguro de vida pode custar menos. | /seguro-vida-credito-habitacao/ |

## Destinos fornecidos pelo utilizador

- Pré-landing: https://adsplatform.com/?adsid=7efb1337347c0ae601f420f34ba38154
- Editorial: https://adsplatform.com/?adsid=4713195f3e647940b7614c616838155c

Os endereços são usados exatamente como fornecidos. Não são acrescentadas UTMs nem substituído o adsid. A propagação ou atribuição depois do redirecionamento depende da plataforma e não foi confirmada. As UTMs admissíveis são preservadas apenas nas ligações internas da campanha, sem copiar parâmetros arbitrários, dados de contacto ou click IDs.

## Decisões editoriais

- Português de Portugal, identidade do Guia, sem nome ou logótipo do cliente.
- Disclosure comercial e ligações marcadas como `sponsored`.
- Nenhuma reprodução das alegações de poupança de 60% ou 20.000 €, nem de testemunhos do cliente.
- Exemplos claramente hipotéticos. A comparação inclui proteção e efeito no crédito.
- Pedido de simulação apresentado como pedido que permite contacto telefónico, sem promessa de cotação imediata.
- Fontes oficiais específicas do Banco de Portugal e da ASF identificadas nos artigos e na landing.
- Reutilização da ilustração existente sobre casa e crédito, sem apresentar uma pessoa ilustrada como cliente real.

## Pré-visualização e validação

As quatro rotas foram compiladas individualmente pelo servidor local, sem build integral. O exportador `scripts/preview-seguro-vida.mjs` verifica os nove CTAs, as regras editoriais, os rascunhos, a compilação dos componentes alterados, a ausência de formulários, os metadados e as regras de preservação de UTMs. Cria quatro HTML autónomos com CSS e imagens incorporados, sem scripts ou recolha de dados, em `D:/CodexProjects/Products/relatorios/campanha-seguro-vida/`.

Não foi feita verificação visual em browser nem confirmação online. A revisão visual e funcional cabe ao utilizador. A versão HTML de revisão tem navegação própria entre as quatro páginas; essa barra não faz parte das páginas de produção.

## Publicação futura

Após a revisão, integrar a campanha e o estado operacional no mesmo ciclo. Preparar as datas reais, retirar `rascunho: true` dos três artigos e validar apenas as verificações afetadas. Manter o `noindex` da landing de performance. A medição de leads depende de um evento confirmado no destino, nunca do clique de saída no Guia.
