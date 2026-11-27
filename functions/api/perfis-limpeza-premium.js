const retired=()=>Response.json({ok:false,profiles:[],redirect:'/servicos-limpeza/#pedido',mensagem:'Continue no formulário de limpeza.'},{status:410,headers:{'Cache-Control':'no-store'}});
export const onRequestGet=retired;
export const onRequestPost=retired;
