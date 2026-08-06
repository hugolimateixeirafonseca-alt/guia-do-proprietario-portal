# Registo de decisões

Este ficheiro regista decisões que afetam várias áreas do projeto. Uma alteração deve indicar data, motivo e impacto. É a fonte de verdade partilhada entre o Hugo, o Claude e o Codex: o Codex implementa a partir daqui, não a partir de conversas.

## 2026-07-19

### D001. Pasta raiz

- Decisão: pasta raiz do projeto. Atualização de 2026-07-24: o projeto foi movido para `C:\Users\screa\Documents\Products\guia-do-proprietario`. Todos os ficheiros novos ficam nesta estrutura.
- Motivo: separar o portal do protótipo anterior e concentrar os trabalhos futuros.

### D002. Marca e domínio

- Decisão: Guia do Proprietário como nome e `guiadoproprietario.pt` como domínio.
- Atualização de 2026-07-24: domínio adquirido. Pesquisa de marca concluída no INPI, com as variantes "guiadoproprietario", "Guia do Proprietário" e "proprietário", e no TMview, que cobre também as marcas da União Europeia. Sem conflitos. O único registo nacional ativo próximo é GABINETE DO PROPRIETÁRIO, nas classes 36, 42 e 45, com elemento distintivo diferente e coincidência apenas na palavra descritiva. No TMview, o único resultado é um pedido brasileiro para "Manual do Proprietário" na classe 16, sem efeitos em Portugal.
- O registo de marca fica adiado para uma fase com receita e, nessa altura, faz-se na versão figurativa com logótipo, porque o nome é descritivo e a proteção da expressão isolada seria fraca ou recusada.
- Estado: fechado.

### D003. Arquitetura de produto

- Decisão: o portal editorial é o produto principal. As landings de captação pertencem ao mesmo universo de marca e devem conservar navegação, confiança e transparência adequadas.
- Motivo: permitir crescimento editorial e comercial sem limitar a marca à venda de imóveis.

### D004. Landing de referência

- Decisão: preservar a cópia do protótipo anterior em `landings/avaliacao-imovel/prototipo-v0`. O projeto de origem não deve ser alterado.

### D005. Dados e conformidade

- Decisão: não recolher nem transmitir dados pessoais reais nesta fase.
- Condições para mudar: validação jurídica, identificação do responsável pelo tratamento, política e lista de parceiros publicadas, base legal definida, consentimentos aplicáveis, segurança, retenção, contratos e processo de direitos dos titulares.
- Nota de 2026-07-24: o portal editorial sem recolha de dados pode publicar antes destas condições; as condições aplicam-se às landings e à operação de leads.

### D006. Linguagem

- Decisão: escrever em português de Portugal e evitar travessões longos e médios. Preferir pontos, vírgulas, dois pontos ou frases separadas. A SITE-SPEC transforma esta regra em verificação automática no build.

## 2026-07-24

### D007. Consentimento em dois tempos nas landings

- Decisão: a estimativa mostra-se mediante nome e email apenas. O telefone e a autorização de transmissão a um parceiro são pedidos depois do resultado, como opt-in ativo.
- Motivo: o RGPD exige consentimento livre; condicionar a estimativa à transmissão a parceiros fragiliza a validade das leads. Comercialmente, quem pede contacto depois de ver o valor é lead mais quente.
- Impacto: nenhuma landing pode voltar a exigir telefone ou consentimento de parceiro antes do resultado.

### D008. Estrutura de produto comercial

- Decisão: landing 1 de avaliação indicativa, landing 2 de valor líquido da venda (simulador com comissão, certificado, documentação, crédito por escalões e mais-valias simplificadas), e área do parceiro para receção e gestão de leads. Backend real, autenticação e transmissão só depois da validação da experiência com dados fictícios.

### D009. Modelo de remuneração e atribuição v0

