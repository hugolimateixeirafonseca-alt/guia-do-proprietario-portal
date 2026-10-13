// Use the archived first-party IP, never the Make/proxy address or a browser field.
export async function clientIpKey(secret,value){
 if(typeof secret!=='string'||secret.length<32)return null;
 const ip=String(value||'').trim();let canonical='';
 if(/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)&&ip.split('.').every(n=>Number(n)<=255))canonical=ip.split('.').map(Number).join('.');
 else if(ip.includes(':'))try{canonical=new URL(`http://[${ip}]/`).hostname;}catch{}
 if(!canonical)return null;
 const bytes=new TextEncoder(),key=await crypto.subtle.importKey('raw',bytes.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,bytes.encode('cleaning-client-ip:v1:'+canonical)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
