import { FastifyInstance } from "fastify";
import { nano } from "../../db/couchAdmin.js";
import { z } from "zod";
import { env } from "../../config/env.js"; // <-- dodaj ten import

const Register = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).default("User"),
});
const Login = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function usersRoutes(app: FastifyInstance) {
  // register → CouchDB _users
  app.post("/auth/register", async (req, rep) => {
    const { email, password, name } = Register.parse(req.body);
    const _id = `org.couchdb.user:${email}`;
    const users = nano.use("_users");
    try {
      await users.insert({
        _id,
        type: "user",
        name: email,
        roles: [],
        password,
        email,
        profile: { name, createdAt: new Date().toISOString() },
      } as any);
    } catch (e: any) {
      if (e?.statusCode === 409) {
        return rep.code(409).send({ error: { code: "USER_EXISTS" } });
      }
      throw e;
    }

    const token = app.jwt.sign({
      sub: _id,
      email,
      rolesByGroup: {},
    });

    return rep.send({
      user: { id: _id, email, name, rolesByGroup: {} },
      token,
    });
  });

  // login → verify via _users/_session
  app.post("/auth/login", async (req, rep) => {
    const { email, password } = Login.parse(req.body);

    try {
      const res = await fetch(`${env.COUCHDB_URL}/_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: email, password }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return rep.code(401).send({ error: { code: "BAD_CREDENTIALS", body } });
      }
    } catch (e) {
      return rep.code(500).send({ error: { code: "COUCH_UNREACHABLE" } });
    }

    const _id = `org.couchdb.user:${email}`;
    const users = nano.use("_users");
    let name = email;
    try {
      const doc: any = await users.get(_id);
      name = doc?.profile?.name ?? email;
    } catch {}

    const token = req.server.jwt.sign({
      sub: _id,
      email,
      rolesByGroup: {},
    });

    return rep.send({
      user: { id: _id, email, name, rolesByGroup: {} },
      token,
    });
  });
}
