import {validateFunnel,storeFunnel} from '../lib/cleaning-funnel.mjs';
const response=status=>new Response(null,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function onRequestPost({request,env}) {
 try {
  if(Number(request.headers.get('Content-Length'))>12000)return response(413);
  if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))return response(415);
  const raw=await request.text();if(new TextEncoder().encode(raw).length>12000)return response(413);
  let data;try{data=validateFunnel(JSON.parse(raw),request);}catch{return response(400);}
  if(!env.EMAIL_DELIVERY_DB)return response(503);
  await storeFunnel(env.EMAIL_DELIVERY_DB,data);return response(204);
 } catch {return response(503);}
}
