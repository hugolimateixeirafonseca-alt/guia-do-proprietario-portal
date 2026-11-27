const target=new URL('/servicos-limpeza/',location.origin);target.search=location.search;target.hash='pedido';location.replace(target.href);
