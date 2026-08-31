# BRIEFING — Verificação de Anúncio de Arrendamento

> **Documento parcialmente substituído.** A partir de 31 de agosto de 2026, todas as instruções relativas a pesquisa inversa, pesquisa visual na Internet, Google Cloud Vision, TinEye, correspondências externas e originalidade das fotografias deixam de se aplicar. A decisão vigente está em `BRIEFING-VERIFICACAO-ANUNCIO-V1.4.md`.

## Produto pago automatizado no guiadoproprietario.pt

**Versão 1.3 — agosto 2026**  
**Destinatário:** Codex  
**Autor do briefing:** Hugo (Guia do Proprietário)

> Nota de implementação de 30 de agosto de 2026: a decisão posterior do proprietário substitui a entrega em PDF por uma ligação privada para um relatório web visual premium. As referências a PDF abaixo ficam preservadas apenas como registo da versão 1.3 e não representam o fluxo vigente.

### Decisões consolidadas na versão 1.3

- nome comercial: **Verificação de Anúncio**;
- promessa principal: **12 verificações antes de transferir a caução**;
- email transacional: Sender.net, reutilizando a configuração existente;
- processamento assíncrono: Cloudflare Queues;
- PDF: Cloudflare Browser Rendering a partir do HTML canónico do relatório;
- IA inicial para benchmark: OpenAI Responses API com `gpt-5.6-luna`, promovendo apenas a Passagem A para `gpt-5.6-terra` se os testes o exigirem;
- benchmark de pesquisa visual: Google Cloud Vision Web Detection e TinEye API;
- falha técnica total da pesquisa visual: falha fechada e reembolso automático;
- a verificação #11 não pode ficar `confirmado` na V1;
- a página de agradecimento permanece fora do âmbito até autorização expressa.

---

## 0. Como ler este documento

Este é o **documento único de referência** para construir o produto.

As secções 1 a 4 explicam **porque** o produto é assim.  
As secções seguintes dizem **o que construir, como validar e o que não construir**.

### Regra-travão

Se alguma coisa neste documento parecer ambígua, se houver duas interpretações possíveis ou se surgir a tentação de acrescentar uma funcionalidade que não está explicitamente prevista, **parar e perguntar antes de construir**.

O maior risco deste projeto não é técnico. É o âmbito crescer durante a implementação.

### Estado de implementação em 29 de agosto de 2026

Existe no repositório, ainda sem publicação:

- landing comercial navegável em `/verificacao-anuncio/`;
- motor isolado, validações, adapters de IA e pesquisa visual, benchmark e cliente transacional Sender.net;
- página privada de envio em `/verificacao/enviar/?t=TOKEN`;
- endpoints de upload e consulta de estado protegidos pelo token privado criado depois do pagamento;
- validação server-side do conteúdo real das imagens, quantidade e tamanho;
- contratos D1, R2 e Queue e respetiva migração.

O envio aceita de uma a oito capturas. Uma captura é suficiente para iniciar o pedido e a interface recomenda incluir toda a informação útil sem transformar a quantidade num obstáculo comercial.

Já existe no repositório, mas permanece desligado e não está ativo em produção:

- criação do checkout Stripe e botão protegido por configuração;
- webhook Stripe assinado, com confirmação do preço de 7,99 € e criação idempotente do pedido;
- página neutra de confirmação do pagamento;
- upload privado e consulta do estado do pedido;
- cliente transacional Sender.net.

Ainda não está configurado ou ativo em produção:

- recursos D1, R2 e Queue deste produto na Cloudflare;
- consumidor assíncrono do motor;
- relatório web, PDF, emails de entrega, limpeza agendada e reembolsos;
- benchmark com credenciais reais e dataset aprovado.

### Regra de proteção da página de agradecimento — obrigatória

**NÃO alterar, editar, refatorizar, publicar nem preparar alterações na atual página de agradecimento do Kit do Estudante durante o desenvolvimento deste produto.**

A página de agradecimento existente deve permanecer **exatamente como está** até que:

1. o motor de análise esteja validado;
2. a pesquisa reversa de fotografias esteja validada;
3. o pagamento esteja funcional;
4. o upload esteja funcional;
5. o processamento assíncrono esteja funcional;
6. o relatório web esteja funcional;
7. o PDF esteja funcional;
8. os emails transacionais estejam funcionais;
9. os reembolsos estejam funcionais;
10. o fluxo completo tenha passado nos testes end-to-end;
11. exista **autorização expressa do Hugo** para mexer nessa página.

O bloco comercial na página de agradecimento só entra **na última fase, após aprovação expressa**.

Até essa autorização, **não tocar nessa página, nem sequer “preparar” alterações nela**.

---

## 1. Contexto

O guiadoproprietario.pt é um portal editorial português para proprietários e inquilinos.

Existe uma campanha de captação de leads dirigida a pais de estudantes deslocados, associada ao **Kit do Estudante Deslocado**.

Este produto será a primeira monetização direta dessa audiência: um serviço pago, entregue automaticamente, que ajuda o cliente a verificar um anúncio de quarto ou apartamento antes de transferir sinal, caução ou primeira renda.

### Ponto de entrada comercial futuro

O principal ponto de entrada será, numa fase posterior:

- a página de agradecimento do Kit;
- uma sequência de emails;
- eventualmente páginas editoriais relacionadas com arrendamento estudantil.

**Importante:** isto descreve a distribuição futura. **Não autoriza qualquer alteração à página de agradecimento nesta fase.**

### Preço inicial

**7,99 € — pagamento único.**

É um preço de validação e poderá ser revisto depois de existirem dados reais de:

- conversão;
- custo por análise;
- reembolsos;
- margem;
- valor percebido.

---

## 2. O conceito

### 2.1. O erro que este produto não comete

A ideia inicial de um “detetor de burlas” que devolvesse uma probabilidade de fraude foi rejeitada.

Razões:

