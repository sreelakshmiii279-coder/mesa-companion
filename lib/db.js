import { neon } from '@neondatabase/serverless';

let client;
export function sql(strings, ...values) {
  client ??= neon(process.env.DATABASE_URL);
  return client(strings, ...values);
}

export async function getMeta(key) {
  const rows = await sql`SELECT value FROM meta WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setMeta(key, value) {
  await sql`INSERT INTO meta (key, value) VALUES (${key}, ${value})
            ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}
