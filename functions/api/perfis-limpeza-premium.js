export async function onRequestGet({request,env}){
  const headers={'Cache-Control':'no-store'};
  try {
    const endpoint=new URL('/api/premium',env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev');
    endpoint.searchParams.set('zone',new URL(request.url).searchParams.get('zone')||'');
    const response=await fetch(endpoint,{
      headers:{Authorization:'Bearer '+env.CLEANING_DASHBOARD_API_TOKEN},
      redirect:'manual',
      signal:AbortSignal.timeout(10000)
    });
    if(response.ok){
      const data=await response.json();
      if(data.ok && Array.isArray(data.profiles))return Response.json({ok:true,profiles:data.profiles},{headers});
    }
  }catch{
    // Falhas de ligação e respostas inválidas usam a mesma alternativa no formulário.
  }
  return Response.json({ok:false},{status:503,headers});
}
