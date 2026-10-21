// Retry only an explicit overload rejection. Never replay successful or ambiguous requests.
export async function fetchOpenAI(url, options, {fetchImpl=fetch, wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)), onRetry=()=>{}}={}) {
  for (let attempt=0; ; attempt++) {
    const response=await fetchImpl(url,options);
    const raw=await response.text();
    let error;
    try { error=JSON.parse(raw).error; } catch {}
    if (response.status!==503 || error?.code!=='server_is_overloaded' || attempt>=2) {
      return {res:response,raw};
    }
    const delayMs=5000*(2**attempt);
    onRetry({attempt:attempt+1,status:503,delay_ms:delayMs});
    await wait(delayMs);
  }
}