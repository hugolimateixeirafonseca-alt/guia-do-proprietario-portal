import test from 'node:test';
import assert from 'node:assert/strict';
import {clientIpKey} from '../functions/lib/client-ip-key.mjs';
const key='synthetic-secret-for-client-ip-key-local-test';
test('equivalent IPs match, different IPs and secrets do not, raw IP is not returned',async()=>{
 const first=await clientIpKey(key,'192.0.2.10');assert.match(first,/^[a-f0-9]{64}$/);assert.notEqual(first,await clientIpKey(key,'192.0.2.11'));assert.notEqual(first,await clientIpKey(key+'different','192.0.2.10'));
 assert.equal(await clientIpKey(key,'2001:db8::1'),await clientIpKey(key,'2001:0db8:0000:0000:0000:0000:0000:0001'));
 for(const ip of ['',null,'unknown','999.2.3.4','make-ip','2001:invalid'])assert.equal(await clientIpKey(key,ip),null);
 assert.equal(await clientIpKey('', '192.0.2.10'),null);
});
