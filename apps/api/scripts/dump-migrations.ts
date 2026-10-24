/** Writes the SQL migrations as JSON (used to apply them through the Supabase dashboard/MCP if needed). */
import { writeFileSync } from 'node:fs';
import { MIGRATIONS } from '../src/db/migrations';
writeFileSync(process.argv[2] ?? 'migrations.json', JSON.stringify(MIGRATIONS));
console.log(MIGRATIONS.map((m) => `${m.id} (${m.sql.length} chars)`).join('\n'));