1. Uma probabilidade de fraude seria uma afirmação sobre a intenção de uma pessoa.
2. Um falso negativo poderia dar ao cliente uma falsa sensação de segurança.
3. Um falso positivo poderia qualificar injustamente um anúncio ou uma pessoa.
4. Num sistema sem revisão humana, não existe rede de segurança suficiente para veredictos deste tipo.
5. Um score aparentemente preciso pode esconder informação incompleta ou não verificável.

### 2.2. A inversão

O produto **não mede se o anúncio é verdadeiro**.

Mede:

- o que foi possível verificar;
- o que continua por confirmar;
- que informação é insuficiente;
- que correspondências públicas relevantes foram encontradas nas fotografias;
- que ações concretas o cliente deve tomar antes de pagar.

Exemplo de resultado:

> **5 de 12 verificações confirmadas**

Isto descreve o estado da informação disponível.  
Não descreve a intenção do anunciante.

### 2.3. O que o cliente compra

O cliente não compra “uma opinião da IA”.

Compra um **protocolo português de verificação pré-pagamento**, que inclui:

- 12 verificações estruturadas;
- comparação de preço;
- análise de coerência;
- pesquisa reversa de fotografias;
- pontos que faltam confirmar;
- perguntas concretas;
- ações recomendadas antes de transferir dinheiro.

A IA é um mecanismo de extração e classificação.

O valor do produto está no:

- protocolo;
- regras;
- fontes;
- validação;
- pesquisa externa;
- apresentação da evidência.

### 2.4. Uma única análise por compra

A V1 entrega **uma única análise** por pagamento.

Não existe:

- reanálise gratuita;
- reanálise durante 7 dias;
- atualização posterior do relatório;
- envio de novas respostas do anunciante;
- histórico de versões do mesmo relatório.

Se no futuro existir uma segunda análise, será tratada como funcionalidade ou produto separado e exigirá novo briefing.

---

## 3. Princípios não negociáveis

Qualquer implementação que viole um destes princípios está errada.

### 3.1. Palavras e formulações proibidas

Bloquear por validação, incluindo derivados e variações, quando usados como conclusão sobre o anúncio ou uma pessoa:

- seguro;
- inseguro;
- legítimo;
- ilegítimo;
- burla;
- burlão;
- fraude;
- fraudulento;
- fiável;
- de confiança;
- “parece honesto”;
- “parece suspeito” aplicado à pessoa.

São permitidas formulações factuais como:

- “correspondência encontrada”;
- “informação não confirmada”;
- “contexto diferente”;
- “preço abaixo da referência”;
- “não foi possível verificar”;
- “requer confirmação adicional”.

### 3.2. Nenhuma afirmação sobre pessoas

Nunca:

> “O anunciante parece X.”

Sempre:

> “O anúncio não indica X.”  
> “A informação enviada não permite confirmar X.”  
> “A fotografia foi encontrada também em Y.”

### 3.3. Nenhum veredicto único

Não existe:

- score de risco;
- percentagem de fraude;
- semáforo global;
- “aprovado”;
- “reprovado”.

Existem **12 verificações individuais**.

### 3.4. A ignorância é uma saída válida

`nao_verificavel` é um resultado esperado.

Se não for possível determinar, o sistema deve dizer isso.

### 3.5. O modelo classifica; o código escreve as ações

Os textos de ação são:

- fixos;
- versionados;
- escritos por nós.

O modelo devolve apenas:

- factos;
- enum;
- observação curta.

### 3.6. Falha fechada

Se o output não validar:

1. repetir uma única vez;
2. se voltar a falhar, não entregar;
3. reembolsar automaticamente.

### 3.7. Zero intervenção humana no fluxo normal

Do pagamento à entrega, o processo deve ser automático.

### 3.8. “Não encontrado” nunca significa “não existe”

Exemplo:

> “Não encontrámos esta fotografia noutros resultados.”

Isto **não significa**:

> “A fotografia é original.”

A mesma regra aplica-se a pesquisa web, pesquisa visual e quaisquer fontes externas.

### 3.9. Toda a evidência externa precisa de origem verificável

Uma correspondência externa só pode aparecer no relatório se tiver:

- URL ou domínio de origem;
- tipo de correspondência;
- estado de validação;
- contexto efetivamente observado.

Nunca inventar:

- datas;
- localizações;
- títulos;
- proprietários;
- antiguidade;
- origem.

---

## 4. As 12 verificações

Esta lista é fixa e é o coração do produto.

| # | Verificação |
|---:|---|
| 1 | Morada ou zona identificável |
| 2 | Preço face à referência da zona |
| 3 | Tipologia e área coerentes entre a informação enviada |
| 4 | Fotografias coerentes e correspondências externas relevantes |
| 5 | Despesas incluídas explicitadas |
| 6 | Condições de pagamento explicitadas |
| 7 | Disponibilidade para visita presencial mencionada |
| 8 | Contrato escrito mencionado |
| 9 | Recibos de renda mencionados |
| 10 | Identificação do titular da conta que receberá o pagamento |
| 11 | Propriedade ou autorização documental para arrendar o imóvel |
| 12 | Compromisso de comunicação do contrato às Finanças e emissão dos recibos aplicáveis |

---

## 5. Estados

Só existem três:

### `confirmado`

Foi encontrada evidência explícita suficiente para satisfazer **o critério definido para aquela verificação**.

### `por_confirmar`

Falta uma informação concreta e existe uma ação definida para a obter.

### `nao_verificavel`

Não é possível determinar aquela verificação através da informação e das fontes disponíveis.

### Regra crítica

“Confirmado” não significa:

> “É verdade no mundo real.”

Significa:

> “Existe evidência explícita, do tipo definido para esta verificação, na informação analisada.”

O modelo não decide livremente qual a evidência suficiente.

---

## 6. Evidência mínima por verificação

### #1 — Morada ou zona identificável

`confirmado` se:

- existe cidade + zona/bairro identificável;
- ou existe morada suficientemente específica.

