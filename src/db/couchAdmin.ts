import nanoFactory from "nano";
import { env } from "../config/env.js";

const url = new URL(env.COUCHDB_URL);
if (env.COUCHDB_USER) url.username = env.COUCHDB_USER;
if (env.COUCHDB_PASSWORD) url.password = env.COUCHDB_PASSWORD;

export const nano = nanoFactory(url.toString());

export async function ensureDb(name: string) {
  const list = await nano.db.list();
  if (!list.includes(name)) await nano.db.create(name);
  return nano.db.use(name);
}
