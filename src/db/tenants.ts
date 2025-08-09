import { ensureDb } from "./couchAdmin.js";
import eventsDesign from "./designDocs/events.design.json" with { type: "json" };

const GROUPS_DB = "groups";

export async function groupsDb() {
  return ensureDb(GROUPS_DB);
}

export async function provisionGroupDb(groupId: string) {
  const dbName = tenantDbName(groupId);
  const db = await ensureDb(dbName);

  // put design doc (upsert)
  try {
    const existing = await db.get(eventsDesign._id);
    await db.insert({ ...eventsDesign, _rev: (existing as any)._rev });
  } catch (e: any) {
    if (e?.statusCode === 404) await db.insert(eventsDesign as any);
    else throw e;
  }

  // optional: set security (since we proxy via backend, minimal for MVP)
  return dbName;
}

export function tenantDbName(groupId: string) {
  return `group_${groupId}`;
}
