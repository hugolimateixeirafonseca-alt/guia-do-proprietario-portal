# Ativação técnica da Verificação de Anúncio

Este documento separa o que já existe no repositório do que ainda depende de recursos Cloudflare e credenciais de produção.

## Implementado no repositório

- página privada de envio em `/verificacao/enviar/?t=TOKEN`;
- validação server-side de token, origem, cidade, consentimento, quantidade, tamanho, MIME e assinatura binária das imagens;
- upload de uma a oito capturas JPEG, PNG ou WebP;
- consulta privada do estado em `/api/verificacao-anuncio/status?t=TOKEN`;
- armazenamento dos objetos no R2 por identificador interno, sem reutilizar o nome original do ficheiro;
- transição única de `aguarda_upload` para `em_analise`;
- envio idempotente para a fila de processamento;
- reversão da transição e limpeza dos objetos se a fila estiver indisponível;
- esquema D1 em `migrations/0002_verificacao_anuncio.sql`;
- cliente transacional Sender.net e contratos dos templates;
- criação segura de uma sessão Stripe Checkout para uma compra única;
- validação do pagamento por webhook Stripe assinado, incluindo produto, preço de 3,90 €, moeda e estado pago;
- criação idempotente do pedido e da ligação privada de upload após confirmação do pagamento;
- página neutra de confirmação em `/verificacao/confirmacao/`, sem expor a ligação privada;
- compra protegida pela variável pública `PUBLIC_VERIFICACAO_CHECKOUT_ENABLED`, desligada por defeito.
- consumidor dedicado da Queue com repetição controlada e fila de falhas;
- duas passagens de análise com `gpt-5.4-mini`, imagens apenas na extração e `store=false`;
- leitura visual das próprias capturas pela IA, com coerência, características visíveis e confirmações a pedir;
- nenhuma pesquisa inversa ou consulta externa das fotografias;
- relatório web privado, sem indexação, com apresentação visual premium e plano de ação para todos os pontos em aberto;
- seis eventos pela API transacional Sender.net: receção, relatório, falha, lembretes de 24 horas e 7 dias e reembolso;
- idempotência dos emails, reembolsos e consumo da fila;
- eliminação das imagens 48 horas após o upload;
- expiração do relatório ao fim de 90 dias e limpeza dos PDFs legados que ainda existam;
- reembolso integral automático depois das tentativas técnicas ou quando termina o prazo de upload;
- cron de manutenção executado aos 17 minutos de cada hora;
- migração adicional `0004_verificacao_anuncio_processing.sql` para processamento, notificações e retenção.

## Decisão de email

O briefing v1.2 dizia para não usar Sender.net e sugeria Resend ou MailerSend. O código já continha um cliente para a API transacional do Sender.net e o proprietário confirmou posteriormente a decisão de manter esse fornecedor. Esta decisão posterior é a vigente.

Em 30 de agosto de 2026 foi confirmada diretamente na conta Sender a seguinte situação: a API transacional está ativa e tem envios, mas a área de templates transacionais está vazia. Os emails existentes pertencem ao Kit do Estudante, a campanhas ou a automações e não podem ser reutilizados como templates transacionais deste produto.

O produto usa por isso o endpoint oficial `POST /v2/message/send`, com assunto, HTML, texto e ligação privada definidos no código. Mantém seis mensagens próprias e idempotentes, sem adicionar compradores a grupos, newsletters, campanhas ou automações de marketing. O remetente configurado é `geral@guiadoproprietario.pt`, no domínio confirmado na conta Sender.

## Decisão posterior sobre o formato do relatório

Em 30 de agosto de 2026, o proprietário decidiu que a entrega deve ser exclusivamente pela ligação privada e que o relatório web deve concentrar todo o valor visual e comercial do produto. Esta decisão substitui a geração e o anexo de PDF previstos no briefing v1.3. Novas análises já não geram nem guardam PDF. A rota antiga é mantida temporariamente apenas para não quebrar relatórios legados ainda dentro do prazo de retenção.

## Recursos Cloudflare criados

Criados em 29 de agosto de 2026:

- D1 `guia-proprietario-verificacao-anuncio`, região WEUR, ID público `d5428dbe-363f-4556-a7fe-4b7494be630f`;
- R2 `guia-proprietario-verificacao-anuncio`, classe Standard;
- Queue `verificacao-anuncio`;
- Queue de falhas `verificacao-anuncio-dlq`.

Os bindings abaixo estão preparados no repositório. Passam a existir no Pages quando esta versão for publicada:

Criar e associar ao projeto Cloudflare Pages:

```json
{
  "d1_databases": [
    {
      "binding": "VERIFICACAO_ANUNCIO_DB",
      "database_name": "guia-proprietario-verificacao-anuncio",
      "database_id": "d5428dbe-363f-4556-a7fe-4b7494be630f"
    }
  ],
  "r2_buckets": [
    {
      "binding": "VERIFICACAO_ANUNCIO_UPLOADS",
      "bucket_name": "guia-proprietario-verificacao-anuncio"
    }
  ],
  "queues": {
    "producers": [
      {
        "binding": "VERIFICACAO_ANUNCIO_QUEUE",
        "queue": "verificacao-anuncio"
      }
    ]
  }
}
```

