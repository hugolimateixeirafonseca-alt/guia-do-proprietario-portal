# Make mapping — Radar Editorial → publicacoes

O webhook deve usar autenticação nativa do Make. O radar envia `MAKE_RADAR_WEBHOOK_SECRET` no header `x-make-apikey`.

O radar envia apenas acontecimentos com `news_score` acima do limiar e já produz o texto de Facebook e o corpo Markdown da Novidade.

## Campos recebidos

- `type`
- `event_id`
- `event_key`
- `titulo_noticia`
- `pilar`
- `legal_stage`
- `fonte_nome`
- `url_original`
- `data_publicacao`
- `conteudo_verificado`
- `texto_fb`
- `texto_site`
- `news_score`
- `seo_score`
- `lead_score`
- `content_impacts[]`

## Google Sheets: publicacoes

Preservar o formato atual do workbook GP Redes Sociais:

- A codigo = `NOT-auto`
- B pilar = `pilar`
- C formato = `noticia`
- D plataforma = `facebook`
- E texto_fb = `texto_fb`
- G link = `url_original`
- H link_onde = `corpo`
- K destino_ok = `Sim`
- L estado = `por_aprovar`
- W = `conteudo_verificado`
- X = `texto_site`
- Y = `fonte_nome`
- Z = `data_publicacao`
- AA = `titulo_noticia`

As restantes colunas ficam vazias. O publicador existente só atua depois de o utilizador mudar L de `por_aprovar` para `pronto`.


## v21.2
O webhook recebe todos os acontecimentos aceites pelo editor, não apenas notícias publicáveis.
Campos adicionais:
- `tipo_evento`: `NOVO` ou `NOVO_MARCO`
- `seo_trigger`: `Sim` quando `seo_score >= 80`
- `lead_trigger`: `Sim` quando `lead_score >= 80`
- `impacto_conteudo`: impacto mais forte detetado ou `NONE`
- `estado`: `novo` ou `novo_marco`
- `type`: `noticia` apenas quando `news_score >= 80`; caso contrário `radar`

Isto permite registar todas as oportunidades em `radar_editorial` e deixar o Make enviar apenas notícias publicáveis para `publicacoes`.
