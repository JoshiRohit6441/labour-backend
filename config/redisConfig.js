import { createClient } from "redis";
import dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

let redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  const redisHost = process.env.REDIS_HOST || "localhost";
  const redisPort = process.env.REDIS_PORT || 6379;
  const redisPassword = process.env.REDIS_PASSWORD;

  redisUrl = redisPassword
    ? `redis://:${redisPassword}@${redisHost}:${redisPort}`
    : `redis://${redisHost}:${redisPort}`;
}

const redisClient = createClient({
  url: redisUrl,
  socket: {
    tls: redisUrl.startsWith("rediss://"),
    rejectUnauthorized: false,
  },
});

redisClient.on("error", (err) => logger.error("Redis error:", err));
redisClient.on("connect", () => logger.info("Redis connected"));
redisClient.on("ready", () => logger.info("Redis ready"));

export const redisReady = redisClient.connect().catch((err) => {
  logger.error("Redis connection failed:", err);
});

export default redisClient;
