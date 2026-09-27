import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function deliveryFixture(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/partner-email/0001_delivery.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/partner-email/0002_provider_cooldown.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migrations/partner-email/0003_message_archive.sql',import.meta.url),'utf8'));
 const binding={prepare(sql){let args=[];return{bind(...v){args=v;return this;},async all(){return {results:db.prepare(sql).all(...args)};},async first(){return db.prepare(sql).get(...args)||null;},async run(){return db.prepare(sql).run(...args);}};}};
 return {db,binding};
}
