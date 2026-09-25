const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const clean = (value, max = 120) => typeof value === 'string' ? value.trim().replace(/[\r\n]+/g, ' ').slice(0, max) : '';
const positive = value => Number.isSafeInteger(value) && value > 0;

export function renderPartnerEngagementEmail(payload) {
  const data = payload.data || {};
  const place = clean(data.municipality);
  const url = new URL(payload.dashboard_url);
  if (url.protocol !== 'https:' || url.hostname !== 'parceiros.guiadoproprietario.pt' || url.port || url.username || url.password) throw new Error('invalid_dashboard_url');
  let subject, preview, paragraphs, button, action = url.toString();
  switch (payload.event_type) {
    case 'shared_contact_acquired': {
      const phone = clean(data.client_phone, 24).replace(/[\s()-]/g, '');
      if (!place || !/^\+?[0-9]{9,15}$/.test(phone)) throw new Error('invalid_event_data');
      subject = `Há mais alguém no pedido de ${place}`;
      preview = 'Quem liga primeiro costuma ficar com o serviço.';
      paragraphs = [
        `Outro profissional de limpeza recebeu também o contacto do cliente de ${place}.`,
        'A partir de agora, o cliente pode receber mais do que uma proposta. E nas limpezas, quem fala primeiro com o cliente sai à frente: esclarece as dúvidas, marca a visita e é a primeira proposta que o cliente tem em cima da mesa.',
        'Se ainda não ligou, este é o momento.',
        'Dica: se o cliente não atender, envie logo uma mensagem por WhatsApp a dizer que vem do pedido feito no Guia do Proprietário. Assim reconhece quem está a ligar e é mais provável que responda.'
      ];
      button = 'Ligar ao cliente agora'; action = `tel:${phone}`;
      break;
    }
    case 'unused_free_contacts': {
      if (!positive(data.active_requests) || !positive(data.free_contacts) || !clean(data.localities, 500)) throw new Error('invalid_event_data');
      const localities = clean(data.localities, 500);
      subject = `${data.active_requests} pedidos de limpeza em ${localities}, e ${data.free_contacts} contactos por nossa conta`;
      preview = 'Fale com clientes reais sem gastar nada.';
      paragraphs = [
        `Há neste momento ${data.active_requests} pedidos ativos nas suas zonas: ${localities}.`,
        `E ainda tem ${data.free_contacts} contactos gratuitos na sua conta. Ou seja, pode falar com clientes que pediram mesmo uma limpeza e apresentar-lhes a sua proposta sem pagar nada.`,
        'É simples:\n1. Vê o pedido completo: tipo de limpeza, casa, frequência e dias preferidos.\n2. Aceita só os que lhe interessam.\n3. Recebe o contacto e liga ao cliente.',
        'Os pedidos não ficam à espera. Quando outros profissionais os aceitam, as vagas esgotam.'
      ];
      button = 'Usar os meus contactos gratuitos';
      break;
    }
    case 'first_contact_feedback':
      if (!place) throw new Error('invalid_event_data');
      subject = `Como correu com o cliente de ${place}?`;
      preview = 'Leva 10 segundos.';
      paragraphs = [`Já conseguiu falar com o cliente de ${place}?`, 'Diga-nos como correu. Leva 10 segundos, e cada resposta ajuda-nos a perceber que pedidos funcionam melhor para si. É assim que afinamos os pedidos que lhe mostramos, para receber cada vez mais os que lhe interessam e menos os que não servem.'];
      button = 'Dizer como correu';
      break;
    case 'free_contacts_exhausted':
      subject = 'Usou os 4 contactos gratuitos. E agora?';
      preview = 'Continue a receber clientes a partir de 4,50 €.';
      paragraphs = [
        'Já usou os 4 contactos gratuitos da sua conta. Esperamos que alguns já se tenham transformado em serviços.',
        'Para continuar a receber clientes, basta carregar saldo. Em cada pedido escolhe:',
        'Contacto partilhado · 4,50 €\nAté 3 profissionais recebem o contacto. Paga menos e apresenta a sua proposta.',
        'Contacto exclusivo · 7 €\nMais ninguém recebe os dados do cliente através do Guia do Proprietário.',
        'Faça a conta: um único cliente de limpeza regular pode pagar muitos contactos, logo no primeiro mês.',
        'Sem mensalidade. Sem fidelização. O saldo só é descontado quando aceita um contacto, e carrega por cartão ou MB WAY a partir de 7 €.'
      ];
      button = 'Carregar saldo';
      break;
    case 'lead_expiring':
      if (!place || data.days_remaining !== 5) throw new Error('invalid_event_data');
      subject = `Ninguém aceitou ainda o pedido de ${place}`;
      preview = 'Pode ficar com ele em exclusivo. Faltam 5 dias.';
      paragraphs = [
        `O pedido de ${place} ainda não foi aceite por ninguém.`,
        'Isto quer dizer duas coisas:\n• O cliente ainda não recebeu nenhuma proposta através do Guia do Proprietário.\n• Pode ficar com ele em exclusivo: mais ninguém recebe os dados através do Guia do Proprietário.',
        'O pedido termina dentro de 5 dias. Depois disso, deixa de estar disponível.'
      ];
      button = 'Ver pedido';
      break;
    case 'inactive_buyer':
      if (!positive(data.missed_requests)) throw new Error('invalid_event_data');
      subject = `${data.missed_requests} pedidos na sua zona passaram-lhe ao lado`;
      preview = 'Veja os que ainda estão disponíveis.';
      paragraphs = [
        `Na última semana, ${data.missed_requests} pedidos compatíveis com as suas zonas foram aceites por outros profissionais ou deixaram de estar disponíveis.`,
        'Há novos pedidos a entrar. Veja os que estão disponíveis agora, antes que outra pessoa chegue primeiro.',
        'Os pedidos que recebe não lhe servem? Ajuste as zonas, os tipos de limpeza ou os dias na sua área de parceiro, e passamos a mostrar-lhe só o que faz sentido. Se estiver sem disponibilidade, pode pausar a receção de pedidos em vez de os deixar passar.'
      ];
      button = 'Ver pedidos disponíveis';
      break;
    default: throw new Error('invalid_event_type');
  }
  const greeting = `Olá, ${clean(payload.partner_name)}.`;
  const footer = 'Guia do Proprietário\nSe não quiser receber estas comunicações, responda a este email.';
  return {
    subject,
    text: [greeting, ...paragraphs, `${button}: ${action}`, footer].join('\n\n'),
    html: `<!doctype html><html lang="pt-PT"><body style="margin:0;background:#fff;color:#202923;font-family:Arial,sans-serif;font-size:16px;line-height:1.65"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preview)}</div><main style="max-width:600px;margin:0 auto;padding:24px 16px"><p>${escapeHtml(greeting)}</p>${paragraphs.map(p => `<p>${escapeHtml(p).replaceAll('\n', '<br>')}</p>`).join('')}<p style="margin:24px 0"><a href="${escapeHtml(action)}" style="display:inline-block;background:#315d4d;color:#fff;padding:12px 20px;border-radius:5px;text-decoration:none">${escapeHtml(button)}</a></p><p style="font-size:13px;color:#606a64">${escapeHtml(footer).replaceAll('\n', '<br>')}</p></main></body></html>`
  };
}