`por_confirmar` se:

- apenas existe uma localização demasiado genérica.

`nao_verificavel` se:

- não existe localização utilizável.

### #2 — Preço face à referência da zona

A comparação só é possível se existirem:

- preço mensal explícito;
- localização compatível;
- referência válida na tabela.

O estado “confirmado” significa apenas que **a comparação foi possível**.

A observação pode ser:

- dentro da referência;
- abaixo da referência;
- acima da referência;
- referência insuficiente.

Nunca inferir intenção a partir do preço.

### #3 — Tipologia e área coerentes

`confirmado` se:

- existe tipologia e/ou área explícita em pelo menos duas ocorrências comparáveis da informação enviada;
- os valores ou descrições são compatíveis;
- não existe contradição observável.

`por_confirmar` se:

- existe informação contraditória;
- ou apenas uma parte da informação necessária está disponível e pode ser esclarecida.

`nao_verificavel` se:

- não há duas ocorrências comparáveis;
- ou não existe informação suficiente para avaliar coerência.

A ausência de contradição, por si só, não é evidência suficiente para marcar esta verificação como `confirmado`.

### #4 — Fotografias coerentes e correspondências externas

Tem dois componentes:

**A. Coerência interna**
- fotografias entre si;
- fotografias vs. texto.

**B. Pesquisa reversa**
- correspondências externas;
- validação do contexto dessas correspondências.

Regras detalhadas na secção 11.

Nunca marcar `confirmado` apenas porque não foram encontrados resultados externos.

### #5 — Despesas

`confirmado` se:

- o anúncio diz explicitamente o que está incluído e/ou excluído.

`por_confirmar` se:

- a referência é vaga ou inexistente.

### #6 — Condições de pagamento

`confirmado` se:

- estão explicitados todos os montantes exigidos antes da entrega das chaves;
- estão identificados caução, sinal, primeira renda e outras quantias, quando existam;
- a ausência de uma dessas quantias é igualmente explícita quando relevante;
- está indicado quando cada montante deve ser pago.

`por_confirmar` se:

- falta qualquer montante, finalidade ou momento de pagamento relevante.

`nao_verificavel` se:

- a informação enviada não contém elementos utilizáveis sobre pagamentos iniciais.

### #7 — Visita presencial

`confirmado` se:

- existe menção explícita à possibilidade de visita presencial.

`por_confirmar` se:

- nada é dito.

### #8 — Contrato escrito

`confirmado` se:

- existe menção explícita a contrato escrito.

Isto confirma apenas:

> “O anúncio/mensagem menciona contrato escrito.”

Não confirma que o contrato será efetivamente celebrado.

### #9 — Recibos

`confirmado` se:

- existe menção explícita à emissão de recibos.

Não significa que os recibos serão efetivamente emitidos.

### #10 — Titular da conta

Na maioria das primeiras análises será `por_confirmar`.

Só pode ser `confirmado` se:

- a informação enviada mostrar explicitamente o nome do titular, sem persistir o IBAN;
- o mesmo nome identificar também a pessoa ou entidade apresentada como parte do arrendamento;
- a comparação normalizada dos nomes for exata;
- não existir contradição entre as fontes.

Uma relação apenas implícita ou uma semelhança parcial de nomes não é suficiente.

Nunca persistir IBAN.

### #11 — Propriedade ou autorização documental para arrendar

Nunca confirmar apenas porque alguém diz:

> “Sou o proprietário.”

Na V1 esta verificação nunca pode ficar `confirmado`, porque o fluxo aceita apenas screenshots do anúncio e não suporta análise documental.

Usar `por_confirmar` quando existe uma ação concreta para pedir prova de propriedade ou autorização para arrendar. Usar `nao_verificavel` apenas quando a informação enviada não permite sequer formular essa confirmação.

A formulação jurídica final desta ação deve ser validada antes do lançamento.

### #12 — Comunicação às Finanças e recibos aplicáveis

`confirmado` se:

- a informação enviada menciona explicitamente que o contrato será comunicado nos termos aplicáveis;
- e menciona os recibos aplicáveis.

`por_confirmar` se:

- nada é dito.

Nunca usar frases como:

> “Um senhorio legítimo responde que sim.”

---

## 7. Textos de ação

Todos os textos de ação:

- ficam num ficheiro de configuração versionado;
- não vêm do modelo;
- são selecionados por `verificacao_id` + `estado`;
- não podem conter palavras proibidas;
- devem ser revistos antes do lançamento.

Exemplos:

**#5**
> Confirme por escrito quais as despesas incluídas no valor mensal e quais serão pagas à parte.

**#6**
> Peça a discriminação por escrito de todos os valores exigidos antes da entrada: caução, sinal, primeira renda e outras quantias.

**#7**
> Antes de qualquer pagamento, confirme se é possível visitar o imóvel presencialmente.

**#8**
> Peça confirmação por escrito de que será celebrado contrato e solicite a minuta antes de transferir dinheiro.

**#10**
> Peça o nome completo do titular da conta que receberá o pagamento e confirme a relação desse titular com o arrendamento.

**#11**
> Peça documentação adequada para confirmar quem é o proprietário ou está autorizado a arrendar o imóvel.

**#12**
> Confirme por escrito como será feita a comunicação do contrato às Finanças e a emissão dos recibos aplicáveis.

---

## 8. Fluxo do utilizador

```text
Landing /verificar-anuncio
        |
        v
Stripe Checkout — 7,99 €
        |
        +--> webhook cria registo + token
        |
        v
/verificacao/enviar/?t=TOKEN
Upload de capturas de ecrã (screenshot) do anúncio + cidade
        |
        v
Processamento assíncrono
        |
        +--> extração
        +--> deteção/recorte de fotografias
        +--> deduplicação
        +--> pesquisa reversa
        +--> validação das correspondências
        +--> comparação de preço
        +--> classificação
        +--> validações finais
        |
        +---- sucesso ----> relatório web + email + PDF
        |
        +---- falha ------> reembolso automático + email
        |
        v
/verificacao/r/TOKEN
Relatório ativo 90 dias
```

