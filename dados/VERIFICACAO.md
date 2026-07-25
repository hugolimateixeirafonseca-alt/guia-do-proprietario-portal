# Verificação dos dados oficiais

Data: 24 de julho de 2026  
Responsável pela extração e validação técnica: Codex  
Fontes: Autoridade Tributária e indicador INE 0012234

## Cobertura e integridade

- 308 municípios na lista mestra.
- 308 registos de IMI, dos quais 278 com taxa publicada e 30 com estado `nao_publicada`.
- 308 registos de preços. Quatro usam fallback NUTS III e nenhum termina sem valor.
- Nenhum slug ou código INE duplicado.
- As taxas urbanas publicadas estão entre 0,3% e 0,5%.
- Os valores de controlo do 4T2025 definidos em `DADOS-SPEC.md` coincidem com a série oficial.
- Os dois scripts foram repetidos em modo de cache. Os três ficheiros JSON mantiveram exatamente os mesmos hashes.
- O build terminou com 0 erros, 0 avisos e 0 sugestões.
- O sitemap contém 308 URLs de IMI e 308 URLs de preços, num total de 646 páginas.

## Amostra verificada

| Município | IMI 2025 | IMI 2024 | Preço 1T2026 | Resultado |
|---|---:|---:|---:|---|
| Lisboa | 0,30% | 0,30% | 5 082 €/m² | Ambas as fontes presentes |
| Porto | 0,324% | 0,324% | 3 510 €/m² | Ambas as fontes presentes |
| Évora | 0,37% | 0,37% | 2 255 €/m² | Ambas as fontes presentes |
| Barrancos | 0,30% | 0,30% | 914 €/m² | Preço identificado como fallback do Baixo Alentejo |
| Angra do Heroísmo | Não publicada | Não publicada | 1 316 €/m² | A página de IMI mostra a mensagem própria, sem zero |
| Calheta, Açores | Não publicada | Não publicada | 697 €/m² | Homónimo guardado como `calheta-acores` |
| Calheta, Madeira | Não publicada | Não publicada | 1 722 €/m² | Homónimo guardado como `calheta-madeira` |

Os valores foram comparados com as respostas oficiais guardadas na cache dos scripts. Antes de publicar, o Hugo deve repetir a confirmação visual desta amostra nos sites oficiais, conforme a secção 5 de `DADOS-SPEC.md`.
