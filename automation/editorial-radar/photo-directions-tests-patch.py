from pathlib import Path

p=Path('automation/editorial-radar/publication-image-prompt.test.mjs')
t=p.read_text()
t=t.replace("assert.match(publication.prompt_imagem,/chave em primeiro plano/iu);","assert.match(publication.prompt_imagem,/chave(?: de casa)? em primeiro plano/iu);")
t=t.replace("assert.doesNotMatch(resolved,/gráficos artificiais.*texto/iu);","assert.doesNotMatch(resolved,/gráfico de linhas/iu);")
p.write_text(t)

p=Path('automation/editorial-radar/v22-core.test.mjs')
t=p.read_text()
old="""test('publicação completa passa e direção específica é preservada',()=>{
  const direction=generated.orientacao_ilustracao_segura;
  assert.equal(safeIllustrationDirection(direction,event),direction);
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.match(publication.prompt_imagem,/corredor comum/iu);
});
"""
new="""test('publicação completa passa e tema conhecido usa direção fotográfica determinística',()=>{
  const direction=generated.orientacao_ilustracao_segura;
  const resolved=safeIllustrationDirection(direction,event);
  assert.match(resolved,/Fotografia editorial realista/iu);
  assert.match(resolved,/arrendamento/iu);
  const publication=finalizePublication({publishableNews:true,event,generated});
  assert.match(publication.prompt_imagem,/corredor comum/iu);
  assert.doesNotMatch(publication.prompt_imagem,/SUBJECT DIRECTION\\nIlustração/iu);
});
"""
if old not in t:
    raise SystemExit('v22-core visual test not found')
t=t.replace(old,new,1)
p.write_text(t)
