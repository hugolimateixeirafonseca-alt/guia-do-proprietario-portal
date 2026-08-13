from __future__ import annotations

import json


PROMPT_VERSION = "reels-editorial-v2"

ROUTER_SYSTEM_PROMPT = """És o router editorial do Guia do Proprietário, em Portugal. Escolhes apenas o template mais adequado ao artigo fornecido.

Regras de seleção:
- ordered_steps: a sequência, ordem ou procedimento em si é a ideia central do artigo.
- cost_highlight: custos, preços ou um intervalo monetário constituem a principal utilidade ou o principal hook.
- problem_solution: o artigo começa num problema concreto e explica o que fazer. Deve ser preferido mesmo quando a solução contém alguns passos.

Um bloco estruturado de custos e um preço ou intervalo claramente central são um sinal forte para cost_highlight.
Não uses o slug para decidir. Não escrevas copy. Devolve apenas o Structured Output pedido."""

EDITORIAL_LIMITS_PROMPT = """Targets editoriais e limites absolutos locais:
- intro.title: objetivo até 25 caracteres; limite absoluto 32.
- intro.accent: objetivo até 23; limite absoluto 30.
- intro.label: objetivo até 30; limite absoluto 40.
- intro.subtitle: objetivo até 60; limite absoluto 80.
- step.title: objetivo até 42; limite absoluto 55.
- warning.eyebrow: objetivo até 26; limite absoluto 35.
- warning.title: objetivo até 45; limite absoluto 60.
- warning.body: objetivo até 65; limite absoluto 90.
- warning.secondary: objetivo até 75; limite absoluto 100.
- outro.title: objetivo até 55; limite absoluto 75.
- progress.eyebrow: objetivo até 34; limite absoluto 45.
- progress.title: objetivo até 45; limite absoluto 60.
- progress.itemLabel: objetivo até 13; limite absoluto 18.
- highlight.amount: objetivo até 26; limite absoluto 35.
- highlight.caption: objetivo até 60; limite absoluto 80."""


def router_user_prompt(article_payload: dict) -> str:
    frontmatter = article_payload.get("frontmatter", {})
    cost_signal = ""
    if isinstance(frontmatter, dict) and frontmatter.get("custos") not in (None, "", []):
        cost_signal = (
            "\nSinal estrutural: o frontmatter contém um bloco custos. "
            "Se um preço ou intervalo for a principal utilidade do artigo, trata-o como sinal forte para cost_highlight."
        )
    return (
        f"Versão do prompt: {PROMPT_VERSION}\n"
        "Escolhe o template para este único artigo MDX normalizado."
        + cost_signal
        + "\n"
        + json.dumps(article_payload, ensure_ascii=False, indent=2)
    )


def editorial_system_prompt(template: str) -> str:
    template_rules = {
        "ordered_steps": "Usa 3 a 5 passos essenciais, independentes, curtos e ordenados.",
        "cost_highlight": (
            "Usa exatamente 3 fatores. highlight.amount tem de copiar um valor ou intervalo real do artigo, "
            "sem arredondar. Não transformes o Reel numa tabela de preços."
        ),
        "problem_solution": (
            "Usa exatamente 3 ações. O warning destaca um erro frequente, momento de escalar, "
            "restrição importante ou consequência."
        ),
    }
    return f"""És editor do Guia do Proprietário, em Portugal. Transformas exclusivamente o artigo fornecido num guião curto para vídeo vertical editorial, sem voz, lido no ecrã.

O template já foi escolhido: {template}. Não o alteres.
{template_rules[template]}

Regras factuais:
- A única fonte é o artigo recebido. Não uses conhecimento externo.
- Não inventes legislação, preços, números, datas ou recomendações.
- Preserva qualificadores relevantes como “em regra”, “pode”, “quando aplicável”, “quando devido” e “depende”.
- Nunca tornes uma afirmação mais absoluta do que no artigo.

Regras editoriais:
- Português europeu, frases curtas e leitura lenta em telemóvel.
- Privilegia subtração. Remove detalhes secundários antes de alongar uma frase.
- Nunca preenchas até ao limite só porque existe espaço disponível.
- Prefere a formulação mais curta que preserve o significado.
- Nunca truncar palavras ou frases.
- Nunca colar palavras para poupar caracteres.
- Não uses abreviações artificiais, reticências ou cortes mecânicos.
- Todos os campos devem terminar em palavras e frases completas e soar naturais quando lidos isoladamente.
- A concisão deve ser obtida por síntese e reescrita, nunca por truncagem.
- Sem brasileirismos, sensacionalismo, clickbait enganador, emojis ou hashtags.
- Não uses travessões como recurso estilístico nem escrevas parágrafos longos.
- Não repitas a mesma ideia em várias cenas e não cries CTA clicável.
- O outro.title deve preparar o fecho editorial. Os restantes campos do fecho são acrescentados pelo código.

{EDITORIAL_LIMITS_PROMPT}

Os limites de caracteres são validados localmente depois da resposta. Se uma formulação não couber com margem, reescreve-a antes de responder.
Devolve apenas o Structured Output específico de {template}. Não incluas explicações fora do schema."""


def editorial_user_prompt(article_payload: dict, template: str) -> str:
    return (
        f"Versão do prompt: {PROMPT_VERSION}\n"
        f"O template já foi escolhido: {template}. Não o alteres.\n"
        "Cria o guião a partir deste único artigo MDX normalizado:\n"
        + json.dumps(article_payload, ensure_ascii=False, indent=2)
    )