### Não existe reanálise

O processo termina na entrega.

Não criar:

- botão “reanalisar”;
- atualização durante 7 dias;
- formulário para adicionar respostas;
- nova análise sem novo pagamento.

### Rotas

| Rota | Função |
|---|---|
| `/verificar-anuncio` | Landing pública |
| `/verificacao/enviar/?t=TOKEN` | Upload, `noindex` |
| `/verificacao/r/TOKEN` | Relatório, `noindex` |
| `/verificacao/recuperar` | Recuperação por email, `noindex` |
| `/verificacao/reembolso` | Pedido de devolução, `noindex` |

### Token

- CSPRNG;
- mínimo 32 caracteres;
- não derivado do email;
- não sequencial;
- criado após pagamento.

Sem:

- conta;
- password;
- área de cliente.

### Pagou mas não fez upload

Implementar:

1. email imediato com link de upload;
2. lembrete após 24 h;
3. segundo lembrete após 7 dias;
4. reembolso automático se o upload continuar em falta após o prazo definido.

Este prazo de 7 dias é apenas para **completar o envio inicial**.

Não é uma janela de reanálise.

---

## 9. Arquitetura técnica

Stack existente a reutilizar:

- Astro;
- Cloudflare Pages;
- Pages Functions;
- GitHub;
- deploy automático.

### Componentes

| Camada | Escolha |
|---|---|
| Frontend | Astro |
| Backend | Cloudflare Pages Functions |
| Ficheiros | Cloudflare R2 |
| Base de dados | Cloudflare D1 |
| Processamento assíncrono | Cloudflare Queues |
| Cron | Cloudflare Cron Triggers |
| Pagamento | Stripe Checkout |
| Email transacional | Sender.net |
| IA | OpenAI Responses API, benchmark inicial com `gpt-5.6-luna` |
| Pesquisa visual | Interface própria `ReverseImageProvider` |
| PDF | Cloudflare Browser Rendering a partir do HTML canónico do relatório |

### Email transacional

Usar Sender.net através da API transacional já configurada no projeto.

Não misturar os envios transacionais deste produto com campanhas ou automações de marketing. Usar templates, eventos e identificadores próprios.

Objetivos:

- separar marketing de transacional;
- menor latência;
- controlo de falhas;
- PDF;
- API compatível com Workers.

Subdomínio sugerido:

`envio.guiadoproprietario.pt`

Configurar:

- SPF;
- DKIM;
- DMARC.

### PDF

O PDF contém a mesma informação do relatório web.

Não criar uma segunda lógica de conteúdo.

Avaliar antes de implementar:

- Cloudflare Browser Rendering;
- biblioteca JS server-side adequada.

---

## 10. Motor de IA

### 10.1. Passagem A — extração

Recebe:

- screenshots/imagens.

Devolve apenas factos observáveis.

Exemplos:

- cidade;
- zona;
- preço;
- tipologia;
- área;
- despesas;
- caução;
- sinal;
- visita;
- contrato;
- recibos;
- informação sobre pagamento.

Cada campo deve poder indicar:

- `presente`;
- `valor`;
- `fonte_imagem`.

A Passagem A não interpreta intenção.

### 10.2. Preparação das fotografias

Antes da pesquisa reversa:

1. detetar as áreas das screenshots que contêm fotografias do imóvel;
2. recortar essas áreas;
3. excluir logótipos, avatares, mapas, banners e elementos de UI;
4. gerar hash perceptual;
5. deduplicar;
6. limitar o número de fotografias únicas;
7. conservar ligação à screenshot de origem.

Máximo inicial recomendado:

**6 fotografias únicas por análise**, configurável.

### 10.3. Passagem B — classificação

Recebe:

- factos da Passagem A;
- resultado sanitizado da pesquisa visual;
- referência de preços.

Não recebe novamente as imagens originais.

Devolve:

- 12 verificações;
- estado;
- observação curta.

---

## 11. Pesquisa reversa de fotografias — obrigatória na V1

A pesquisa reversa é uma funcionalidade central do valor comercial do produto.

Também é uma potencial fonte de:

- falsos positivos;
- bugs;
- desinformação.

Por isso, a implementação deve ser conservadora.

### 11.1. Objetivo

Encontrar correspondências públicas para as fotografias e apresentar apenas factos que tenham sido efetivamente validados.

Permitido:

> Foi encontrada uma imagem visualmente correspondente numa página do domínio exemplo.pt.

Permitido, se o contexto tiver sido verificado:

> Foi encontrada uma imagem correspondente numa página que identifica a localização como Porto, enquanto a informação enviada indica Lisboa.

Proibido:

> Esta fotografia foi roubada.

Proibido:

> Esta imagem prova que o anúncio é falso.

Proibido:

> A fotografia é original porque não apareceu noutros sites.

### 11.2. Abstração própria

Criar:

`ReverseImageProvider`

Interface conceptual:

```text
search(image) -> provider_result
```

O resultado do fornecedor deve ser convertido para um **schema interno nosso**.

Não espalhar código específico de um fornecedor pelo projeto.

### 11.3. Benchmark antes de escolher

Antes de implementar definitivamente, comparar pelo menos dois fornecedores.

Fornecedores aprovados para o benchmark inicial:

- Google Cloud Vision Web Detection;
- TinEye API.

Avaliar:

- custo;
- qualidade com screenshots recomprimidos;
- exact matches;
- near exact matches;
- visual matches;
- URL;
- metadados;
- latência;
- estabilidade;
- limites.

### 11.4. Provider primário + validação secundária

A V1 deve ter:

- provider primário;
- método de validação secundária para resultados materialmente relevantes.

A validação secundária pode ser:

- segundo provider;
- acesso direto à página candidata;
- combinação dos dois.

Uma correspondência que altere a verificação #4 não pode depender apenas de uma descrição textual devolvida por uma única API.

