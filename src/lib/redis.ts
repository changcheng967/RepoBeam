import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export default redis;

// Cache keys
export const CACHE_KEYS = {
  parsedFile: (repoId: number, path: string) => `parsed:${repoId}:${path}`,
  symbolList: (repoId: number, path: string) => `symbols:${repoId}:${path}`,
  repoTree: (repoId: number) => `tree:${repoId}`,
} as const;

// Cache TTL (15 minutes)
export const CACHE_TTL = 900;
