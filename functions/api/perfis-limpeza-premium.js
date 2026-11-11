export async function onRequestGet({request,env}){
  const headers={'Cache-Control':'no-store'};
  try {
    const endpoint=new URL('/api/premium',env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev');
    const params=new URL(request.url).searchParams;
    endpoint.searchParams.set('zone',params.get('zone')||'');
    if(params.get('plans')==='1')endpoint.searchParams.set('plans','1');
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

export async function onRequestPost({request,env}){
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  try{
    const {key}=await request.json();
    if(typeof key!=='string'||!/^[a-f0-9-]{36}$/.test(key))return Response.json({ok:false},{status:400,headers});
    const endpoint=new URL('/api/premium',env.CLEANING_DASHBOARD_API_URL||'https://guia-do-proprietario-parceiros.pages.dev');
    const result=await fetch(endpoint,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
      headers:{Authorization:'Bearer '+env.CLEANING_DASHBOARD_API_TOKEN,'Content-Type':'application/json'},
      body:JSON.stringify({action:'resume',key})});
    if(!result.ok)return Response.json({ok:false},{status:result.status===404?404:503,headers});
    return Response.json(await result.json(),{headers});
  }catch{return Response.json({ok:false},{status:503,headers});}
}
