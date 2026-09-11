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