### 11.5. Estados internos

Cada fotografia termina num destes estados:

#### `sem_correspondencia_encontrada`

O provider não devolveu correspondência suficiente.

Nunca traduzir para “imagem original”.

#### `correspondencia_mesmo_contexto`

Existe imagem equivalente e o contexto público validado é compatível com o anúncio atual.

#### `correspondencia_contexto_diferente`

Existe imagem equivalente e uma diferença factual validada, por exemplo:

- cidade diferente;
- contexto imobiliário incompatível;
- utilização pública que merece confirmação.

#### `correspondencia_inconclusiva`

Existe uma correspondência visual, mas o contexto não pôde ser validado com segurança suficiente.

#### `pesquisa_indisponivel`

Timeout, erro, provider indisponível ou outra falha técnica.

### 11.6. Regra para contexto diferente

Só promover para `correspondencia_contexto_diferente` se existirem:

1. correspondência visual acima do limiar;
2. URL ou origem identificável;
3. contexto factual recuperado;
4. contradição objetiva com o anúncio atual.

Se a página candidata não puder ser validada:

- não inventar o contexto;
- manter `correspondencia_inconclusiva`.

### 11.7. Datas

Nunca dizer:

> “Esta imagem apareceu primeiro em 2024.”

Só usar uma data quando a página pública a apresenta de forma verificável.

Mesmo nesse caso, usar:

> Encontrámos uma página datada de março de 2024 que contém uma imagem correspondente.

Nunca inferir “primeira utilização”.

### 11.8. Similaridade

Distinguir:

- exact match;
- near exact match;
- visual match;
- apenas semelhante.

Imagens apenas parecidas não devem ser apresentadas como sendo a mesma fotografia.

O limiar será definido empiricamente com testes reais.

### 11.9. Deduplicação

Não transformar:

- diferentes tamanhos;
- CDN;
- URLs do mesmo domínio;
- thumbnails;

em múltiplos “alertas” do mesmo facto.

Agrupar por:

- fotografia;
- domínio;
- contexto.

### 11.10. Limite de resultados

Máximo recomendado:

**3 correspondências relevantes por fotografia.**

Prioridade:

1. contexto diferente confirmado;
2. correspondência forte;
3. fonte mais informativa.

### 11.11. Falha do provider

Se a pesquisa visual falhar tecnicamente:

- não inventar resultados;
- marcar componente como indisponível;
- mostrar no relatório que a pesquisa externa não pôde ser concluída.

Política comercial aprovada:

- repetir a pesquisa uma vez em falhas transitórias;
- usar fallback quando estiver configurado;
- se nenhuma pesquisa visual puder ser concluída por falha técnica, não entregar o relatório;
- executar reembolso automático.

Fotografias intrinsecamente ilegíveis ou sem detalhe suficiente podem produzir `nao_verificavel` sem reembolso, desde que o serviço técnico tenha funcionado e o restante relatório seja válido.

### 11.12. Logging

Registar:

- provider;
- request id;
- latência;
- número de candidatos;
- estado final;
- erro;
- versão dos limiares.

Não guardar payloads externos desnecessários.

---

## 12. Como a pesquisa reversa alimenta a verificação #4

Verificação #4:

> Fotografias coerentes e correspondências externas relevantes.

### `confirmado`

Apenas se:

- as fotografias são internamente coerentes;
- a pesquisa externa correu;
- não existem contradições observáveis;
- correspondências encontradas, se existirem, são compatíveis com o mesmo contexto.

### `por_confirmar`

Se:

- existe contradição interna;
- existe `correspondencia_contexto_diferente`;
- existe correspondência externa que exige esclarecimento.

### `nao_verificavel`

Se:

- imagens insuficientes;
- fotografias não extraíveis;
- pesquisa indisponível e não existe evidência suficiente.

**Importante:**

`sem_correspondencia_encontrada` nunca é, sozinho, fundamento para `confirmado`.

---

## 13. Tabela de referência de preços

Não fazer scraping dos portais para esta funcionalidade na V1.

Criar tabela estática versionada para:

- Lisboa;
- Porto;
- Coimbra;
- Braga;
- Aveiro;
- Covilhã;
- Guimarães;
- Évora;
- Leiria;
- Faro.

Guardar:

- tipo de referência;
- unidade e mediana;
- fonte;
- período observado;
- metodologia;
- validade.

Decisão para a primeira tabela versionada:

- usar a mediana do preço pedido por metro quadrado e por mês para habitação em arrendamento;
- fonte: relatórios de preços do idealista/data, julho de 2026;
- comparar apenas quando o anúncio contém preço mensal, cidade e área;
- descrever o resultado como abaixo, próximo ou acima da mediana apenas depois de serem validados os limiares no dataset de 20 anúncios;
- não usar esta referência para quartos sem área, nem convertê-la numa avaliação do imóvel;
- validade operacional até 31 de janeiro de 2027, com revisão semestral.

Atualização sugerida:

**semestral**.

Sem referência adequada:

`nao_verificavel`

Nunca inventar médias.

---

## 14. Schema de saída

Usar Structured Outputs / JSON Schema.

Exemplo:

```json
{
  "type": "object",
  "required": ["versao", "verificacoes"],
  "additionalProperties": false,
  "properties": {
    "versao": { "const": "1.3" },
    "verificacoes": {
      "type": "array",
      "minItems": 12,
      "maxItems": 12,
      "items": {
        "type": "object",
        "required": ["id", "estado", "observacao"],
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "integer",
            "minimum": 1,
            "maximum": 12
          },
          "estado": {
            "type": "string",
            "enum": [
              "confirmado",
              "por_confirmar",
              "nao_verificavel"
            ]
          },
          "observacao": {
            "type": "string",
            "maxLength": 160
          }
        }
      }
    }
  }
}
```

---

## 15. Validação obrigatória antes de entregar

Uma resposta só pode ser entregue se:

