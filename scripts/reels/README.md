# Motor de Reels

O renderer recebe conteúdo editorial já estruturado em JSON, cria as cenas com Pillow e entrega a sequência ao FFmpeg. Não lê nem interpreta artigos e não faz chamadas externas.

Os títulos usam uma composição tipográfica própria no renderer. O tamanho máximo desce gradualmente com o comprimento, as linhas recebem espaçamento proporcional ao corpo, o wrapping equilibra a largura sem partir nem hifenizar palavras e os blocos principais aceitam até quatro linhas. Assim, esta correção aplica-se automaticamente a novos conteúdos e não depende de ajustes por Reel.

## Executar

Requisitos: Python 3.11 ou superior, Pillow, FFmpeg, ffprobe e uma fonte Inter ou equivalente disponível no sistema.

```bash
python -m pip install -r scripts/reels/requirements.txt
python scripts/reels/render.py \
  --input scripts/reels/data/herdei-uma-casa.json \
  --output out/reels/herdei-uma-casa.mp4
```

O comando valida o JSON e a imagem, cria o MP4 e a contact sheet, executa ffprobe e falha se o resultado não cumprir resolução, codec, fps, duração, formato de píxel ou configuração de áudio.

## Faixa de fundo opcional

Quando `scripts/reels/assets/background.mp3` existe, o renderer adiciona-a automaticamente a volume muito baixo, com fade-in subtil e fade-out nos últimos 1,8 segundos. A faixa é repetida se necessário e cortada à duração exata do Reel; nunca altera a duração do vídeo. Sem o ficheiro, o MP4 é gerado normalmente sem áudio. Pode indicar outro ficheiro apenas para testes através de `--audio`.

`REELS_FONT` e `REELS_FONT_BOLD` podem indicar ficheiros de fonte específicos. Sem estas variáveis, o renderer procura Inter com `fc-match` e usa uma fallback segura do sistema.

## Geração automática do JSON com OpenAI

A geração por IA é uma etapa separada e não altera o renderer. O módulo lê apenas o artigo MDX indicado e envia o frontmatter relevante e o texto editorial para a Responses API. Uma primeira chamada curta escolhe um dos três templates congelados através de Structured Outputs: `ordered_steps`, `cost_highlight` ou `problem_solution`. Uma segunda chamada recebe essa escolha e usa o schema Pydantic estrito específico do template, sem voltar a classificar o artigo.

O código regista modelo, response ID e tokens logo após cada resposta. Depois preenche deterministicamente `version`, `template`, `slug`, `category`, `heroImage` e os campos fixos do fecho. Antes de gravar, valida campos extra, densidade, quantidade de passos, truncagem, imagem, números e valores monetários. O JSON final passa ainda pelo validador usado pelo renderer. Uma falha editorial ou semântica interrompe o processo e não é corrigida silenciosamente.

Variáveis:

- `OPENAI_API_KEY`, obrigatória e nunca gravada ou impressa.
- `OPENAI_MODEL`, opcional. O default é `gpt-5-mini`.

```bash
python scripts/reels/generate_json.py \
  --slug vizinho-barulhento \
  --output out/reels-json/vizinho-barulhento.json
```

Para testar apenas a leitura e normalização do artigo, sem chamar a API nem gravar o JSON:

```bash
python scripts/reels/generate_json.py --slug vizinho-barulhento --dry-run
```

Depois da geração, o renderer existente pode usar o resultado diretamente:

```bash
python scripts/reels/render.py \
  --input out/reels-json/vizinho-barulhento.json \
  --output out/reels-ai/vizinho-barulhento.mp4
```

Os ficheiros em `scripts/reels/data/` são fixtures manuais aprovadas e não são sobrescritos. Os outputs da IA ficam em `out/reels-json/` e `out/reels-ai/`, ambos ignorados pelo Git. Para uma comparação estrutural e de densidade:

```bash
python scripts/reels/compare_json.py \
  --generated out/reels-json/vizinho-barulhento.json \
  --fixture scripts/reels/data/vizinho-barulhento.json
```

## Workflow manual com IA

O workflow `Generate Reel AI` recebe um `slug` por `workflow_dispatch`, valida imediatamente `OPENAI_API_KEY`, usa `OPENAI_MODEL` a partir das Repository Variables quando existir e gera o artifact `reel-ai-{slug}` com JSON, MP4 e contact sheet. Não publica o Reel nem altera o site.

## Testes da geração

Os testes não fazem chamadas reais à OpenAI:

```bash
python -m unittest discover -s scripts/reels/tests -p "test_*.py" -v
```

## Revisão privada em R2

O workflow `Generate Reel AI` só envia uma geração depois de o JSON, o render e o ffprobe passarem. Cada execução recebe um `generation_id` no formato `timestamp UTC + identificador curto` e grava três objetos sem substituir versões anteriores:

```text
reels/{slug}/{generation_id}/video.mp4
reels/{slug}/{generation_id}/contact.jpg
reels/{slug}/{generation_id}/reel.json
```

O upload usa `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` e, opcionalmente, `R2_ENDPOINT`. O registo de revisão reutiliza a D1 operacional através de `CLOUDFLARE_D1_DATABASE_ID` e `CLOUDFLARE_API_TOKEN`. Nenhuma credencial é impressa nos logs.
