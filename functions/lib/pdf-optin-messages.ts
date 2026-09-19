export function windowsMessage(PDF_URL: string, CAMPAIGN_URL: string) { return {
      subject: "O seu kit + janelas novas com até 25% de desconto",
      html: `<!doctype html><html lang="pt-PT"><body style="margin:0;background:#f7f4e9;color:#203f35;font-family:Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center" style="padding:30px 16px"><table role="presentation" width="100%" style="max-width:580px;background:#fff;border-radius:16px"><tr><td style="padding:30px 24px">
<p style="font-size:12px;letter-spacing:2px">GUIA DO PROPRIETÁRIO · CASA E OBRAS</p>
<p style="line-height:1.7">O seu <strong>Kit Trocar Janelas em 2026</strong> está em anexo. Pode também <a href="${PDF_URL}" style="color:#20503e">abrir e guardar o PDF aqui</a>.</p>
<p style="font-size:12px;letter-spacing:1px;margin-top:28px">CAMPANHA JANELAS · GRANDE LISBOA</p>
<h1 style="font-family:Georgia,serif;font-size:34px;line-height:1.15">Janelas novas com até 25% de desconto</h1>
<p style="line-height:1.7">Quer uma casa mais confortável? <strong>Peça já o seu orçamento gratuito</strong> e descubra quanto custa substituir as suas janelas em PVC com esta campanha.</p>
<p style="margin:26px 0 12px"><a href="${CAMPAIGN_URL}" style="display:inline-block;background:#20503e;color:#fff;text-decoration:none;border-radius:10px;padding:17px 24px;font-weight:bold">PEDIR O MEU ORÇAMENTO GRÁTIS</a></p>
<p style="font-size:14px;line-height:1.6">Orçamento gratuito e sem compromisso.</p>
<p style="line-height:1.7"><strong>Clique no botão e preencha o formulário no site do parceiro.</strong> É aí que faz o pedido para a sua casa. Pode avançar agora e usar a checklist do kit para comparar a proposta quando a receber.</p>
<p style="font-size:12px;line-height:1.6;color:#5d6b61">Campanha para substituição de 3 ou mais janelas, nas zonas abrangidas da Grande Lisboa. Até 25% de desconto, sujeito às condições da campanha e ao orçamento após visita técnica.</p>
<p style="line-height:1.7">O kit ajuda-o a escolher. O orçamento mostra-lhe o custo para a sua casa. <a href="${CAMPAIGN_URL}" style="color:#20503e;font-weight:bold">Peça o seu orçamento grátis no site do parceiro.</a></p>
<p style="border-top:1px solid #e6e9e1;padding-top:20px;font-size:12px;line-height:1.6;color:#6b7870">Recebe este email porque pediu o kit no Guia do Proprietário. <a href="https://guiadoproprietario.pt/privacidade/" style="color:#38634b">Política de Privacidade</a>.</p>
</td></tr></table></td></tr></table></body></html>`,
      text: `O seu Kit Trocar Janelas em 2026 está em anexo. Abrir e guardar o PDF: ${PDF_URL}

CAMPANHA JANELAS · GRANDE LISBOA
Janelas novas com até 25% de desconto

Quer uma casa mais confortável? Peça já o seu orçamento gratuito e descubra quanto custa substituir as suas janelas em PVC com esta campanha.

PEDIR O MEU ORÇAMENTO GRÁTIS: ${CAMPAIGN_URL}
Orçamento gratuito e sem compromisso.

Clique na ligação e preencha o formulário no site do parceiro. É aí que faz o pedido para a sua casa. Pode avançar agora e usar a checklist do kit para comparar a proposta quando a receber.

Campanha para substituição de 3 ou mais janelas, nas zonas abrangidas da Grande Lisboa. Até 25% de desconto, sujeito às condições da campanha e ao orçamento após visita técnica.

O kit ajuda-o a escolher. O orçamento mostra-lhe o custo para a sua casa. Peça o seu orçamento grátis no site do parceiro: ${CAMPAIGN_URL}

Recebe este email porque pediu o kit no Guia do Proprietário.
Política de Privacidade: https://guiadoproprietario.pt/privacidade/`,
      attachmentUrl: PDF_URL, attachmentName: "Trocar-Janelas-2026.pdf"
}; }
