export const env = {
  PORT: parseInt(process.env.PORT ?? "4000", 10),
  JWT_SECRET: process.env.JWT_SECRET ?? "dev",
  COUCHDB_URL: process.env.COUCHDB_URL ?? "http://127.0.0.1:5984",
  COUCHDB_USER: process.env.COUCHDB_USER ?? "admin",
  COUCHDB_PASSWORD: process.env.COUCHDB_PASSWORD ?? "admin",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*"
};
