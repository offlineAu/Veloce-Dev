// Local PostgreSQL without Docker or a system install (embedded-postgres).
// Usage: npm run db:dev   (keeps running; Ctrl+C to stop). Data lives in .dev-db/
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = new URL("../.dev-db/data", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 54329, persistent: true });
const fresh = !existsSync(dir + "/PG_VERSION");
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("veloce");
console.log("Postgres ready: postgresql://postgres:postgres@localhost:54329/veloce");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
