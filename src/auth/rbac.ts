// src/auth/rbac.ts
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { groupsDb } from "../db/tenants.js";

export function requireRole(
  groupParam: string,
  allowed: Array<"viewer" | "member" | "admin">
): preHandlerHookHandler {
  return async (req: FastifyRequest, rep: FastifyReply) => {
    // 1) autoryzacja (JWT zweryfikowany wcześniej przez app.auth)
    const user = (req as any).user as {
      sub: string;
      rolesByGroup?: Record<string, "viewer" | "member" | "admin">;
    };
    if (!user) return rep.code(401).send({ error: { code: "UNAUTHORIZED" } });

    const groupId = (req.params as any)[groupParam];

    // 2) najpierw spróbuj z JWT (jeśli kiedyś dodasz refresh tokena)
    const fromJwt = user.rolesByGroup?.[groupId];
    if (fromJwt && allowed.includes(fromJwt)) return;

    // 3) sprawdź membership w DB `groups` (źródło prawdy na MVP)
    try {
      const db = await groupsDb();
      const doc: any = await db.get(groupId);
      const me = (doc?.members ?? []).find((m: any) => m.userId === user.sub);
      if (me && allowed.includes(me.role)) return;
    } catch (e) {
      // jeśli brak grupy → 404 zamiast 403 (opcjonalnie)
      return rep.code(404).send({ error: { code: "GROUP_NOT_FOUND" } });
    }

    return rep.code(403).send({ error: { code: "FORBIDDEN" } });
  };
}
