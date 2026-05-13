import "dotenv/config";

import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db, pool } from "./index";

async function ensureDatabase(connectionString: string) {
  const url = new URL(connectionString);
  const dbName = url.pathname.slice(1);

  url.pathname = "/postgres";
  const adminClient = new Client({ connectionString: url.toString() });

  await adminClient.connect();
  try {
    const { rows } = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rows.length === 0) {
      await adminClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    await adminClient.end();
  }
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:5432/saas_barber";

  await ensureDatabase(connectionString);

  console.log("Running migrations from ./src/server/db/migrations ...");
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  console.log("Migrations applied successfully.");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err.message ?? err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
