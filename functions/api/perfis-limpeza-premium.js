export async function onRequestGet({request,env}){
 const endpoint=new URL('/api/premium',env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev');
 endpoint.searchParams.set('zone',new URL(request.url).searchParams.get('zone')||'');
 const upstream=await fetch(endpoint,{headers:{Authorization:'Bearer '+env.CLEANING_DASHBOARD_API_TOKEN},redirect:'error'});
 if(!upstream.ok)return Response.json({ok:false},{status:503});
 return new Response(upstream.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
}
