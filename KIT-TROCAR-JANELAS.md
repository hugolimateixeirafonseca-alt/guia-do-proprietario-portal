# Kit Trocar Janelas em 2026

Estado: publicação da landing e ativação do Sender autorizadas expressamente pelo utilizador em 11 de setembro de 2026. Implementação validada e preparada para envio pelo fluxo normal de produção. Conclusão do deployment e entrega real não consultadas nem presumidas.

## Página e documento
- Novo endereço: https://guiadoproprietario.pt/kit-trocar-janelas/
- Cabeçalho e composição inspirados na referência fornecida: Casa e Obras, fundo claro, título verde, formulário de email e capa real do PDF.
- PDF original de 12 páginas preservado, sem alterações, em public/downloads/kit-trocar-janelas-2026.pdf.
- SHA-256: D29E6B113E6E4089E1A3DF9CD2460F76F1C5CCDC052F52D9E876FBA290CE66BA.
- Os dois links do PDF usam a oferta kit-trocar-janelas, source=kit-trocar-janelas-pdf e a campanha checklist-17-pontos.
- As três landings anteriores permanecem nas suas rotas. Nova página excluída do sitemap e com noindex.

## Consentimento e entrega
- Primeiro consentimento obrigatório apenas para receber o PDF, com ligação à Política de Privacidade. Não autoriza partilha com parceiros.
- Segundo consentimento de comunicações igual ao das páginas de limpeza, sem a indicação “opcional”, desmarcado e não obrigatório.
- Versão kit-janelas-2026-09-a no registo central. Política de Privacidade atualizada.
- POST /api/kit-trocar-janelas valida email, origem, versão e escolhas, limita pedidos e regista prova com identificadores protegidos por hash na base existente KIT_ESTUDANTE_DB.
- Pedido aceite pelo Sender envia email transacional com ligação e anexo do PDF. A página só confirma depois da aceitação do fornecedor.
- Apenas a segunda escolha marcada cria/atualiza inscrição no grupo de marketing do Sender. Não usa grupo de parceiros nem desencadeia outras automações. Uma escolha desmarcada não altera subscrições anteriores.
- Reutiliza SENDER_API_TOKEN, SENDER_GROUP_MARKETING, SENDER_TRANSACTIONAL_FROM_EMAIL, SENDER_TRANSACTIONAL_FROM_NAME, SESSION_SECRET e KIT_ESTUDANTE_DB. Sem novas migrações.
- Publicação e ativação externa autorizadas pelo utilizador. A função fica disponível com o deployment, usando a configuração Sender existente. Nenhum email ou contacto real de teste foi enviado nesta tarefa.

## Validação
- 13 testes direcionados aprovados, com base SQLite temporária e chamadas ao Sender simuladas.
- Compilação isolada da página, CSS, script e função aprovada. Sem compilação integral.
- Pré-visualização local observada em desktop e telemóvel, sem conteúdo fora da largura.
- Primeiro consentimento exigido e segundo desmarcado sem a palavra “opcional” confirmados no navegador.
- Integridade do PDF e dos links verificada localmente.
- Pré-visualização local em http://127.0.0.1:4329/kit-trocar-janelas/ não envia emails.
- Tracking próprio já configurado em tarefa anterior. Mapeamento de landing_url nos relatórios do tracker continua pendente, conforme documentação do tracker. Nenhum clique de teste criado.

## Agradecimento comercial
- Novo endereço: /kit-trocar-janelas/obrigado/. Apresentado apenas depois de a API aceitar o pedido.
- Confirmação do kit, título “Quanto custa trocar as suas janelas?”, fotografia e um único CTA principal: “Ver campanha e pedir orçamento”. Condições da campanha junto do botão.
- Destino: oferta ativa kit-trocar-janelas, com source=kit-trocar-janelas-obrigado e utm_content=cta-obrigado. Oferta reutilizada; não cria outra campanha nem altera o PDF.
- Conserva apenas parâmetros de atribuição permitidos na passagem entre páginas, sem email no URL. Identificadores Meta só no clique com consentimento de medição válido. Não dispara Lead ou Contact no clique.
- Ambos os endereços excluídos do sitemap e com noindex. Revisão local em desktop e telemóvel, sem overflow, aprovada.
- O workflow normal de publicação inclui os ficheiros do kit e os 13 testes direcionados. Sem build integral local, consulta de deployment ou clique real no tracker.

