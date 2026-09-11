# Kit Trocar Janelas em 2026

Estado: implementação local preparada para revisão. Não enviada nem publicada. Entrega real pelo Sender não ativada nem ensaiada nesta tarefa.

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
- Publicação e ativação externa aguardam aprovação. Nenhum email ou contacto real foi enviado nesta tarefa.

## Validação
- 11 testes direcionados aprovados, com base SQLite temporária e chamadas ao Sender simuladas.
- Compilação isolada da página, CSS, script e função aprovada. Sem compilação integral.
- Pré-visualização local observada em desktop e telemóvel, sem conteúdo fora da largura.
- Primeiro consentimento exigido e segundo desmarcado sem a palavra “opcional” confirmados no navegador.
- Integridade do PDF e dos links verificada localmente.
- Pré-visualização local em http://127.0.0.1:4329/kit-trocar-janelas/ não envia emails.
- Tracking próprio já configurado em tarefa anterior. Mapeamento de landing_url nos relatórios do tracker continua pendente, conforme documentação do tracker. Nenhum clique de teste criado.
