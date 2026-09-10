# Escolha de consentimento de medição

Alteração aprovada em 10 de setembro de 2026.

O componente global `src/components/CookieConsent.astro` usa uma janela modal nativa. Sem preferência válida, a página aguarda uma decisão. Os botões principais são **Aceitar medição** e **Recusar**, com o mesmo estilo. Ambas as decisões fecham a janela e permitem continuar. Escape e cliques no fundo não são tratados como consentimento nem fecham a janela. Personalizar e Guardar escolha continuam disponíveis.

As escolhas válidas já guardadas são respeitadas, incluindo recusas. Mantêm-se a versão `2026-09-01-1`, a duração de seis meses e o contrato usado pelo tracker. Preferências inválidas ou expiradas voltam a pedir decisão. Cookies, privacidade e termos ficam acessíveis antes da escolha. A medição continua dependente de aceitação explícita.

Validação: cinco testes direcionados de decisão, persistência, revogação e acesso à informação legal; compilação isolada do componente Astro; pré-visualização local em desktop e 390 × 844, com Pixel desativado. Recusar desbloqueia a página e persiste após recarregar. Sem build integral local, leads de teste ou conversões Meta. A publicação seguirá o fluxo normal do repositório; a confirmação online fica para o utilizador.
