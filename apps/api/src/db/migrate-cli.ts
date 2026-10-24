import { loadConfig } from '../config';
import { pgDb, pgliteDb } from './index';
import { migrate } from './migrations';

const config = loadConfig();
const db = config.DATABASE_URL ? pgDb(config.DATABASE_URL, { mode: config.DATABASE_SSL ?? 'off', ca: config.DATABASE_CA_CERT }) : await pgliteDb(config.PGLITE_DIR);
const applied = await migrate(db);
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date');
await db.close();
