// Copia só eventos do Kit Janelas. Nunca apaga nem altera a origem.
// Reexecutável: legacy_event_id é único na base de destino.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const wrangler = process.env.KIT_MIGRATION_WRANGLER || path.resolve('node_modules/wrangler/bin/wrangler.js');
const source = 'guia-proprietario-kit-estudante';
const target = 'guia-proprietario-kit-janelas';
const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
if (config.d1_databases.find(db => db.binding === 'KIT_JANELAS_DB')?.database_id !== '32fe7615-5bf4-427a-9ea0-7c4c5546497d') {
  throw new Error('Unexpected migration target');
}
const execute = (database, args) => {
  try {
    const output = execFileSync(process.execPath, [wrangler, 'd1', 'execute', database,
      '--remote', '--config', 'wrangler.jsonc', '--json', ...args], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
    });
    // O importador por ficheiro emite progresso mesmo com --json.
    // O exit code valida a execução; a contagem é relida por query abaixo.
    return args.includes('--file') ? [{success:true}] : JSON.parse(output);
  } catch (error) { throw new Error(`D1 migration command failed for ${database}; type=${error.name}; exit=${error.status ?? 'parse'}; no row data logged`); }
};
const query = (database, sql) => {
  const response = execute(database, ['--command', sql]);
  if (!response.every(item => item.success)) throw new Error('Migration query failed');
  return response.flatMap(item => item.results || []);
};
const boundary = query(source, "SELECT COALESCE(MAX(id),0) AS max_id FROM kit_events WHERE source='kit-trocar-janelas'")[0].max_id;
const columns = ['occurred_at','source','event','field_name','field_value','status','error_code','consent_version','session_hash','request_id','ip_hash'];
const rows = [];
let after = 0;
while (after < boundary) {
  const batch = query(source, `SELECT id,${columns.join(',')} FROM kit_events WHERE source='kit-trocar-janelas' AND id>${after} AND id<=${boundary} ORDER BY id LIMIT 500`);
  if (!batch.length) break;
  rows.push(...batch);
  after = batch.at(-1).id;
}
if (rows.some(row => row.source !== 'kit-trocar-janelas')) throw new Error('Unexpected source in history');
const literal = value => value == null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";
mkdirSync('.wrangler', {recursive:true});
const temp = mkdtempSync(path.resolve('.wrangler/kit-janelas-history-'));
try {
  if (rows.length) {
    const file = path.join(temp,'events.sql');
    writeFileSync(file, rows.map(row => `INSERT OR IGNORE INTO kit_events (legacy_event_id,${columns.join(',')}) VALUES (${row.id},${columns.map(key=>literal(row[key])).join(',')});`).join('\n'));
    const response = execute(target, ['--file', file, '--yes']);
    if (!response.every(item => item.success)) throw new Error('History import failed');
  }
  const imported = query(target, `SELECT COUNT(*) AS total FROM kit_events WHERE legacy_event_id<=${boundary}`)[0].total;
  if (imported !== rows.length) throw new Error('History count mismatch');
  query(target, `UPDATE kit_history_import SET last_legacy_id=MAX(last_legacy_id,${boundary}) WHERE id=1`);
  console.log(JSON.stringify({copiedEvents: rows.length, legacyBoundary: boundary, countVerified: true, sourceUnchanged: true}));
} finally {
  // Apenas o diretório criado por esta execução, dentro da cache deste worktree.
  if (path.dirname(temp) !== path.resolve('.wrangler') || !path.basename(temp).startsWith('kit-janelas-history-')) throw new Error('Unexpected temp directory');
  rmSync(temp,{recursive:true});
}