1. validar o JSON Schema;
2. tiver exatamente 12 verificações;
3. tiver ids 1 a 12;
4. não tiver ids repetidos;
5. não contiver palavras proibidas;
6. não contiver nomes próprios desnecessários;
7. não contiver telefone;
8. não contiver email;
9. não contiver IBAN;
10. #11 nunca estiver `confirmado` sem evidência documental suportada;
11. todas as observações respeitarem o limite;
12. qualquer referência externa existir no resultado sanitizado da pesquisa visual;
13. nenhuma URL tiver sido inventada;
14. nenhuma localização externa tiver sido inventada;
15. nenhuma data externa tiver sido inventada;
16. nenhuma observação fizer afirmação absoluta sobre autenticidade/originalidade.

Falha:

- repetir uma vez;
- segunda falha -> falha fechada.

---

## 16. Falha fechada

Casos:

- JSON inválido após duas tentativas;
- timeout persistente;
- imagens totalmente ilegíveis;
- falha que impeça produzir as 12 verificações;
- falha crítica de segurança.

Fluxo:

```text
estado = falhou_reembolsado
        |
        +--> Stripe Refund
        +--> email de falha
        +--> evento técnico
```

Texto do email:

> Não conseguimos concluir a análise. Devolvemos os 7,99 €.

Nunca entregar um relatório improvisado.

---

## 17. Stripe

### Configuração

- Checkout;
- modo `payment`;
- preço 7,99 €;
- cartão;
- MB WAY, se disponível;
- email obrigatório.

### Consentimento para prestação imediata

A necessidade e redação jurídica do consentimento devem ser **validadas antes do lançamento**.

Não hardcodar redação jurídica definitiva sem validação.

### Webhook

`checkout.session.completed`

Deve:

- validar assinatura;
- garantir idempotência;
- criar registo;
- gerar token;
- enviar email de upload.

### Reembolsos

Caminhos previstos:

1. análise falhou -> reembolso automático;
2. cliente não enviou screenshots no prazo -> reembolso automático;
3. cliente pede devolução dentro da política comercial -> automatismo a fechar antes do lançamento.

---

## 18. Relatório final

O relatório deve parecer um produto premium, não um dump técnico.

### Topo

> Resultado da verificação

Indicador:

> **5 de 12 verificações confirmadas**

Não mostrar:

- percentagem;
- score de risco;
- semáforo;
- “nível de fraude”.

### Resumo das 12 verificações

Cada linha contém:

- número;
- nome;
- estado;
- observação;
- ação, quando aplicável.

### Secção de fotografias

Título:

> Pesquisa das fotografias

Para cada fotografia relevante:

- miniatura;
- estado;
- domínio;
- link;
- contexto validado;
- explicação curta.

Exemplo:

> Foi encontrada uma imagem correspondente numa página que identifica a localização como Porto. A informação enviada indica Lisboa. Confirme esta diferença antes de avançar.

Ou:

> Foram encontradas correspondências da mesma imagem num contexto compatível.

Ou:

> Não foram encontradas correspondências suficientes nesta pesquisa. Isto não permite concluir que a fotografia seja original.

### Secção de preço

Mostrar:

- preço indicado;
- intervalo de referência;
- data da referência;
- posição face ao intervalo.

### O que fazer antes de pagar

Lista derivada apenas dos estados `por_confirmar`.

Textos fixos.

### Perguntas prontas

Templates versionados.

Exemplo:

> Pode confirmar por escrito quais as despesas incluídas no valor mensal?

> É possível visitar o imóvel presencialmente antes de qualquer pagamento?

> Pode enviar a minuta do contrato antes da transferência?

Botão:

**Copiar**

### PDF

Conteúdo igual ao relatório web.

---

## 19. RGPD e retenção

Os screenshots podem conter dados pessoais de terceiros.

Regras:

1. imagens apagadas do R2 às 48 h;
2. não guardar telefone, email ou IBAN do anunciante na D1;
3. não criar páginas públicas associando anúncios identificáveis a resultados;
4. relatórios `noindex`;
5. token privado;
6. relatório expira aos 90 dias;
7. depois disso, anonimizar;
8. página de privacidade própria;
9. pesquisa externa centrada nas fotografias e conteúdo do anúncio;
10. não criar dossiers sobre pessoas.

---

## 20. Segurança

Obrigatório:

- rate limiting;
- máximo 8 uploads;
- validação server-side de tipo;
- limite de tamanho;
- CSPRNG;
- `Cache-Control: no-store`;
- assinatura de webhooks Stripe;
- secrets só no Cloudflare;
- CSP;
- HSTS;
- CORS restrito;
- sanitização de URLs externas;
- nunca renderizar HTML vindo de provider;
- timeouts;
- fallback/circuit breaker.

---

## 21. Modelo de dados D1

Estrutura sugerida:

```sql
CREATE TABLE verificacoes (
  token                   TEXT PRIMARY KEY,
  stripe_session_id       TEXT UNIQUE NOT NULL,
  stripe_payment_id       TEXT,
  email                   TEXT NOT NULL,
  estado                  TEXT NOT NULL,
  cidade                  TEXT,
  criado_em               INTEGER NOT NULL,
  upload_em               INTEGER,
  entregue_em             INTEGER,
  expira_em               INTEGER NOT NULL,
  imagens_apagadas        INTEGER DEFAULT 0,
  resultado_json          TEXT,
  pesquisa_visual_json    TEXT,
  versao_motor            TEXT,
  versao_pesquisa_visual  TEXT,
  reembolsado_em          INTEGER,
  motivo_reembolso        TEXT
);

CREATE TABLE eventos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  detalhe     TEXT,
  criado_em   INTEGER NOT NULL
);
```

Estados:

```text
pago
→ aguarda_upload
→ em_analise
→ entregue
→ expirado
```

Alternativos:

```text
falhou_reembolsado
sem_upload_reembolsado
```

Não existe estado `reanalisado`.

---

