import fp from "fastify-plugin";
import jwtPlugin from "@fastify/jwt";
import { env } from "../config/env.js";

export interface AppJwtPayload {
  sub: string;
  email: string;
  rolesByGroup?: Record<string, "viewer" | "member" | "admin">;
}

export default fp(async (app) => {
  await app.register(jwtPlugin, {
    secret: env.JWT_SECRET,
  });

  app.decorate("auth", async (req) => {
    await req.jwtVerify(); // req.user ma już nasz payload
  });
});

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: AppJwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    auth: (req: FastifyRequest) => Promise<void>;
  }
}
