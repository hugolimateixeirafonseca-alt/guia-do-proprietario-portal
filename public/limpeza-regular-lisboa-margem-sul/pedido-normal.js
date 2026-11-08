const normalTiming = {
  asap: 'O mais rápido possível', this_week: 'Esta semana', next_week: 'Próxima semana',
  specific_date: 'Tenho uma data', flexible: 'A combinar com o profissional de limpeza'
};
const normalSizes = {
  t0_t1: 'T0 / T1', t2: 'T2', t3: 'T3', t4_mais: 'T4 ou superior',
  small_space: 'Espaço pequeno', medium_space: 'Espaço médio', large_space: 'Espaço grande'
};
const normalSpaces = {Apartamento:'apartamento', Moradia:'moradia', Escritório:'escritorio', Loja:'loja', 'Alojamento local':'alojamento_local', Outro:'outro'};
const normalChannels = {Chamada:'phone', SMS:'sms', WhatsApp:'whatsapp', Email:'email'};
const normalWeekdays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

function normalSelect(name, label, values) {
  const choices = Object.entries(values).map(([key, text]) => '<option value="'+key+'">'+text+'</option>').join('');
  return '<label>'+label+'<select name="'+name+'" required><option value="">Escolha</option>'+choices+'</select></label>';
}

function normalFields() {
  return '<fieldset class="contact-fields"><legend>Complete o seu pedido</legend><div class="field-grid">'+
    '<label>Código postal da limpeza<input type="text" name="postalCode" autocomplete="postal-code" inputmode="numeric" maxlength="8" placeholder="1234-567" required></label>'+
    (homeTypes.includes(request.space) ? '' : normalSelect('spaceSize','Dimensão do espaço',normalSizes))+
    normalSelect('timing','Quando pretende começar?',normalTiming)+
    '<label hidden>Em que data?<input type="date" name="preferredDate"></label></div>'+
    '<label>Observações (opcional)<textarea name="notes" rows="3" maxlength="500" placeholder="Por exemplo, animais em casa ou superfícies delicadas"></textarea></label></fieldset>';
}

function bindNormalFields(form) {
  const fields = form.elements;
  for (const key of ['postalCode','spaceSize','timing','preferredDate','notes']) {
    if (!fields[key]) continue;
    fields[key].value = request[key] || '';
    fields[key].addEventListener('input', () => { request[key] = fields[key].value; });
  }
  function updateDate() {
    const specific = fields.timing.value === 'specific_date';
    fields.preferredDate.closest('label').hidden = !specific;
    fields.preferredDate.disabled = !specific;
    fields.preferredDate.required = specific;
  }
  function validatePostal() {
    const digits = fields.postalCode.value.replace(/\D/g,'').slice(0,7);
    const cp = digits.length > 4 ? digits.slice(0,4)+'-'+digits.slice(4) : digits;
    fields.postalCode.value = request.postalCode = cp;
    const zone = normalPostalZone(cp);
    fields.postalCode.setCustomValidity(!cp ? '' : zone === request.zone ? '' :
      'Indique um código postal válido do concelho de '+request.zone+'.');
  }
  fields.postalCode.addEventListener('input', validatePostal);
  fields.timing.addEventListener('change', updateDate);
  updateDate();
  validatePostal();
}

function normalRequestData() {
  return {
    serviceType:'regular', serviceTypes:['regular'], spaceType:normalSpaces[request.space],
    spaceSize:homeTypes.includes(request.space) ? Object.keys(normalSizes).find(key=>normalSizes[key]===request.size) : request.spaceSize,
    postalCode:request.postalCode, serviceFrequency:request.frequency === 'Semanal' ? 'weekly' : 'fortnightly',
    oneTimeTiming:request.timing, preferredDate:request.timing === 'specific_date' ? request.preferredDate : '',
    preferredWeekdays:request.days.length ? request.days.map(day=>normalWeekdays[weekdays.indexOf(day)]) : ['flexible'],
    preferredTimePeriods:request.periods.length ? request.periods.map(period=>period==='Manhã'?'morning':'afternoon') : ['flexible'],
    name:request.contactName, phone:request.phone, email:request.email,
    contactPreferences:request.channels.map(channel=>normalChannels[channel]), additionalNotes:request.notes||'',
    consent1:request.consents.partnerSharing, consent2:request.consents.marketing, requestConfirmed:confirmed
  };
}