## Correção de publicação em 12 de setembro de 2026

O envio original ed66c38d0 falhou no workflow 34607102980: a página de agradecimento omitia a propriedade obrigatória imagemOg do layout Squeeze. A verificação Astro bloqueou a publicação integral. A propriedade foi corrigida com a imagem já existente da campanha. A verificação direcionada reproduziu o erro original e passou com a correção (3 ficheiros, zero erros). Foi acrescentada uma verificação de tipos das páginas do kit antes do build de produção.

O publicador de artigos executou diariamente às 07:00 UTC nos oito dias consultados (08:00 de Lisboa). Em 12 de setembro, a execução 34679580639 moveu adaptar-casa-pais-idosos.mdx para artigos no commit 7024a474a. O deployment 0716b842-4887-4bdc-9914-66df9841f0da falhou na etapa de build, com aviso do observador de proximidade ao limite de 20 minutos; o detalhe do erro desse build Cloudflare não foi consultado. Nove artigos continuam na fila válida, um por execução. O próximo é alargar-porta-casa-banho.mdx. Oito testes de fila e datas aprovados. Não se alterou a cadência nem se anteciparam os nove artigos.

Antes da correção, landing, agradecimento e artigo adaptar-casa-pais-idosos devolveram HTTP 404. Correção autorizada pelo pedido do utilizador. Confirmação de publicação será registada no dashboard após a recuperação.

## Diagnóstico e correção Sender em 12 de setembro de 2026

O pedido original das 16:07 UTC falhou antes do registo de marketing; a resposta específica perdeu-se no diagnóstico genérico. As consultas autorizadas confirmaram grupo egK8WG existente e contacto de teste já associado, com consentimento comercial. A API aceita os campos existentes. CONSENT_PUBLICIDADE não existe no inventário de 34 campos, mas a atualização testada foi aceite; não se atribui a causa original a esse campo sem evidência.

Um pedido pelo endpoint público às 16:20 UTC registou marketing com sucesso e falhou no envio exatamente após 12 segundos. O histórico Sender não tinha emails enviados. O único teste de email autorizado foi concluído diretamente com a mesma função e mensagem, sem nova inscrição: Sender HTTP 200 em 1689 ms; histórico transacional got às 17:21:54 de Lisboa, assunto O seu kit para trocar janelas em 2026. Mensagem inclui a ligação e anexo por URL do PDF original. Aceitação e registo no fornecedor confirmados; receção na caixa do utilizador não observada.

Correção: libertar respostas de marketing antes da chamada seguinte, aguardar até 45 segundos no envio deste kit (restantes clientes mantêm 12 segundos), registar passo/HTTP ou send_timeout sem contactos, tratar timeout como entrega por confirmar e sem repetição automática. Compatibilidade com a ausência do campo adicional de publicidade, mantendo CONSENT_MARKETING e a versão de consentimento. 21 testes direcionados aprovados. Não se presume que o aumento do limite resolva todas as falhas do fornecedor; formulário após publicação aguarda novo teste pelo utilizador. Sem alterações às outras landings, PDF, grupos, cadência editorial ou automações comerciais.

## Associação repetida ao grupo, 12 de setembro de 2026

A publicação 62e1a8fc124973fe0458f257f694ebede15625d8 terminou com sucesso no workflow 34705139927 às 16:40:28 UTC. Os novos pedidos das 16:43 UTC identificaram marketing_group_400, antes do envio de email. Consulta de leitura ao Sender confirmou que o contacto do teste já estava ativo e associado ao grupo egK8WG. O código repetia a associação depois de criar o contacto com esse mesmo grupo e também para contactos já associados.

Correção: usar subscriber_tags da resposta Sender para reconhecer associação existente e atualizar apenas os campos de consentimento. Na criação, usar a associação incluída em groups sem outro POST. Para contactos existentes fora do grupo, manter associação explícita sem substituir grupos anteriores. Em erros 400/409 de associação concorrente, só prosseguir se uma releitura confirmar o grupo; caso contrário conservar a falha. Respostas consumidas para libertar as ligações do Worker. 25 testes direcionados aprovados, incluindo erro sem associação, associação concorrente, contacto novo e contacto existente. PDF, consentimentos, automações e restantes landings preservados. A publicação desta segunda correção e o percurso público serão registados no dashboard após confirmação.
