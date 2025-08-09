import { nano, ensureDb } from "../src/db/couchAdmin.js";
import { env } from "../src/config/env.js";

async function main() {
  const baseUrl = env.COUCHDB_URL; // bez admin:admin@
  const up = await fetch(new URL("/_up", baseUrl)).then((r) => r.ok);
  if (!up) throw new Error("CouchDB not up");

  // Auth header z Basic Auth
  const authHeader =
    "Basic " +
    Buffer.from(`${env.COUCHDB_USER}:${env.COUCHDB_PASSWORD}`).toString(
      "base64"
    );

  // ensure groups db
  await ensureDb("groups");

  // enable CORS
  const baseConfig = `${env.COUCHDB_URL}/_node/_local/_config`;
  const put = (key: string, value: string) =>
    fetch(`${baseConfig}/${key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(value),
    }).then((r) => {
      if (!r.ok) throw new Error(`Failed to set ${key}`);
    });

  await put("httpd/enable_cors", "true");
  await put("cors/origins", env.CORS_ORIGIN);
  await put("cors/credentials", "true");
  await put("cors/methods", "GET, PUT, POST, HEAD, DELETE, PATCH");
  await put("cors/headers", "accept, authorization, content-type, origin");

  console.log("CouchDB initialized.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
