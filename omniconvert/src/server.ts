import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { registerRoutes } from "./server/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.env.PORT || 3099);
const host = process.env.HOST || "127.0.0.1";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info"
  }
});

const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES || 524_288_000);

await app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  exposedHeaders: ["Content-Disposition"]
});

await app.register(multipart, {
  limits: {
    fileSize: maxUploadBytes,
    files: 1
  }
});

await app.register(fastifyStatic, {
  root: path.join(__dirname, "..", "web"),
  prefix: "/"
});

await registerRoutes(app);

await app.listen({ port, host });

