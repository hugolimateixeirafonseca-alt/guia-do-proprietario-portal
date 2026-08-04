export const CONSENT_VERSION = "2026-08-b";
export const NEWSLETTER_CONSENT_VERSION = "newsletter-2026-08-a";

export const CONSENT_TEXT = {
  "2026-08-b": {
    c1: "Quero receber o guia e aceito receber conselhos e novidades do Guia do Proprietário por email. Posso cancelar a qualquer momento. Li a Política de Privacidade.",
    c2: "Autorizo a partilha do meu contacto com empresas parceiras do Guia do Proprietário, para me contactarem sobre produtos e serviços. Consulte quem são na lista de parceiros. (Opcional)"
  },
  "newsletter-2026-08-a": {
    c1: "Aceito receber a newsletter do Guia do Proprietário por email e li a Política de Privacidade. Posso cancelar quando quiser.",
    c2: ""
  }
} as const;

export type ConsentVersion = keyof typeof CONSENT_TEXT;
