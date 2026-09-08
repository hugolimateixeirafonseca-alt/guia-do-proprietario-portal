// Importar na landing quando a campanha for ativada. Não faz pedidos nem escreve cookies.
// Continua a ler a escolha do utilizador em cada clique, incluindo depois de uma recusa.
export function trackerLink({offer,trackerOrigin,pageUrl,cookieString,firstSeenAt=Date.now()}) {
 const target=new URL('/go/'+encodeURIComponent(offer),trackerOrigin);
 const page=new URL(pageUrl);
 const fields=['source','utm_source','utm_medium','utm_campaign','utm_content','utm_term','campaign_id','adset_id','ad_id'];
 for(const key of fields){const value=page.searchParams.get(key);if(value)target.searchParams.set(key,value)}
 const cookies=Object.fromEntries(cookieString.split(';').map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1)]}));
 let pref;try{pref=JSON.parse(decodeURIComponent(cookies.gp_cookie_preferences||''))}catch{}
 if(pref?.measurement===true&&pref.version==='2026-09-01-1'&&Number.isFinite(Date.parse(pref.savedAt))){
  target.searchParams.set('measurement_consent','true');target.searchParams.set('consent_version',pref.version);target.searchParams.set('consent_at',String(Math.floor(Date.parse(pref.savedAt)/1000)));
  for(const [key,value] of [['fbclid',page.searchParams.get('fbclid')],['fbc',cookies._fbc],['fbp',cookies._fbp]])if(value)target.searchParams.set(key,value);
  if(page.searchParams.has('fbclid'))target.searchParams.set('fbclid_seen_at',String(firstSeenAt));
 }return target.href;
}
