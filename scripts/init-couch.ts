import { nano, ensureDb } from "../src/db/couchAdmin.js";
import { env } from "../src/config/env.js";
import groupsDesign from "../src/db/designDocs/groups.design.json" with { type: "json" };

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
  const groupsDb = await ensureDb("groups");

  // Install groups design document
  try {
    const existing = await groupsDb.get(groupsDesign._id);
    await groupsDb.insert({ ...groupsDesign, _rev: (existing as any)._rev });
    console.log("Updated groups design document");
  } catch (e: any) {
    if (e?.statusCode === 404) {
      await groupsDb.insert(groupsDesign as any);
      console.log("Created groups design document");
    } else {
      throw e;
    }
  }

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
