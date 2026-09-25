# Publicação dos emails de parceiros, 25/09/2026

A integração contém sete modelos aprovados, enviados pelo Sender com uma única ação principal e alternativa em texto. Cada envio volta à fonte de verdade dos parceiros para atualizar preferências, elegibilidade, números e ligação privada antes da entrega. O bloqueio de comunicações mantém-se efetivo, incluindo eventos que já estavam em fila.

Production: PARTNER_ENGAGEMENT_ENABLED=true e APP_ENV=production são configurações exclusivas de Production no Cloudflare. São guardadas como secrets de ambiente para não propagar estes gates ao Preview por herança do Wrangler. A credencial existente MAKE_PARTNER_NOTIFICATIONS_SECRET é preservada. O Preview isolado conserva a restrição de destinatário de teste.

A fonte foi integrada em origin/main antes da publicação. Os 18 testes direcionados do Portal passaram após essa integração. A compilação completa é necessária apenas para publicar diretamente o portal inteiro, preservando as páginas existentes. Foi corrigida a leitura de títulos multilinha no gerador OG, que bloqueava a compilação de um artigo já existente. A publicação direta evita substituir o site por uma versão parcial de teste. O commit final usa skip ci para não duplicar a compilação e o deployment já executados localmente. O resultado operacional é registado no repositório guia-do-proprietario-ops, sem dados pessoais ou credenciais.

## Botões para o dashboard, 25/09/2026

Os botões de confirmação de contacto e aviso de novo profissional passam a Abrir a minha área de parceiro, usando o dashboard_url privado relido antes do envio. Foram removidos os destinos tel: que abriam aplicações de chamadas. Os sete modelos usam agora o dashboard como destino principal. O telefone mantém-se no conteúdo da confirmação. Emails já entregues não são modificados. Oito testes direcionados aprovados, incluindo destino dos sete modelos e atualização do acesso. Enviado para publicação pelo workflow normal do Portal; sem nova compilação integral local nem verificação automática de deployment.

