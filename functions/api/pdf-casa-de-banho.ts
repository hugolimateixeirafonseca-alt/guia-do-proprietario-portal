import { createPdfOptinHandler } from '../lib/pdf-optin';
import { PDF_CASA_BANHO_CONSENT_VERSION } from '../../src/data/consent';
const pdf = 'https://guiadoproprietario.pt/downloads/guia-banheira-base-de-duche-2026.pdf';
const campaign = 'https://track.guiadoproprietario.pt/go/casa-banho-campanha?source=pdf-casa-de-banho-email&utm_source=pdf-casa-de-banho&utm_medium=email&utm_campaign=guia-banheira-duche-2026&utm_content=cta-email';
export const onRequestPost = createPdfOptinHandler({
  source: 'pdf-casa-de-banho', pageUrl: 'https://guiadoproprietario.pt/pdf-casa-de-banho/',
  consentVersion: PDF_CASA_BANHO_CONSENT_VERSION, dbBinding: 'PDF_CASA_BANHO_DB',
  eventPrefix: 'banho', registrationPrefix: 'pdf-banho-registration', hashPrefix: 'pdf-banho',
  extraGroups: ['dw87gX'],
  message: {
    subject: 'O seu guia chegou. Veja o próximo passo para a sua casa de banho',
    attachmentUrl: pdf, attachmentName: 'Guia-Banheira-Base-de-Duche-2026.pdf',
    html: `<!doctype html><html lang="pt-PT"><body style="margin:0;background:#eef5f7;color:#123653;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:14px"><tr><td style="padding:32px 28px">
<p style="font-weight:bold;letter-spacing:1px">GUIA DO PROPRIETÁRIO</p>
<h1 style="font-size:27px;line-height:1.2">O seu guia está aqui.</h1>
<p style="line-height:1.7">O PDF <strong>«Vai trocar a banheira por uma base de duche?»</strong> segue em anexo. São 20 páginas para perceber o que escolher, o que verificar e como comparar propostas.</p>
<p><a href="${pdf}" style="display:inline-block;padding:15px 22px;border:1px solid #123653;border-radius:7px;color:#123653;text-decoration:none;font-weight:bold">Abrir e guardar o PDF</a></p>
<table role="presentation" width="100%" style="background:#eff8f2;margin-top:28px;border-radius:10px"><tr><td style="padding:26px 22px">
<p style="font-size:12px;font-weight:bold;letter-spacing:1px;color:#247443">O PRÓXIMO PASSO PARA A SUA CASA</p>
<h2 style="font-size:28px;line-height:1.15;margin:12px 0">Quer trocar a banheira por uma base de duche?</h2>
<p style="line-height:1.7">Veja a campanha de casa de banho e <strong>preencha o pedido de orçamento no site do parceiro</strong>. Descubra as condições disponíveis e peça uma proposta para a sua casa.</p>
<p style="margin:24px 0"><a href="${campaign}" style="display:inline-block;background:#279653;color:#fff;text-decoration:none;border-radius:7px;padding:18px 22px;font-weight:bold;font-size:17px">Ver campanha e pedir orçamento →</a></p>
<p style="font-size:13px;line-height:1.6">O botão abre a página do parceiro. É nessa página que pode preencher o pedido e consultar as zonas abrangidas e as condições da campanha.</p>
</td></tr></table>
<p style="line-height:1.7">Use a checklist do guia para preparar as suas perguntas e comparar o que está incluído na proposta. <a href="${campaign}" style="color:#247443;font-weight:bold">Veja agora a campanha disponível.</a></p>
<p style="border-top:1px solid #e2e9ed;padding-top:20px;font-size:12px;line-height:1.6;color:#607584">Recebe este email porque pediu o guia no Guia do Proprietário. Conteúdo informativo: não executamos obras. <a href="https://guiadoproprietario.pt/privacidade/" style="color:#123653">Política de Privacidade</a>.</p>
</td></tr></table></td></tr></table></body></html>`,
    text: `O seu guia «Vai trocar a banheira por uma base de duche?» está em anexo. Abrir e guardar o PDF: ${pdf}

O PRÓXIMO PASSO PARA A SUA CASA
Quer trocar a banheira por uma base de duche?
Veja a campanha de casa de banho e preencha o pedido de orçamento no site do parceiro.

VER CAMPANHA E PEDIR ORÇAMENTO: ${campaign}

A ligação abre a página do parceiro. É nessa página que pode preencher o pedido e consultar as zonas abrangidas e as condições da campanha. Use a checklist do guia para comparar o que está incluído na proposta.

Recebe este email porque pediu o guia no Guia do Proprietário. Não executamos obras.
Política de Privacidade: https://guiadoproprietario.pt/privacidade/`
  }
});