## 22. Testes antes do frontend

A Fase 1 é o motor isolado.

Testar primeiro com **20 anúncios reais**.

Incluir:

- OLX;
- Idealista;
- Facebook Marketplace;
- anúncios normais;
- preços baixos;
- imagens repetidas;
- screenshots recomprimidos;
- screenshots de baixa qualidade;
- imagens do mesmo imóvel em sites diferentes;
- imagens iguais associadas a cidades diferentes;
- imagens apenas semelhantes;
- provider indisponível;
- zero resultados.

### Dataset de verdade da pesquisa reversa

Criar casos conhecidos:

**Caso A**  
Mesma fotografia, mesmo imóvel/contexto.  
Esperado: `correspondencia_mesmo_contexto`

**Caso B**  
Mesma fotografia, cidade/contexto diferente.  
Esperado: `correspondencia_contexto_diferente`

**Caso C**  
Fotografia apenas semelhante.  
Esperado: não promover para correspondência forte.

**Caso D**  
Nenhum resultado.  
Esperado: `sem_correspondencia_encontrada`, nunca “original”.

**Caso E**  
Provider indisponível.  
Esperado: `pesquisa_indisponivel`.

### Testes de regressão

Correr sempre que mudar:

- prompt;
- modelo;
- provider;
- limiar;
- schema;
- tabela de preços.

---

## 23. Critérios de aceitação

Antes de cobrar a um cliente real:

1. 100% dos outputs finais validam o JSON Schema;
2. zero palavras proibidas;
3. zero telefone, email ou IBAN no output;
4. nenhuma URL inventada;
5. nenhuma data externa inventada;
6. nenhuma localização externa inventada;
7. nenhuma correspondência apresentada sem origem;
8. “sem correspondência” nunca significa “imagem original”;
9. imagens apenas semelhantes nunca são apresentadas como a mesma imagem;
10. correspondências de contexto diferente passam pela validação definida;
11. dataset de verdade da pesquisa visual passa a 100%;
12. factos da Passagem A batem certo nos 20 casos;
13. tabela de preços nunca inventa referências;
14. falha fechada testada;
15. reembolso automático por falha testado;
16. pagamento sem upload testado;
17. provider visual indisponível testado;
18. custo máximo por análise medido;
19. tempo de processamento medido;
20. fluxo Stripe → upload → análise → pesquisa visual → relatório → PDF → email testado de ponta a ponta.

**Só depois destes critérios estarem cumpridos se pode passar à preparação do lançamento público.**

---

## 24. Ordem de implementação

### Fase 1 — Motor isolado

1. Configuração das 12 verificações.
2. Evidência mínima.
3. Textos de ação.
4. Tabela de preços.
5. Prompt A.
6. Schema de extração.
7. Recorte de fotografias.
8. Deduplicação perceptual.
9. `ReverseImageProvider`.
10. Benchmark de fornecedores.
11. Normalização dos resultados visuais.
12. Validação das correspondências.
13. Prompt B.
14. Schema final.
15. Validações de segurança.
16. CLI local.
17. Testes com 20 anúncios.

### Fase 2 — Infraestrutura

18. D1.
19. R2.
20. Queue.
21. Upload.
22. Pipeline assíncrono.
23. Persistência.
24. Cron de limpeza.

### Fase 3 — Entrega

25. Template HTML.
26. Secção visual de pesquisa de fotografias.
27. PDF.
28. Email transacional.
29. Recuperação de link.

### Fase 4 — Comércio

30. Stripe Checkout.
31. Consentimento.
32. Webhooks.
33. Tokens.
34. Reembolsos.
35. Testes end-to-end.

### Fase 5 — Preparação pública

36. Landing `/verificar-anuncio`.
37. Página de privacidade.
38. Métricas.
39. Testes finais.
40. Lançamento limitado da landing, se autorizado.

### Fase 6 — Página de agradecimento, apenas após autorização expressa

**NÃO executar automaticamente.**

Só após Hugo confirmar expressamente que todo o produto está pronto:

41. propor o bloco final para a página de agradecimento;
42. aguardar aprovação do copy e posição;
43. só depois implementar;
44. não alterar nenhum outro conteúdo ou funcionamento da página.

A página de agradecimento é o **último passo**, não um passo de desenvolvimento.

---

## 25. O que NÃO construir na V1

Explicitamente fora de âmbito:

- importação automática de URL do OLX;
- importação automática de URL do Idealista;
- importação automática do Facebook Marketplace;
- scraping massivo dos portais;
- score numérico de fraude;
- semáforo global;
- percentagem de autenticidade;
- pré-análise gratuita;
- área de cliente;
- login/password;
- reanálise gratuita;
- reanálise durante 7 dias;
- análise de contrato;
- dashboard administrativo;
- investigação de pessoas;
- base pública de anunciantes;
- intervenção humana no fluxo normal;
- alterações à página de agradecimento antes de autorização expressa.

A pesquisa reversa de fotografias **está dentro da V1** e não deve ser removida.

---

## 26. Copy base

### Landing

> **12 verificações antes de transferir a caução.**

> Envie as capturas de ecrã do anúncio. Pesquisamos as fotografias noutros sites públicos, cruzamos a informação e mostramos o que deve confirmar antes de pagar.

> Em minutos recebe um relatório com o que foi possível confirmar, o que falta confirmar e as perguntas exatas a fazer antes de pagar.

> **Verificar um anúncio — 7,99 €**

### Pesquisa visual

Usar:

> Pesquisamos as fotografias para encontrar correspondências públicas e diferenças de contexto que mereçam confirmação.

Não usar:

> Descobrimos se as fotos foram roubadas.

Não usar:

> Detetamos fotos falsas.

Não usar:

> Confirmamos que as fotos são originais.

### Garantia técnica

> Se o sistema não conseguir produzir a análise, devolvemos automaticamente os 7,99 €.

### Rodapé do relatório

