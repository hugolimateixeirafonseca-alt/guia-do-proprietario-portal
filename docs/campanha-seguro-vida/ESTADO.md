# Campanha de seguro de vida do crédito habitação

Preparada em 7 de setembro de 2026. Fonte de verdade da implementação e das decisões desta campanha.

## Estado real

- Três artigos escritos e duas variantes de pré-landing implementadas na branch local `agent/seguro-vida-campanha`.
- Sem envio para o repositório remoto, sem publicação e sem confirmação online.
- Os artigos usam `rascunho: true`: não entram nas listagens, RSS, feed, sitemap ou páginas de produção. O servidor local permite rever apenas os rascunhos com o tema `campanha-seguro-vida`.
- A landing tem `noindex,follow` e está excluída do sitemap. Não está ligada na navegação pública. O ficheiro existe apenas nesta branch até integração autorizada.
- Os campos de data dos rascunhos são provisórios para a pré-visualização. Na preparação da publicação devem ser atualizados para a data efetiva e passar pela rotina normal de datas do portal.
- Nenhuma lead foi recolhida, nenhum anúncio foi criado e nenhum link de afiliado foi aberto para testar atribuição.

## Páginas

| ID | Conteúdo | Rota prevista |
| --- | --- | --- |
| SC35 | Seguro de vida do crédito habitação: está a pagar mais do que precisa? | /casa/seguro-vida-credito-habitacao-poupar/ |
| SC36 | Seguro de vida no banco? Descubra se pode pagar menos fora. | /casa/mudar-seguro-vida-credito-habitacao-banco/ |
| SC37 | Paga o seguro de vida todos os meses. Está a comprar a proteção certa? | /casa/comparar-seguro-vida-credito-habitacao/ |
| Landing | Está a pagar demasiado pelo seguro de vida? | /seguro-vida-credito-habitacao/ |
| Variante visual próprio | Poupe até 60% no seguro de vida do crédito habitação. | /seguro-vida-simulacao/ |

## Destinos fornecidos pelo utilizador

- Pré-landing: https://adsplatform.com/?adsid=7efb1337347c0ae601f420f34ba38154
- Editorial: https://adsplatform.com/?adsid=4713195f3e647940b7614c616838155c

Os endereços são usados exatamente como fornecidos. Não são acrescentadas UTMs nem substituído o adsid. A propagação ou atribuição depois do redirecionamento depende da plataforma e não foi confirmada. As UTMs admissíveis são preservadas apenas nas ligações internas da campanha, sem copiar parâmetros arbitrários, dados de contacto ou click IDs.

## Decisões editoriais

- Português de Portugal, sem nome ou logótipo do cliente. Primeira landing com identidade do Guia; segunda com visual próprio, mantendo a identificação do promotor no rodapé.
- Disclosure comercial e ligações marcadas como `sponsored`.
- Os três artigos e a primeira landing não reproduzem percentagens de poupança. Na segunda variante, a pedido do utilizador, o máximo de 60% anunciado pelo parceiro é o destaque principal, com atribuição e condições junto da oferta. Sem reprodução de 20.000 € ou de testemunhos.
- Exemplos claramente hipotéticos. A comparação inclui proteção e efeito no crédito.
- Pedido de simulação apresentado como pedido que permite contacto telefónico, sem promessa de cotação imediata.
- Fontes oficiais específicas do Banco de Portugal e da ASF identificadas nos artigos e na landing.
- Reutilização da ilustração existente sobre casa e crédito, sem apresentar uma pessoa ilustrada como cliente real.

## Pré-visualização e validação

As quatro rotas foram compiladas individualmente pelo servidor local, sem build integral. O exportador `scripts/preview-seguro-vida.mjs` verifica os 13 CTAs, as regras editoriais, os rascunhos, a compilação dos componentes alterados, a ausência de formulários, os metadados e as regras de preservação de UTMs. Cria quatro HTML autónomos com CSS e imagens incorporados, sem scripts ou recolha de dados, em `D:/CodexProjects/Products/relatorios/campanha-seguro-vida/`.

Não foi feita verificação visual em browser nem confirmação online. A revisão visual e funcional cabe ao utilizador. A versão HTML de revisão tem navegação própria entre as quatro páginas; essa barra não faz parte das páginas de produção.

## Publicação futura

Após a revisão, integrar a campanha e o estado operacional no mesmo ciclo. Preparar as datas reais, retirar `rascunho: true` dos três artigos e validar apenas as verificações afetadas. Manter o `noindex` da landing de performance. A medição de leads depende de um evento confirmado no destino, nunca do clique de saída no Guia.

## Segunda variante de pré-landing

Adicionada a pedido do utilizador em 7 de setembro de 2026, com visual próprio, fotografia gerada e quatro posições de CTA. Documentação, fontes, adaptação da oferta e hipótese de teste em `VARIANTE-PERFORMANCE.md`. A validação isolada e exportação desta quinta página usa `scripts/preview-seguro-vida-performance.mjs`; as quatro páginas anteriores permanecem inalteradas. As duas pré-landings têm `noindex` e exclusão do sitemap. Estado apenas local, sem medição de conversões.

## Revisão comercial orientada à conversão

Reescrita a pedido do utilizador: títulos e aberturas centrados no custo de continuar sem comparar, no preço da alternativa e no pedido gratuito. A landing tem quatro CTAs, elimina as saídas para artigos e termina num pedido de simulação. Cada artigo tem três CTAs, incluindo um antes do corpo editorial. Os exemplos e o aviso geral passam para depois do corpo, mantendo claras as condições materiais no texto. As recomendações de outros artigos e a newsletter são omitidas apenas nesta campanha. As perguntas frequentes resolvem as objeções ao pedido. Os dois links de afiliado permanecem exatos. Não há percentagens, testemunhos ou urgência inventados. Sem testes de performance reais ou publicação.
