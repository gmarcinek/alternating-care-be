import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "./auth/jwt.js";
import { env } from "./config/env.js";
import { usersRoutes } from "./modules/users/controller.js";
import { groupsRoutes } from "./modules/groups/controller.js";
import { eventsRoutes } from "./modules/events/controller.js";

export function buildApp() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true
  });

  app.register(jwt);

  app.get("/health", async () => ({ ok: true }));

  app.register(usersRoutes);
  app.register(groupsRoutes);
  app.register(eventsRoutes);

  return app;
}
