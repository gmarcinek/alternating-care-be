import { FastifyInstance } from "fastify";
import { z } from "zod";
import { groupsDb, provisionGroupDb } from "../../db/tenants.js";

const CreateGroup = z.object({ name: z.string().min(1) });

export async function groupsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.auth);

  app.post("/groups", async (req, rep) => {
    const { name } = CreateGroup.parse(req.body);
    const user = (req as any).user;
    const db = await groupsDb();

    const group: any = {
      type: "group",
      name,
      ownerId: user.sub,
      members: [{ userId: user.sub, role: "admin" }],
      createdAt: new Date().toISOString(),
    };
    const res = await db.insert(group);
    const id = (res as any).id;
    await provisionGroupDb(id);
    return rep.send({ id, ...group });
  });

  app.get("/groups/mine", async (req, rep) => {
    const user = (req as any).user;
    const db = await groupsDb();
    const result = await db.find({
      selector: {
        type: "group",
        "members.userId": user.sub,
      },
      limit: 1000,
    } as any);
    const groups = (result as any).docs.map((d: any) => ({
      id: d._id,
      name: d.name,
      ownerId: d.ownerId,
      members: d.members,
      createdAt: d.createdAt,
    }));
    return rep.send(groups);
  });

  app.post("/groups/:groupId/members", async (req, rep) => {
    const { groupId } = req.params as any;
    const user = (req as any).user;

    const db = await groupsDb();
    const doc: any = await db.get(groupId);

    const me = doc.members.find((m: any) => m.userId === user.sub);
    if (!me || me.role !== "admin") {
      return rep.code(403).send({ error: { code: "FORBIDDEN" } });
    }

    const body = (req.body ?? {}) as any;
    if (!body.userId || !["admin", "member", "viewer"].includes(body.role)) {
      return rep.code(400).send({ error: { code: "BAD_BODY" } });
    }

    const idx = doc.members.findIndex((m: any) => m.userId === body.userId);
    if (idx >= 0) doc.members[idx].role = body.role;
    else doc.members.push({ userId: body.userId, role: body.role });

    const res = await db.insert(doc);
    return rep.send({ id: doc._id, ...doc, _rev: res.rev });
  });
}
