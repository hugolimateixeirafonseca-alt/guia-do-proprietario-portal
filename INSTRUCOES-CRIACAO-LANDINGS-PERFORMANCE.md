# Instruções para criar novas landings de performance

Última atualização: 9 de agosto de 2026

## Objetivo deste documento

Estas instruções permitem criar novas landings com o apoio de outra IA, sem duplicar ou comprometer as integrações técnicas já existentes no Guia do Proprietário.

O processo escolhido é simples:

1. A nova landing é criada primeiro, com liberdade de tema, estrutura, copy e visual.
2. O formulário fica preparado no frontend, mas ainda não envia dados reais.
3. Depois de a landing estar aprovada, o Codex liga o formulário à API, ao Sender, à medição e ao circuito operacional existente.

Não é necessário transformar antecipadamente a API atual num sistema genérico para todos os casos possíveis. Depois de existirem duas ou três novas landings, os padrões reais serão centralizados sem criar complexidade desnecessária.

## O que a IA que cria a landing deve fazer

### 1. Construir a experiência completa

A landing deve incluir:

- hero com benefício concreto e CTA claro;
- explicação simples do que o utilizador recebe;
- formulário completo, com os campos visíveis e na ordem pretendida;
- consentimentos com o texto fornecido pelo Guia do Proprietário;
- mensagens específicas para campos vazios ou inválidos;
- estado de envio;
- estado de sucesso;
- estado de erro técnico;
- versão responsiva para telemóvel e computador;
- ligações para a Política de Privacidade, Termos e Lista de Parceiros, quando aplicável.

O visual não deve copiar automaticamente as landings existentes. Cada landing pode testar um tema, uma composição e uma abordagem comercial diferentes.

### 2. Preparar o formulário sem fazer a integração real

Cada campo deve ter:

- uma etiqueta visível;
- um `name` estável e descritivo;
- um tipo adequado, como `email`, `tel`, `text`, `radio` ou `checkbox`;
- indicação clara de ser obrigatório ou opcional;
- uma mensagem de erro própria;
- um espaço reservado para apresentar o erro junto ao campo.

O formulário pode simular visualmente os estados de envio e sucesso para aprovação. Não deve enviar dados para um serviço externo nem apresentar uma confirmação definitiva baseada apenas no clique.

### 3. Entregar uma ficha de integração

Cada landing deve incluir um ficheiro `LANDING-INTEGRATION.md` com esta informação:

```text
Nome da landing:
Objetivo:
URL ou rota prevista:
Identificador sugerido:
Origem da lead:
Campos recolhidos:
Campos obrigatórios:
Campos opcionais:
Texto exato de cada consentimento:
Consentimentos obrigatórios:
Consentimentos opcionais:
O que o utilizador recebe:
O que acontece depois da submissão:
Evento de conversão pretendido: Lead, Contact ou nenhum
Grupo do Sender pretendido, se já estiver decidido:
Necessita de código postal e localidade: sim ou não
Necessita de envio para parceiro: sim ou não
Parâmetros de campanha esperados:
Mensagem de sucesso:
Mensagem de erro técnico:
```

Se algum ponto ainda não estiver decidido, deve ficar assinalado como `por definir`. A IA não deve inventar grupos, consentimentos, finalidades ou regras de tratamento.

## O que a IA não deve fazer

A IA que cria a landing não deve:

- ligar diretamente o formulário ao Sender;
- ligar diretamente o formulário a Google Sheets, Make ou outro serviço;
- incluir tokens, chaves ou segredos no browser;
- escolher IDs de grupos do Sender;
- criar uma API paralela;
- copiar a lógica da API para JavaScript no frontend;
- enviar dados pessoais por email;
- guardar leads em `localStorage`, exceto numa demonstração local claramente identificada;
- carregar o Meta Pixel diretamente;
- disparar `Lead` ou `Contact` no clique do botão;
- instalar um segundo aviso de cookies;
- alterar a Política de Privacidade ou os Termos por iniciativa própria;
- assumir que um envio foi aceite sem confirmação do servidor.

## Configuração técnica que já existe

O portal já dispõe de:

- API própria entre os formulários e o Sender;
- Meta Pixel base com o evento padrão `PageView`;
- evento padrão `Lead` para captações iniciais;
- evento padrão `Contact` para pedidos de contacto ou leads qualificadas;
- bloqueio do Pixel até existir consentimento para cookies de medição;
- geração de um `eventID` único por submissão;
- campos de consentimento e respetiva versão;
- recolha de nome, email, telefone, código postal, localidade e prazo de venda nos fluxos que deles necessitam;
- identificação da localidade a partir do código postal;
- validação de dados no servidor;
- grupos e campos personalizados no Sender;
- páginas legais e Lista de Parceiros.

Estas funções devem ser reutilizadas na integração final. A nova landing não deve criar versões próprias destes mecanismos.

## Regras para os eventos Meta

Os eventos já estão configurados na infraestrutura do portal. Em cada nova landing apenas é necessário indicar qual corresponde ao objetivo do formulário.

### PageView

É tratado pelo Pixel base do portal. A landing não deve enviar outro `PageView`.