- Decisão: leads iguais com preço único, exclusivas, atribuídas pela zona do imóvel. Contacto mascarado até à aceitação; aceitar revela o contacto e torna a lead faturável. A lead aceite confirma automaticamente ao fim de 72 horas, salvo invalidação por um de quatro motivos objetivos: número inexistente ou errado, contacto duplicado, imóvel fora da zona, a pessoa nega o pedido. Não atender não invalida. Com mais de um consultor na zona, o primeiro a aceitar fica com a lead; quem não aceita nunca vê o contacto. Pós-pago: fatura-se no fim do período apenas o aceite e não invalidado.
- Motivo: proteger a redistribuição (sem contacto visível não há cópia de dados), eliminar disputas de cobrança por inércia, e manter a operação simples no piloto. Sem scores, sem classes de preço, sem carteiras de créditos nesta fase.
- Impacto: o dashboard do parceiro implementa os estados disponível, aceite, válida, inválida e transferida, com o copy aprovado (a validade é o caminho por omissão, a invalidação é a exceção).

### D010. Fonte e metodologia do estimador

- Decisão: INE, Estatísticas de Preços da Habitação ao nível local. Mediana de €/m² da freguesia com fallback para o concelho quando suprimida, série de apartamentos ou moradias conforme o tipo, ajuste parametrizável para imóveis a precisar de obras, faixa de mais ou menos 12 a 15 por cento. A fonte e a data dos dados aparecem sempre junto ao resultado. Terrenos ficam fora do método. Upgrade futuro possível para AVM comercial (Alfredo ou Casafari) sem mudar o fluxo.

### D011. Portal: stack, autoria e conteúdo

- Decisão: Astro em Cloudflare Pages, conteúdo em Markdown no repo, ilhas interativas apenas nos simuladores. Autoria institucional (Redação Guia do Proprietário) sustentada pelas páginas Sobre e Metodologia, com o fundador identificado como editor e curador. Sem autores fictícios. Volume diário vai para as redes sociais via automação Make com link para páginas fortes do site. No site: páginas programáticas por concelho a partir de dados oficiais (taxas de IMI da AT, medianas do INE) e 2 a 3 artigos por semana gerados com apoio de IA mas publicados apenas após aprovação humana de um clique. Analítica sem cookies. Newsletter desde o primeiro dia. Especificação completa em `site/SITE-SPEC.md`.
- Motivo: separar o que cada canal recompensa. As redes premeiam volume; o Google penaliza conteúdo automático em massa sem confiança, sobretudo em temas fiscais e jurídicos.

### D012. Divisão de trabalho entre assistentes

- Decisão: o Claude é arquiteto e revisor (investigação, decisões, specs, conteúdo, revisão); o Codex é executor (implementação no repo). O repo é a fonte de verdade: as decisões entram neste ficheiro e as specs em ficheiros próprios, e o Codex implementa a partir deles. O Codex não altera decisões registadas; em caso de bloqueio, pergunta antes de decidir.

### D013. Equilíbrio editorial entre linguagem simples e conteúdo técnico

- Decisão: cada artigo passa a ter um nível, `essencial` ou `detalhado`. O essencial é escrito para quem nunca tratou do assunto, com um máximo de 800 palavras, jargão sempre traduzido, números concretos e perguntas rápidas no fim. O detalhado mantém o registo atual. Cada tema pesado tem primeiro a versão essencial, e as duas ligam-se uma à outra. Proporção alvo de publicação: 60 por cento essencial, 40 por cento detalhado, e 6 para 4 nas redes sociais.
- Motivo: o portal ficou com cara de manual fiscal e os quatro pilares iniciais eram todos administrativos. O conteúdo técnico continua a ser o que rankeia em pesquisas específicas e o que sustenta credibilidade junto dos parceiros, mas deixa de ser a porta de entrada.
- Impacto: pilar novo Casa e obras (custos reais, manutenção, energia, vizinhança), página de glossário, componente de custos em intervalos, simuladores com ajuda por campo e auxiliar para quem não sabe o VPT. Especificação em `ALTERACOES-PORTAL-V3.md`; plano de artigos e de redes atualizados.

### D014. Fontes de dados oficiais

