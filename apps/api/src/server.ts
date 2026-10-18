import { buildApp } from './app';
import { loadConfig } from './config';
import { pgDb, pgliteDb } from './db';
import { migrate } from './db/migrations';
import { configureOutboundProxy } from './net';
import { startNewsScheduler } from './news/ingest';

const config = loadConfig();
const proxied = configureOutboundProxy();
const db = config.DATABASE_URL ? pgDb(config.DATABASE_URL) : await pgliteDb(config.PGLITE_DIR);
const applied = await migrate(db);
const app = await buildApp({ config, db });
if (applied.length) app.log.info({ applied }, 'migrations applied');
if (proxied) app.log.info('Outbound requests use the HTTPS_PROXY / HTTP_PROXY settings');
if (!config.DATABASE_URL) app.log.warn(`Using embedded PGlite at ${config.PGLITE_DIR} (development only)`);

const stopNews = config.NEWS_INGESTION === 'on' && config.NODE_ENV !== 'test' ? startNewsScheduler(db, app.log) : () => {};

const shutdown = async () => {
  stopNews();
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: config.HOST });
