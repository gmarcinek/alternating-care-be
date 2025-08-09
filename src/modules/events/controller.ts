// src/modules/events/controller.ts
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { nano } from "../../db/couchAdmin.js";
import { tenantDbName } from "../../db/tenants.js";
import { customAlphabet } from "nanoid";
import { requireRole } from "../../auth/rbac.js";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 16);

const CreateEvent = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string(),
  payload: z.record(z.any()).optional(),
});

export async function eventsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.auth);

  app.get(
    "/groups/:groupId/events",
    { preHandler: requireRole("groupId", ["viewer", "member", "admin"]) },
    async (req, rep) => {
      const { groupId } = req.params as any;
      const { from, to, limit = "1000", skip = "0" } = req.query as any;
      const db = nano.use(tenantDbName(groupId));

      const selector: any = { groupId };
      if (from || to) selector.date = {};
      if (from) selector.date.$gte = from;
      if (to) selector.date.$lte = to;

      const result = await db.find({
        selector,
        limit: Number(limit),
        skip: Number(skip),
        use_index: ["_design/events", "by_date"],
      } as any);

      return rep.send({
        items: (result as any).docs,
        total: (result as any).docs.length,
      });
    }
  );

  app.post(
    "/groups/:groupId/events",
    { preHandler: requireRole("groupId", ["member", "admin"]) },
    async (req, rep) => {
      const { groupId } = req.params as any;
      const body = CreateEvent.parse(req.body);
      const db = nano.use(tenantDbName(groupId));
      const id = nanoid();
      const now = new Date().toISOString();
      const doc: any = {
        _id: id,
        groupId,
        date: body.date,
        type: body.type,
        payload: body.payload ?? {},
        creatorId: (req as any).user.sub,
        createdAt: now,
        updatedAt: now,
      };
      const res = await db.insert(doc);
      return rep.code(201).send({ ...doc, _rev: res.rev });
    }
  );

  app.patch(
    "/groups/:groupId/events/:id",
    { preHandler: requireRole("groupId", ["member", "admin"]) },
    async (req, rep) => {
      const { groupId, id } = req.params as any;
      const body = req.body as any;
      if (!body?._rev) {
        return rep.code(400).send({ error: { code: "REV_REQUIRED" } });
      }

      const db = nano.use(tenantDbName(groupId));
      const current: any = await db.get(id);
      const updated = {
        ...current,
        ...body,
        groupId,
        updatedAt: new Date().toISOString(),
      };

      try {
        const res = await db.insert(updated);
        return rep.send({ ...updated, _rev: res.rev });
      } catch (e: any) {
        if (e?.statusCode === 409) {
          const fresh = await db.get(id);
          return rep
            .code(409)
            .send({ error: { code: "CONFLICT" }, current: fresh });
        }
        throw e;
      }
    }
  );

  app.delete(
    "/groups/:groupId/events/:id",
    { preHandler: requireRole("groupId", ["member", "admin"]) },
    async (req, rep) => {
      const { groupId, id } = req.params as any;
      const { rev } = req.query as any;
      if (!rev) {
        return rep.code(400).send({ error: { code: "REV_REQUIRED" } });
      }
      const db = nano.use(tenantDbName(groupId));
      await db.destroy(id, rev);
      return rep.code(204).send();
    }
  );
}
