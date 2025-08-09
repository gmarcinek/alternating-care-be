import { env } from "../config/env.js";

export async function waitForCouch({
  tries = 30,
  delayMs = 1000,
}: { tries?: number; delayMs?: number } = {}) {
  const url = new URL("/_up", env.COUCHDB_URL).toString();

  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `CouchDB not ready after ${tries} tries (${delayMs}ms) at ${url}`
  );
}