As migrações D1 `0002` e `0003` foram aplicadas na base remota. `VERIFICACAO_ACCESS_SECRET` foi gerado em memória e guardado com o mesmo valor no Pages e no Worker. O valor real não entrou no repositório nem foi mostrado nos logs.

`0004_verificacao_anuncio_processing.sql` também foi aplicada na base remota. Os três ficheiros foram executados individualmente na base deste produto. Não executar toda a pasta de migrações, porque `0001` pertence ao Kit do Estudante.

Publicado e associado em 29 de agosto de 2026, com atualização do fluxo Sender em 30 de agosto de 2026:

- Worker `guia-proprietario-verificacao-anuncio-worker`;
- consumidor da Queue principal no Worker;
- cron `17 * * * *` no Worker.

A versão atual do Worker é `86fb737d-4f9e-444e-be01-6ab8c77bf2f2`.

O produtor `VERIFICACAO_ANUNCIO_QUEUE` e os restantes bindings do Pages estão preparados no `wrangler.jsonc`, mas só passam a estar efetivos quando a versão do portal for publicada. O consumidor, o cron, a D1 e o R2 já estão associados ao Worker publicado.

O binding existente `KIT_ESTUDANTE_DB` não deve ser reutilizado para este produto. A separação reduz o impacto operacional e evita misturar dados com finalidades diferentes.

## Stripe

No painel Stripe, manter o produto existente e criar um novo preço único de `3,90 EUR`. Os preços Stripe são imutáveis, por isso o preço anterior de 7,90 € não deve ser reutilizado. Configurar na Cloudflare:

- `STRIPE_SECRET_KEY`, como segredo;
- `STRIPE_PRICE_ID`, com o identificador `price_...` do preço de 3,90 €;
- `SITE_URL=https://guiadoproprietario.pt`;
- `STRIPE_WEBHOOK_SECRET`, como segredo obtido ao registar o endpoint abaixo.

Endpoint do webhook:

```text
https://guiadoproprietario.pt/api/verificacao-anuncio/stripe-webhook
```

Eventos necessários:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`.

O endpoint volta a consultar a sessão à Stripe e rejeita pagamentos que não correspondam exatamente ao produto, ao preço configurado, a `390` cêntimos e a `EUR`. Só depois cria o pedido. Ativar `PUBLIC_VERIFICACAO_CHECKOUT_ENABLED=true` apenas quando o webhook, a fila e o email de acesso estiverem prontos e após autorização expressa do proprietário.

O preço atual configurado para este produto é `price_1UAd4pFOwu52zlwGcPkTzJrr`, correspondente a 3,90 €. O Payment Link criado durante a preparação não faz parte do fluxo. O site cria sempre uma sessão Checkout programaticamente.

Em 30 de agosto de 2026 foi criada uma chave restrita Stripe exclusiva para o Worker, limitada a escrita em cobranças e reembolsos. O valor foi transferido diretamente da área de transferência para o segredo `STRIPE_SECRET_KEY` do Worker e removido da área de transferência de seguida. Não foi mostrado nem guardado no repositório.

## Variáveis do Worker

As variáveis secretas do projeto Pages não são copiadas automaticamente para um Worker separado. `VERIFICACAO_ACCESS_SECRET` já foi gerado e guardado com o mesmo valor no Pages e no Worker, sem ser mostrado ou persistido localmente. `STRIPE_SECRET_KEY` também já está configurado no Worker através de uma chave restrita dedicada.

Em 31 de agosto de 2026, a pesquisa inversa foi retirada do produto. A chave anteriormente criada para Cloud Vision deixa de ser utilizada pelo Worker. O respetivo valor nunca foi mostrado nem guardado no repositório.

`OPENAI_API_KEY` e `SENDER_API_TOKEN` já estão configuradas no Worker. O token Sender dedicado foi criado e transferido diretamente para o segredo Cloudflare através de um canal transitório em memória. Não foi impresso nem guardado num ficheiro. Não são necessários IDs de templates Sender. O produto envia as seis mensagens pela API transacional sem template, uma capacidade suportada oficialmente pelo fornecedor.

Configurar também `SITE_URL=https://guiadoproprietario.pt` e, se necessário, os modelos `VERIFICACAO_EXTRACTION_MODEL=gpt-5.4-mini` e `VERIFICACAO_CLASSIFICATION_MODEL=gpt-5.4-mini`.

## Estado da validação local

- migrações `0002`, `0003` e `0004` aplicadas com sucesso numa D1 local isolada e na D1 remota;
- 45 testes do produto aprovados, incluindo as seis mensagens transacionais sem templates;
- funções Pages compiladas;
- Worker compilado e publicado com os módulos WebAssembly de JPEG, PNG e WebP;
- nenhum teste local envia emails, cria cobranças ou executa reembolsos reais.

O teste remoto completo depende da criação dos recursos, da configuração dos segredos no Worker e de um pagamento Stripe em modo de teste. O checkout público continua desligado durante esta validação.

## Ainda não ativado

- bindings do Pages e publicação desta versão do portal;
- teste integrado remoto com Stripe, Sender e OpenAI;
- checkout público.

Até estas dependências estarem concluídas e configuradas, a landing mantém a compra desativada.
