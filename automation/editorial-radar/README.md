# GP Editorial Radar v21.2

Substitui o rastreador RSS por pesquisa aberta na web e memória editorial permanente.

## Princípios

1. A unidade é o acontecimento, não o URL.
2. Pesquisa web em sweeps temáticos + oficiais + catch-all.
3. Antes de registar, verifica histórico e classifica `NOVO`, `DUPLICADO`, `NOVO_MARCO` ou `IGNORAR`.
4. Só acontecimentos novos entram na fila Make/Sheets.
5. Notícias continuam notícias: Facebook + `/novidades/` pelo publicador atual.
6. SEO e Lead são scores paralelos, não transformam automaticamente a notícia.
7. Cada notícia nova é comparada com artigos evergreen existentes. Alterações são guardadas em `content_impacts` como propostas; nunca altera automaticamente um artigo na v1.

## Secrets GitHub necessários

- `OPENAI_API_KEY`
- `CF_ACCOUNT_ID`
- `CF_D1_DATABASE_ID`
- `CF_D1_API_TOKEN` com D1 Read + Write apenas na conta/base necessária
- `MAKE_RADAR_WEBHOOK`
- `MAKE_RADAR_WEBHOOK_SECRET` opcional mas recomendado

Não guardar nenhuma destas credenciais no repositório público.

## D1

Criar uma base, por exemplo `gp-editorial-radar`, preferencialmente com jurisdição EU. O script aplica `schema.sql` de forma idempotente em cada execução.

O GitHub Action acede ao D1 pelo endpoint oficial REST `/accounts/{account_id}/d1/database/{database_id}/query`, evitando CPU de Worker.

## Primeira execução

Executar manualmente `Editorial Radar v21` com:

- mode: `morning`
- dry_run: `true`
- backfill: `true`

Isto cria a memória e importa as notícias já existentes em `src/content/notas` sem enviar nada ao Make.

Depois executar novamente com `dry_run: true`, `backfill: false` e rever os logs/D1.

Só depois colocar `dry_run: false`.

## Webhook Make

O Make recebe apenas notícias que passaram todas as barreiras. Payload resumido:

```json
{
  "type": "noticia",
  "event_id": "evt_...",
  "event_key": "...",
  "title": "...",
  "pillar": "condominio",
  "legal_stage": "proposta",
  "source": {
    "source_name": "CNN Portugal",
    "article_url": "https://...",
    "event_date": "2026-08-13"
  },
  "verified_summary": "...",
  "key_facts": [],
  "entities": [],
  "news_score": 95,
  "seo_score": 85,
  "lead_score": 10,
  "content_impacts": []
}
```

O cenário Make novo deve apenas:

1. receber Custom Webhook;
2. validar `X-GP-Radar-Secret`;
3. mapear os campos para a folha `publicacoes`;
4. manter `formato=noticia` e `estado=por_aprovar`;
5. não publicar nada diretamente.

O publicador atual continua a exigir `estado=pronto`.

## Impacto em artigos existentes

A tabela `content_index` é reconstruída incrementalmente a partir de `src/content/artigos`.

Para cada novo acontecimento, o radar procura artigos potencialmente afetados e grava apenas impactos com confiança >= 80 em `content_impacts`:

- `ADDENDUM`
- `PARTIAL_UPDATE`
- `REWRITE`
- `URGENT_CORRECTION`

Para propostas/rumores legais, o prompt proíbe substituir a regra em vigor. A atualização factual efetiva é recomendada sobretudo em `publicacao`/`entrada_em_vigor`.

## Segurança

O repositório é público. Nunca colocar PATs, OpenAI keys, Cloudflare tokens ou URLs de webhooks com segredo em ficheiros versionados.

O token GitHub encontrado no blueprint Make antigo deve ser revogado/rodado e removido de configurações exportáveis.


## Make authentication

The Make Custom Webhook uses its native API-key authentication. `MAKE_RADAR_WEBHOOK_SECRET` is sent as the `x-make-apikey` HTTP header.

Before sending to Make, the radar generates the final Facebook copy and Markdown body using `OPENAI_COPY_MODEL` (default `gpt-5.6-luna`).


### Nota v21.2
Todos os acontecimentos editoriais aceites seguem para `radar_editorial`. Só os que atingem `news_score >= 70` recebem copy de Facebook/site, orientação visual sem texto e `type=noticia`.