> Este relatório descreve o que foi possível confirmar a partir da informação enviada e das fontes públicas consultadas. Não avalia a intenção do anunciante nem garante a autenticidade do anúncio. Não constitui aconselhamento jurídico.

### Página de agradecimento

Existe apenas como **copy futura**.

Não implementar agora.

Quando chegar o momento, a proposta poderá ser:

> **Já encontrou um quarto?**  
> Antes de transferir a caução, faça as 12 verificações.  
> **Verificar um anúncio — 7,99 €**

Mas este bloco só será implementado depois de todo o produto estar funcional e após autorização expressa.

---

## 27. Variáveis e segredos

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID

AI_API_KEY
AI_MODEL_EXTRACAO
AI_MODEL_CLASSIFICACAO

REVERSE_IMAGE_PROVIDER
REVERSE_IMAGE_API_KEY
REVERSE_IMAGE_SECONDARY_PROVIDER
REVERSE_IMAGE_SECONDARY_API_KEY

EMAIL_API_KEY
EMAIL_FROM

SITE_URL

RETENCAO_IMAGENS_HORAS
VALIDADE_RELATORIO_DIAS
PRAZO_UPLOAD_DIAS
PRAZO_REEMBOLSO_DIAS

MAX_UPLOAD_FILES
MAX_REVERSE_IMAGES
REVERSE_MATCH_THRESHOLD
REVERSE_VALIDATION_MODE

VERSAO_MOTOR
VERSAO_PESQUISA_VISUAL
```

Não existe:

`JANELA_REANALISE_DIAS`

---

## 28. Métricas

### Produto

- pagamentos;
- uploads;
- análises concluídas;
- falhas;
- reembolsos;
- tempo médio.

### IA

- retries;
- falhas de schema;
- custo da Passagem A;
- custo da Passagem B.

### Pesquisa visual

- fotografias únicas;
- custo por fotografia;
- correspondências;
- inconclusivos;
- contexto diferente;
- provider indisponível;
- fallback;
- latência.

### Comercial

- visitas à landing;
- checkout iniciado;
- compras;
- conversão;
- reembolsos;
- receita líquida.

---

## 29. Decisão específica sobre a pesquisa reversa

A pesquisa reversa **entra na V1**.

Condições obrigatórias:

1. não prometer que identifica fotos “roubadas”;
2. não prometer cobertura total da Internet;
3. não afirmar originalidade quando não há match;
4. não mostrar contexto não validado;
5. não depender de uma única descrição textual de uma API para conclusões materiais;
6. usar provider abstraction;
7. testar com dataset de verdade;
8. ter estado `inconclusivo`;
9. ter estado `indisponivel`;
10. guardar origem da evidência;
11. nunca transformar correspondência visual em acusação;
12. validar limiares antes do lançamento.

---

## 30. Critério de lançamento

Não lançar porque “tecnicamente funciona”.

Lançar quando:

- os 20 anúncios foram testados;
- a extração é estável;
- o JSON é estável;
- a pesquisa visual passa o dataset de verdade;
- não existem URLs inventadas;
- não existem contextos inventados;
- a comparação de preços é previsível;
- o relatório tem valor real;
- a falha fechada funciona;
- os reembolsos funcionam;
- o custo por análise é conhecido;
- a margem é aceitável;
- o fluxo completo foi validado.

**Mesmo depois disso, não mexer na página de agradecimento sem autorização expressa.**

---

## 31. Decisões técnicas aprovadas antes de começar

1. Email transacional: Sender.net, reutilizando o domínio e a configuração de API existentes, com templates e eventos transacionais próprios.
2. PDF: Cloudflare Browser Rendering a partir do HTML canónico.
3. Processamento assíncrono: Cloudflare Queues com idempotência na D1 e dead-letter queue.
4. IA: OpenAI Responses API com Structured Outputs.
5. Modelo inicial: `gpt-5.6-luna` nas duas passagens; avaliar `gpt-5.6-terra` apenas para a Passagem A se o dataset o exigir.
6. Pesquisa visual: benchmark entre Google Cloud Vision Web Detection e TinEye API.
7. Validação secundária: comparação local da imagem candidata e acesso direto à página.
8. Deduplicação interna: hash exato, pHash e dHash.
9. Limiar inicial de duplicado: distância pHash até 6; entre 7 e 10 exige segundo sinal.
10. Nenhuma correspondência externa é promovida apenas pelo score do fornecedor.
11. Falha técnica total da pesquisa visual: falha fechada e reembolso automático.
12. URLs, datas e localizações externas são inseridas pelo código a partir de evidência sanitizada, nunca redigidas livremente pelo modelo.
13. Teto provisório de processamento: 0,50 USD por análise com seis fotografias, a confirmar no benchmark.
14. Objetivo de entrega: 30 a 90 segundos; limite operacional de cinco minutos.
15. A página de agradecimento não será alterada sem autorização expressa após validação integral do produto.

---

## 32. Conclusão

A V1 será um produto:

- pago;
- automático;
- de análise única;
- sem intervenção humana;
- com pesquisa reversa incluída;
- com falha fechada;
- sem score de fraude;
- sem reanálise;
- sem depender de acesso automático a OLX/Idealista/Facebook.

O cliente:

1. paga 7,99 €;
2. envia screenshots;
3. o sistema extrai factos;
4. identifica e deduplica fotografias;
5. faz pesquisa reversa;
6. valida as correspondências;
7. compara o preço;
8. executa as 12 verificações;
9. gera relatório web;
10. gera PDF;
11. envia email;
12. termina o processo.

A promessa é:

> **Antes de transferir dinheiro, mostramos o que foi possível confirmar, o que ainda precisa de confirmação e as correspondências públicas relevantes encontradas nas fotografias.**

Nunca:

> “Dizemos se é burla.”

A página de agradecimento é um **canal de distribuição futuro**, não uma peça a alterar durante o desenvolvimento.

**Não tocar nela até o produto estar integralmente montado, validado e existir autorização expressa para o fazer.**
