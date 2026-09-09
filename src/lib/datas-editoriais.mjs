// A data de revisão do rascunho não é a data de publicação no portal.
export function datasEditoriais(data) {
  const publicacao = new Date(data.publicado_em);
  const revisao = new Date(data.revisto);
  const atualizacao = revisao > publicacao ? revisao : publicacao;
  const dia = (value) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(value);
  return { publicacao, atualizacao, revisaoPosterior: dia(revisao) > dia(publicacao) };
}
