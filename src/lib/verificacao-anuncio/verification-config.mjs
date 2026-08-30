export const VERIFICATION_CONFIG = Object.freeze([
  {
    id: 1,
    key: "localizacao",
    name: "Morada ou zona identificável",
    minimumEvidence: "Cidade e zona/bairro, ou morada suficientemente específica.",
    action: "Peça a localização exata ou, no mínimo, a cidade e a zona do imóvel antes de avançar."
  },
  {
    id: 2,
    key: "preco_zona",
    name: "Preço face à referência da zona",
    minimumEvidence: "Preço mensal, localização compatível e referência de preço válida.",
    action: "Confirme a localização e o valor mensal para permitir uma comparação com a referência disponível."
  },
  {
    id: 3,
    key: "tipologia_area",
    name: "Tipologia e área coerentes entre a informação enviada",
    minimumEvidence: "Tipologia e/ou área em duas ocorrências comparáveis, sem contradição.",
    action: "Peça confirmação por escrito da tipologia e da área e esclareça qualquer diferença entre o texto e as imagens."
  },
  {
    id: 4,
    key: "fotografias",
    name: "Fotografias coerentes e correspondências externas relevantes",
    minimumEvidence: "Coerência interna, pesquisa externa concluída e contexto das correspondências validado.",
    action: "Peça esclarecimento sobre as diferenças encontradas nas fotografias ou no contexto das páginas correspondentes."
  },
  {
    id: 5,
    key: "despesas",
    name: "Despesas incluídas explicitadas",
    minimumEvidence: "Indicação explícita das despesas incluídas e excluídas, ou declaração inequívoca equivalente.",
    action: "Confirme por escrito quais as despesas incluídas no valor mensal e quais serão pagas à parte."
  },
  {
    id: 6,
    key: "pagamentos",
    name: "Condições de pagamento explicitadas",
    minimumEvidence: "Todos os montantes anteriores à entrega das chaves, respetiva finalidade e momento de pagamento.",
    action: "Peça a discriminação por escrito de todos os valores exigidos antes da entrada: caução, sinal, primeira renda e outras quantias."
  },
  {
    id: 7,
    key: "visita",
    name: "Disponibilidade para visita presencial mencionada",
    minimumEvidence: "Menção explícita à possibilidade de visita presencial.",
    action: "Antes de qualquer pagamento, confirme se é possível visitar o imóvel presencialmente."
  },
  {
    id: 8,
    key: "contrato",
    name: "Contrato escrito mencionado",
    minimumEvidence: "Menção explícita à celebração de contrato escrito.",
    action: "Peça confirmação por escrito de que será celebrado contrato e solicite a minuta antes de transferir dinheiro."
  },
  {
    id: 9,
    key: "recibos",
    name: "Recibos de renda mencionados",
    minimumEvidence: "Menção explícita à emissão de recibos de renda.",
    action: "Confirme por escrito que serão emitidos os recibos de renda aplicáveis."
  },
  {
    id: 10,
    key: "titular_conta",
    name: "Identificação do titular da conta que receberá o pagamento",
    minimumEvidence: "Nome do titular e correspondência normalizada exata com a pessoa ou entidade apresentada no arrendamento.",
    action: "Peça o nome completo do titular da conta que receberá o pagamento e confirme a relação desse titular com o arrendamento."
  },
  {
    id: 11,
    key: "autorizacao_documental",
    name: "Propriedade ou autorização documental para arrendar o imóvel",
    minimumEvidence: "Não confirmável na V1, que não suporta análise documental.",
    action: "Peça documentação adequada para confirmar quem é o proprietário ou está autorizado a arrendar o imóvel."
  },
  {
    id: 12,
    key: "financas_recibos",
    name: "Compromisso de comunicação do contrato às Finanças e emissão dos recibos aplicáveis",
    minimumEvidence: "Menção explícita à comunicação do contrato e à emissão dos recibos aplicáveis.",
    action: "Confirme por escrito como será feita a comunicação do contrato às Finanças e a emissão dos recibos aplicáveis."
  }
]);

export const VERIFICATION_BY_ID = new Map(
  VERIFICATION_CONFIG.map((verification) => [verification.id, verification])
);

