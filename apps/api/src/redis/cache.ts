import Redis from "ioredis";
import { env } from "../config/env";

const enabled = Boolean(env.REDIS_URL);
let client: Redis | null = null;
let disabledUntil = 0;

function markUnavailable(reason: unknown) {
  disabledUntil = Date.now() + 60_000; // desabilita por 1 min apos falha
  console.error("[redis] desabilitado temporariamente:", (reason as Error)?.message ?? reason);
}

function getClient(): Redis | null {
  if (!enabled) return null;
  if (Date.now() < disabledUntil) return null;
  if (!client) {
    client = new Redis(env.REDIS_URL!, {
      lazyConnect: true,
      connectTimeout: 800,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => Math.min(1000 * times, 5000),
    });
    client.on("error", (err: unknown) => {
      markUnavailable(err);
    });
    client.connect().catch((err: unknown) => {
      markUnavailable(err);
    });
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const cli = getClient();
  if (!cli) return null;
  try {
    const raw = await cli.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    markUnavailable(err);
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const cli = getClient();
  if (!cli) return;
  try {
    await cli.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    markUnavailable(err);
  }
}

export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const cli = getClient();
  if (!cli) return;
  const pattern = `${prefix}*`;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await cli.scan(cursor, "MATCH", pattern, "COUNT", 50);
      cursor = next;
      if (keys.length) {
        await cli.unlink(keys);
      }
    } while (cursor !== "0");
  } catch (err) {
    markUnavailable(err);
  }
}

export function redisAvailable() {
  return enabled && Date.now() >= disabledUntil;
}
