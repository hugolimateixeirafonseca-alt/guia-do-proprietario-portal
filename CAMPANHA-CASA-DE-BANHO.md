# Campanha Casa de Banho 2026

## Estado em 15 de setembro de 2026

Publicação autorizada explicitamente pelo utilizador. Oferta casa-banho-campanha ativada pela administração autenticada (saved: true) e migração 0007 aplicada na D1 de produção com sucesso, 17 instruções concluídas. Página e configuração Meta validadas localmente. Envio da landing pelo fluxo normal de publicação nesta tarefa; conclusão do deployment e confirmação online não consultadas. Nenhum clique, lead ou evento Meta de teste criado em produção.

## Fonte e copy

- Referência visual fornecida pelo utilizador na tarefa.
- Tracking fornecido: https://adsplatform.com/?adsid=d98f9b4ea5ae54bc9d3ffd5374606925
- Destino confirmado no recurso público do parceiro em 15/09/2026. URL técnica preservada exclusivamente no campo meta_event_source_url da configuração do tracker.
- O recurso público CasaBanho2026Desc25-luU_1iG9.js confirma até 25% de desconto, orçamento gratuito e sem compromisso após visita técnica, Grande Lisboa, Sintra e Cascais.
- Corrigido o desconto fixo da referência para “até 25%”. Não foi inventado prazo de campanha.
- O desconto e o CTA são links comerciais clicáveis.
- A escolha banheira/base antiga adapta a instrução ao visitante. Não promete pré-preencher o formulário do parceiro nem transmite parâmetros de intervenção não suportados.
- Antes/depois identificado como imagem ilustrativa, sem alegar uma obra real.

## Página e recursos

- Rota: /campanha-casa-de-banho/
- Oferta: casa-banho-campanha
- Origem: campanha-casa-de-banho
- Página responsiva, duas escolhas acessíveis por teclado, rodapé e preferências de cookies.
- Canonical próprio, noindex,follow e exclusão do sitemap, tal como as landings pagas existentes.
- Open Graph 1200 × 630 e Twitter summary_large_image.
- Imagem hero WebP de 1536 × 1024 (179486 bytes) e variante 768 × 512 (39444 bytes). Partilha JPEG de 1200 × 630.
- Fontes locais já existentes no portal.

## Meta

- Dataset/Pixel existente: 1394294186173855.
- PageView através do componente central de consentimento.
- Recusar permite continuar. Identificadores Meta só seguem quando há consentimento de medição.
- Preserva utm_source, utm_medium, utm_campaign, utm_content, utm_term, campaign_id, adset_id e ad_id.
- Não dispara Lead quando se seleciona uma opção ou clica no CTA.
- Lead final via CAPI do tracker, apenas após postback approved elegível; mesma deduplicação e rotina de recuperação.
- Página de conversão configurada: formulário do parceiro em /campanhas/casa-de-banho-2026-desc25. O frontend do parceiro indica /obrigado após submissão com sucesso.
- Nenhum anúncio criado/ativado nem orçamento publicitário alterado.
- Receção real de uma lead desta oferta e evento na Meta ainda não ensaiados.

URL da landing para o anúncio:
https://guiadoproprietario.pt/campanha-casa-de-banho/

Parâmetros no campo próprio do anúncio:
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}

## Backend ativado

Configuração: guia-do-proprietario-tracker/offers/casa-banho-campanha.json.
Reutiliza partner agencia-seguro-vida, sub_id, retorno transaction_id=<idSub>, postback global autenticado e default_status approved. Não exige novo endpoint, novo segredo ou deploy de código do Worker.

Migração 0007_casa_banho_landing.sql: acrescenta mapeamento da nova origem à coluna virtual landing_url e produto “Casa de banho” às vistas de pesquisa/resumo, preservando histórico, gatilhos e o funil Cinema. Testada sobre esquema com migrações anteriores e conversão preexistente.

Ciclo de publicação autorizado:
1. Aplicar apenas a migração 0007 na D1 do tracker.
2. Guardar a nova oferta com o administrador existente. Não alterar as quatro ofertas atuais.
3. Integrar e enviar o portal pelo fluxo normal de publicação.
4. Atualizar a evidência e o estado do dashboard no mesmo ciclo.
5. A confirmação visual e funcional online cabe ao utilizador, salvo pedido expresso de verificação.

## Validação local

- Compilação isolada com @astrojs/compiler-rs e render Astro da página, layout, consentimento, ícones, CSS e script.
- Browser local em 1360, 768, 390 e 320 px: sem overflow, imagens carregadas, canonical correto, duas ligações com tracking, recusa de medição funcional, mudança de opção e ausência de erros JavaScript.
- Um teste de frontend com múltiplas asserções: desconto/CTA, IDs publicitários, consentimento e revogação, exclusão de contactos, escolha de intervenção.
- Quatro testes de backend: migração/histórico/relatórios, redirecionamento com adsid e sub_id, postbacks repetidos, autenticação de parceiro e deduplicação CAPI.
- Sem build completo do portal nem consultas online após publicação.

## Produção do visual

Imagem criada com a ferramenta integrada image_gen. O resultado não documenta um projeto real.
Prompt final:

Use case: photorealistic-natural. Asset type: website hero image, illustrative before-and-after bathroom renovation. Create a premium realistic architectural photography diptych with two equal vertical panels, 1536x1024 landscape. Show the SAME small Portuguese bathroom from the SAME fixed camera viewpoint, all wall geometry, pale warm greige stone tiles, small green plant on the far side, natural soft daylight consistent. LEFT half: ordinary white built-in bathtub with high apron, wall mounted chrome handheld shower, clean but dated. RIGHT half: that same bathtub replaced by a modern rectangular low white shower tray with transparent glass enclosure, elegant chrome rain shower; warm contemporary light stone tiles, welcoming and plausible. Frame shower/bathtub full height including floor, not cropped at bottom. Straight walls and plausible fixtures, refined neutral beige palette. Thin white vertical divider exactly in centre. NO text, letters, captions, logos, watermark, arrows, people, extra collage panels. The website adds labels separately. This is an illustrative transformation concept, not documentation of a real client renovation.

## Revisão de marca

Por instrução do utilizador, removido o nome do cliente de toda a comunicação da campanha: texto, rótulos acessíveis, metadados, instruções após seleção, rodapé e imagem de partilha. Nome de apresentação da oferta também neutralizado. URLs técnicas de destino necessárias à atribuição permanecem apenas na configuração de integração. Nome do cliente ausente da comunicação pública. Publicação e ativação posteriormente autorizadas.
