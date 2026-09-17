import { archiveConfigured, digest, findConsents } from '../lib/consent-archive.mjs';
const json = (body, status=200) => new Response(JSON.stringify(body), {status, headers:{
  'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store, private',
  'X-Robots-Tag':'noindex, nofollow', 'X-Content-Type-Options':'nosniff'}});
export const onRequestPost = async ({request,env}) => {
  const origin=request.headers.get('Origin');
  if(origin && origin !== new URL(request.url).origin) return json({error:'forbidden'},403);
  const secret=env.CONSENT_ARCHIVE_ADMIN_TOKEN;
  if(!archiveConfigured(env) || typeof secret !== 'string' || secret.length < 32) return json({error:'not_configured'},503);
  const token=request.headers.get('Authorization') || '';
  if(token.length > 1024 || await digest(token) !== await digest('Bearer '+secret)) return json({error:'unauthorized'},401);
  if(!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'invalid'},400);
  try {
    const raw=await request.text();
    if(raw.length>2048) return json({error:'invalid'},400);
    const body=JSON.parse(raw);
    const email=typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const after=body?.after ?? 0;
    if(email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !Number.isSafeInteger(after) || after<0) return json({error:'invalid'},400);
    const result=await findConsents(env,email,after);
    return json({...result,exported_at:new Date().toISOString(),scope:'Consentimentos recolhidos após a ativação do arquivo. Não representa todos os dados existentes noutros serviços.'});
  } catch { return json({error:'archive_unavailable'},503); }
};
export const onRequestGet = () => json({error:'method_not_allowed'},405);