### Lead

Usar quando o utilizador deixa um contacto inicial, por exemplo para receber um guia, pedir informação ou entrar num primeiro nível do funil.

O evento só pode ser disparado depois de o servidor confirmar que a submissão foi aceite.

### Contact

Usar quando o utilizador pede contacto, avaliação, proposta, orçamento ou outro seguimento comercial mais qualificado.

O evento só pode ser disparado depois de o servidor confirmar que o pedido foi aceite.

### Regras comuns

- Nunca disparar eventos no clique do botão.
- Não enviar eventos se o utilizador não aceitou cookies de medição.
- Utilizar o mesmo `eventID` no pedido, no evento do browser e, futuramente, na Conversions API.
- Definir um `content_name` próprio e estável para cada formulário.
- Uma mensagem de sucesso no ecrã não substitui a confirmação do servidor.

## Parâmetros de campanha

A landing deve preservar os parâmetros recebidos no URL, incluindo:

- `utm_source`;
- `utm_medium`;
- `utm_campaign`;
- `utm_content`;
- `utm_term`, quando utilizado.

A outra IA deve apenas garantir que a navegação interna não elimina estes parâmetros. A recolha, validação e envio para o sistema serão feitos na integração final.

## Consentimentos

Os consentimentos dependem da finalidade concreta da landing. O texto deve ser fornecido ou aprovado pelo Guia do Proprietário antes da integração.

Regras mínimas:

- não combinar finalidades diferentes sem decisão expressa;
- não pré-selecionar caixas;
- distinguir claramente consentimentos obrigatórios e opcionais;
- não bloquear o formulário por causa de um consentimento opcional;
- ligar os textos às páginas legais aplicáveis;
- conservar espaço para mostrar um erro discreto quando faltar um consentimento obrigatório;
- não reescrever textos legais apenas para os tornar mais curtos.

Cada versão publicada de um consentimento deve receber um identificador de versão na integração final.

## Validação e mensagens de erro

Os erros devem ser claros e aparecer junto ao campo correspondente. Exemplos:

- `Introduza um endereço de email válido.`
- `Introduza o seu nome sem números nem símbolos especiais.`
- `Introduza um número de telemóvel português com 9 algarismos.`
- `Use o formato 1234-567.`
- `Não encontrámos este código postal. Confirme os números.`
- `Escolha uma opção para continuar.`
- `Aceite esta opção para enviar o pedido.`

Uma falha de um campo não deve produzir a mensagem genérica de erro técnico. A mensagem `Não foi possível enviar agora` fica reservada para falhas de rede ou do serviço depois de os dados locais passarem a validação.

## O que o Codex fará depois de a landing estar aprovada

Na fase de integração, o Codex irá:

1. atribuir o identificador final à landing e à origem da lead;
2. registar a origem aceite pela API;
3. mapear os campos do formulário para os campos internos;
4. configurar os grupos e campos necessários no Sender;
5. ligar o código postal à localidade, quando aplicável;
6. recolher e guardar os parâmetros UTM necessários;
7. aplicar a versão correta dos consentimentos;
8. gerar e reutilizar o `eventID`;
9. ligar `Lead` ou `Contact` ao sucesso confirmado pelo servidor;
10. aplicar as regras do aviso de cookies existente;
11. ligar a lead à folha operacional, quando esse circuito estiver ativo;
12. adicionar proteção contra duplicados, abuso e submissões repetidas;
13. criar testes para sucesso, validações, consentimentos e falhas externas;
14. atualizar a documentação e o dashboard operacional.

## Quando centralizar mais a API

A API atual pode ser ampliada landing a landing. A criação de um contrato totalmente genérico só deverá avançar quando existirem padrões repetidos e confirmados.

É um bom momento para centralizar quando:

- existirem pelo menos duas ou três novas landings integradas;
- os mesmos campos e regras se repetirem;
- houver vários destinos de leads;
- a manutenção manual das origens começar a criar risco;
- for necessário ativar ou desativar funis sem alterar código;
- a operação justificar um registo de leads independente do contacto no Sender.

Até lá, a prioridade é lançar experiências reais com segurança, aprender com os resultados e abstrair apenas o que se repetir.

## Checklist de entrega da nova landing

- [ ] Copy final ou claramente marcada como provisória.
- [ ] Visual diferente quando o objetivo for testar uma nova abordagem.
- [ ] Versão móvel revista.
- [ ] Campos com etiquetas, nomes estáveis e erros próprios.
- [ ] Consentimentos fornecidos pelo projeto, sem caixas pré-selecionadas.
- [ ] Estados de envio, sucesso e erro desenhados.
- [ ] Nenhuma integração direta com serviços externos.
- [ ] Nenhum segredo ou ID técnico exposto.
- [ ] Nenhum evento Meta disparado no clique.
- [ ] Parâmetros UTM preservados durante a navegação.
- [ ] Ligações legais incluídas quando necessárias.
- [ ] Ficheiro `LANDING-INTEGRATION.md` preenchido.
- [ ] Landing entregue para aprovação visual antes da ligação à API.