- Decisão: as taxas de IMI vêm da consulta pública da Autoridade Tributária, por ano e distrito, e os preços da habitação vêm da API pública do INE, indicador 0012234, confirmado a 2026-07-24.
- Nota metodológica com efeito em todo o projeto: o indicador 0012234 é o valor mediano das vendas dos últimos 12 meses, não o valor do trimestre. Os números dos destaques trimestrais do INE são mais altos em fase de subida de preços e não servem para validar a série. Nenhuma página, nota ou publicação social pode dizer "no trimestre X o preço foi Y"; a formulação obrigatória é "mediana das vendas dos últimos 12 meses, atualizada no [período]".
- A lista mestra de municípios segue a geografia NUTS 2024, a mesma do indicador.
- Especificação e critérios em `DADOS-SPEC.md`.

### D015. Analítica e newsletter

- Decisão: analítica com Cloudflare Web Analytics, sem cookies, ativada no painel do Cloudflare Pages no momento do primeiro deploy. Sem Google Analytics, sem tag managers e sem pixels de redes sociais no portal editorial.
- Decisão: a newsletter fica sem fornecedor e desativada por agora. Não se recolhem emails em nenhum sistema provisório, incluindo folhas de cálculo, por não garantirem duplo consentimento, prova de subscrição nem mecanismo de cancelamento.

### D016. Rumo editorial e postura sobre dados (25 jul 2026)

- Decisão: priorizar artigos correntes e de senso comum, com o pilar Casa e obras à cabeça (custos, manutenção, humidade, energia, vizinhança). O conteúdo fiscal e jurídico fica ao mínimo indispensável e como camada de fundo; os artigos fiscais já escritos mantêm-se publicados, mas não se abrem novos nessa linha sem razão forte.
- Decisão: não há verificação manual dos dados de IMI e preços concelho a concelho antes de publicar. A exposição é controlada pela própria página, que mostra sempre a fonte, a data e o enquadramento de estimativa, com remissão para o Portal das Finanças e o INE. Erros pontuais corrigem-se no ficheiro de dados.
- Impacto: a homepage e a navegação passam a dar destaque ao dia a dia (ver ALTERACOES-PORTAL-V5.md); o plano de conteúdos reordena-se em torno de Casa e obras.

### D017. Publicação e independência operacional (25 jul 2026)

- Decisão: o portal vive em repositório GitHub com deploy automático no Cloudflare Pages a cada commit. Publicar um artigo é adicionar um ficheiro .mdx em src/content/artigos/ pelo browser; o site reconstrói sozinho. O Codex deixa de ser necessário para publicar conteúdo.
- Analítica: Cloudflare Web Analytics ativa. Conversão automática de PNG/JPG para AVIF e WebP no build. Campo rascunho: true mantém um artigo fora do site e dos feeds.
- Domínio: guiadoproprietario.pt fica por ligar. Só se aponta ao Cloudflare quando o site estiver pronto para ser promovido, para o endereço definitivo ser o que o Google indexa. Até lá usa-se o endereço .pages.dev.

## 2026-08-06

### D018. Descoberta e continuidade editorial no portal

- Decisão: a área «Mais recentes» ordena os artigos pelo momento em que entram no portal, separado da data editorial de publicação. O workflow regista esse momento automaticamente e preserva a ordem da fila dentro de cada lote.
- Decisão: a homepage apresenta, antes de «Mais recentes», uma área «Em destaque» com o manual «Vender a sua casa em Portugal» e ligação direta para a landing.
- Decisão: cada artigo termina, depois das fontes, com três artigos semelhantes. A seleção privilegia temas específicos e palavras-chave em comum, recorrendo ao pilar apenas como sinal secundário.
- Estado: implementado, validado localmente e enviado para publicação em 6 de agosto de 2026. A confirmação online não foi realizada.

### D019. Publicação autónoma de novidades no portal

- Decisão: cada novidade é um ficheiro `.mdx` em `src/content/notas`, com o formato definido em `MODELO-NOVIDADE.mdx`.
- Publicação: depois do commit no ramo principal, o deploy automático atualiza a página individual, o índice `/novidades/`, a secção Novidades da página inicial, o sitemap e o feed JSON.
- Ordenação: as novidades aparecem da mais recente para a mais antiga através do campo `data`.
- Página inicial: mantém-se a grelha geral Novidades, imediatamente depois da secção Mais recentes. O quadro duplicado «Última novidade» é removido.
