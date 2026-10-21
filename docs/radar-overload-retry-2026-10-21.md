# Correção da sobrecarga do Editorial Radar, 21-10-2026

A execução 39597285454 terminou após uma rejeição OpenAI HTTP 503 com código server_is_overloaded, antes de uma resposta utilizável do modelo.

A função HTTP agora permite duas novas tentativas exclusivamente para esse código e estado, com esperas de 5 e 10 segundos. Respostas bem-sucedidas, falhas de ligação, respostas inválidas e outros erros não são repetidos. Não há reinício do Radar, alterações de modelos, prompts, ferramentas, agenda ou orçamento. A contabilização existente recebe apenas a resposta final bem-sucedida.

O fluxo normal mantém uma chamada. Recuperar uma rejeição permite realizar o trabalho originalmente previsto; não é uma garantia de consumo total idêntico ao de uma execução que abortou antes de o realizar. Não foram efetuadas chamadas reais ou novas execuções para validar a alteração.

Validação: cinco testes locais com respostas simuladas, verificação de sintaxe do Radar e diff sem erros de whitespace. Sem build integral e sem verificação online posterior.