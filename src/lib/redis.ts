// Redis is not used - Supabase is the database
// This is a no-op mock for compatibility

const NoOpRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 1,
  // Add any other methods as needed
};

export default NoOpRedis;

// Cache keys (kept for reference, not used)
export const CACHE_KEYS = {
  parsedFile: (repoId: number, path: string) => `parsed:${repoId}:${path}`,
  symbolList: (repoId: number, path: string) => `symbols:${repoId}:${path}`,
  repoTree: (repoId: number) => `tree:${repoId}`,
} as const;

// Cache TTL (15 minutes)
export const CACHE_TTL = 900;
