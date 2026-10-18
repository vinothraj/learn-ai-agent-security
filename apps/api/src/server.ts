import { buildApp } from './app';
import { loadConfig } from './config';
import { pgDb, pgliteDb } from './db';
import { migrate } from './db/migrations';

const config = loadConfig();
const db = config.DATABASE_URL ? pgDb(config.DATABASE_URL) : await pgliteDb(config.PGLITE_DIR);
const applied = await migrate(db);
const app = await buildApp({ config, db });
if (applied.length) app.log.info({ applied }, 'migrations applied');
if (!config.DATABASE_URL) app.log.warn(`Using embedded PGlite at ${config.PGLITE_DIR} (development only)`);

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
