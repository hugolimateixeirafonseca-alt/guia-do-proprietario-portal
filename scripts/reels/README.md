# Motor de Reels

O renderer recebe conteúdo editorial já estruturado em JSON, cria as cenas com Pillow e entrega a sequência ao FFmpeg. Não lê nem interpreta artigos e não faz chamadas externas.

## Executar

Requisitos: Python 3.11 ou superior, Pillow, FFmpeg, ffprobe e uma fonte Inter ou equivalente disponível no sistema.

```bash
python -m pip install -r scripts/reels/requirements.txt
python scripts/reels/render.py \
  --input scripts/reels/data/herdei-uma-casa.json \
  --output out/reels/herdei-uma-casa.mp4
```

O comando valida o JSON e a imagem, cria o MP4 e a contact sheet, executa ffprobe e falha se o resultado não cumprir resolução, codec, fps, duração, formato de píxel ou ausência de áudio.

## Faixa de fundo opcional

Quando `scripts/reels/assets/background.mp3` existe, o renderer adiciona-a automaticamente a volume muito baixo, com fade-in subtil e fade-out nos últimos 1,8 segundos. A faixa é repetida se necessário e cortada à duração exata do Reel; nunca altera a duração do vídeo. Sem o ficheiro, o MP4 é gerado normalmente sem áudio. Pode indicar outro ficheiro apenas para testes através de `--audio`.

`REELS_FONT` e `REELS_FONT_BOLD` podem indicar ficheiros de fonte específicos. Sem estas variáveis, o renderer procura Inter com `fc-match` e usa uma fallback segura do sistema.
