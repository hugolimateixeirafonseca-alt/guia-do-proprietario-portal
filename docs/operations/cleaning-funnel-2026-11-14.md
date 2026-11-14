# Funil de captação em /pedir-limpeza/

Estado: implementado e validado localmente. Migração e publicação por autorizar. Sem dados de produção consultados ou enviados nesta tarefa.

## Percurso medido

1. Entrada, zona e frequência. Clique em Ver opções e saída para /servicos-limpeza/ separados.
2. Tipo de espaço e disponibilidade.
3. Consulta de propostas: compatíveis, nenhuma compatível ou falha técnica. Regista consulta de outro perfil e escolha de contacto, sem guardar identificadores de parceiros.
4. Dados, prazo e autorizações. Regista apenas a categoria dos campos com validação, nunca os valores.
5. Confirmação e eventual correção do telefone. Tentativa, conflito de proposta, falha de rede/resposta e envio não confirmado pela API separados.
6. Sucesso exclusivamente depois de dashboardStored=true na resposta de /api/subscribe. Distingue parceiro escolhido de pedido à rede.

## Privacidade e limitações

Exige medição válida no browser e no servidor, com a mesma versão e validade do consentimento existente. Recusa elimina o identificador local e descarta a fila. Identificador aleatório por sessão, sem associação à lead, email, telefone, IP, nome, localização exata, parceiro ou URL completa. Região, origem e dispositivo são categorias limitadas. Não grava o ecrã nem texto dos campos. Chaves/URLs de recuperação nunca são transmitidas. O coletor só aceita pedidos da origem de produção do portal.

Só observa sessões consentidas a partir da ativação. Uma sessão pode começar a ser medida a meio ou por ligação de recuperação; o painel indica essa limitação. Não é uma contagem de pessoas únicas. Não reconstrói histórico nem mede o desfecho da outra landing depois do clique de saída. Origem é uma categoria de entrada, não atribuição publicitária da Meta. Telemóvel/computador indica largura do ecrã, não identificação do aparelho.

Interrupção significa ausência de envio e de eventos há 30 minutos. Não é prova de desinteresse. Sessões recentes, redirecionadas e convertidas são separadas. Reaberturas/revisitas contam uma vez por passo. Os erros são sessões afetadas, não número de repetições. Bloqueadores, recusas, perdas de rede e falhas antes de carregar o medidor podem limitar a amostra. O tempo de inatividade é inferido do último evento, não de vigilância contínua.

## Dados e custos

Duas tabelas com prefixo cleaning_funnel_ na base já ligada como EMAIL_DELIVERY_DB. Sem alterações nas tabelas de emails, saldos ou leads. Migração aditiva e idempotente: migrations/partner-email/0004_cleaning_funnel.sql.

Até 80 eventos por sessão, lotes de até 20, envio a cada 5 segundos apenas se existirem eventos, e ao esconder/fechar a página. Sem polling nem Make. Cada lote faz um upsert de sessão e um insert por evento; reenvios deduplicados por sessão e sequência. A abertura de sessão limpa até 50 sessões com mais de 90 dias e os respetivos eventos. Limpeza progressiva, sem cron adicional.

O painel só consulta ao abrir a análise ou clicar Atualizar. A API autenticada do dashboard devolve apenas agregados; nunca IDs de sessão. Janela máxima de consulta de 90 dias.

## Ativação, após autorização

1. Aplicar apenas o SQL novo à base guia-proprietario-partner-email-delivery. Não executar todas as migrations antigas por rotina.
2. Integrar o portal e publicar pelo fluxo existente.
3. Integrar o dashboard operacional com CLEANING_FUNNEL_DB ligado à mesma base e publicar pelo fluxo existente.
4. Confirmação visual/online pelo utilizador, conforme as regras do projeto.

A revisão automática rejeitou ligar a escrita D1 remota ao workflow sem autorização específica. A migração ficou separada e não foi executada. Não ativar a recolha em produção antes de preparar as tabelas.

## Validação

Testes locais com SQLite real para deduplicação, consentimento, origem, limites, seleção de metadados e comportamento sem base. Simulação do browser para garantir ausência de identificador/envio antes de aceitar ou depois de recusar. Testes do envio real da página extraído para contexto isolado confirmam que falhas na medição não bloqueiam a lead e respostas 409 não contam como conversão.

Dashboard: SQL agregado testado com sessões convertidas, inativas, ainda recentes e redirecionadas; filtros e indisponibilidade testados. Renderização do componente com dados fictícios validada sem build integral. Sem submissões de teste, emails ou push reais.
