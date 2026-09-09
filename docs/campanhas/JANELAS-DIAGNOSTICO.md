# Diagnóstico de Janelas, 9 de setembro de 2026

Pré-landing implementada e validada localmente. Publicação no domínio autorizada pelo utilizador em 9 de setembro de 2026. Endereço: https://guiadoproprietario.pt/janelas-diagnostico/.

## Conteúdo e condições

Três perguntas: problema, quantidade de janelas e concelho. Não solicita nome, telefone ou email. Respostas apenas em memória da página, não guardadas nem transmitidas ao parceiro. Resultado contextual, sem prometer uma avaliação técnica ou aprovação de lead.

Fonte: https://www.nuvi.pt/campanhas/janelas-2026-desc25, conteúdo público consultado em 9 de setembro de 2026. Campanha de janelas em PVC com até 25% de desconto, orçamento grátis e sem compromisso após visita técnica. Serviço para 3 ou mais janelas. Conteúdo confirmado no módulo público Janelas2026Desc25-CDbpP_xh.js. Não usar a menção a Margem Sul existente nos metadados: o utilizador limitou expressamente aos sete concelhos.

Zonas: Amadora, Cascais, Lisboa, Loures, Odivelas, Oeiras e Sintra. Todas as respostas, incluindo Outra zona, 1–2 e Ainda não sei, conduzem ao resultado com o botão de encaminhamento. A quantidade e a zona são apresentadas como respostas declaradas, sem afirmar elegibilidade ou cobertura. A validação comercial compete ao cliente. Animação de 1,2 segundos apresenta a preparação do resultado.

Imagem: reutilizada public/imagens/artigos/escolher-janelas.webp, preservando o estilo ilustrado do Guia. Fotografia da NUVI não integrada.

## Integração

Oferta: janelas-diagnostico. CTA: https://track.guiadoproprietario.pt/go/janelas-diagnostico.
Destino afiliado fornecido: https://adsplatform.com/?adsid=e967767aead7b51505f329f4b3ea3fb4.
Reutiliza partner agencia-seguro-vida, parâmetro sub_id, retorno transaction_id=<idSub>, postback global e token privado existentes. Sem novo endpoint ou token. Página do evento Meta: a página do formulário NUVI. Lead apenas após postback validado, nunca no quiz ou clique.

CookieConsent e tracker-link.mjs reutilizados. Etiquetas UTM e IDs de campanha passam pelo helper existente. Identificadores Meta apenas com consentimento válido. Sem formulário de contactos, API nova, Sender ou envio de respostas.

Payout comercial comunicado: 7 EUR por lead válida. Não representa receita antes do postback. A oferta não inventa payout em eventos: o tracker conserva o valor recebido do parceiro, quando fornecido.

## Validação

Compilação isolada do Astro atual, layout e consentimento; JavaScript verificado; 3 testes direcionados, incluindo as 200 combinações de respostas, todas com encaminhamento, respostas incompletas e encaminhamento sem contactos ou identificadores Meta sem consentimento. Pré-visualização local responde HTTP 200. Sem ensaio de lead real, sem confirmação de conversão na Meta e sem verificação de publicação no domínio.

Gravação da oferta confirmada pela resposta administrativa em 9 de setembro: saved=true, slug=janelas-diagnostico. O botão da pré-visualização pode encaminhar pelo tracker. Sem clique de ensaio ou conversão artificial.

## Revisão solicitada pelo utilizador

Retiradas as menções públicas à NUVI, a frase sobre nome/telefone/email e a menção à comissão. Todas as respostas completas chegam ao CTA do cliente; removido o ecrã de exclusão. Mantidos o destino real, a oferta, o tracker e o postback global. O resultado não declara cobertura nem aprovação. Pré-visualização local atualizada; publicação no domínio continua pendente.

## Autorização e confirmação de tracking

Publicação autorizada pelo utilizador. Oferta ativa relida pela administração autenticada: mesmo partner agencia-seguro-vida da Certezza, subid_parameter sub_id, default_status approved e meta_enabled ativo. Mesmo postback global, retorno transaction_id=<idSub> e token privado existente, sem rotação ou nova configuração de endpoint. Apenas slug, link adsid e página do formulário diferem por campanha. Nenhum postback artificial enviado. Nova rota excluída do sitemap, com noindex, como as outras pré-landings pagas.
