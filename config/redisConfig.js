// config/redisConfig.js
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

let redisClient;

try {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    console.log("🌐 Using external Redis URL");
    redisClient = createClient({
      url: redisUrl,
      socket: {
        tls: true,
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
      },
    });
  } else {
    console.log("🧱 Using local Redis container");
    const redisHost = process.env.REDIS_HOST || "redis";
    const redisPort = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379;
    const redisPassword = process.env.REDIS_PASSWORD || "root";

    redisClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
        tls: true,
        reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
      },
      password: redisPassword,
    });
  }

  redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));
  redisClient.on("connect", () => console.log("✅ Connected to Redis"));
  redisClient.on("ready", () => console.log("🚀 Redis is ready to use"));
  redisClient.on("end", () => console.log("🧹 Redis connection closed"));

  (async () => {
    try {
      await redisClient.connect();
      console.log("🔐 Authenticated with Redis successfully");
    } catch (err) {
      console.error("❌ Failed to connect/authenticate Redis:", err);
    }
  })();
} catch (err) {
  console.error("🚨 Redis initialization failed:", err);
}

export default redisClient;
