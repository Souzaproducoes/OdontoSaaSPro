// =============================================
// CACHE SERVICE — Redis/Upstash (corrigido)
// =============================================
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

let redis;

export async function initCache() {
  const redisUrl = process.env.REDIS_URL;

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 100, 3000),
    enableOfflineQueue: true,   // ← era false, causava falha imediata
    tls: redisUrl?.startsWith('rediss://') ? {} : undefined, // ← TLS para Upstash
    lazyConnect: true,          // ← não conecta no construtor
  });

  redis.on('error', (err) => logger.error('Redis error:', err.message));
  redis.on('connect', () => logger.info('✅ Redis conectado'));

  // Conecta explicitamente e aguarda antes do ping
  await redis.connect();
  await redis.ping();

  return redis;
}

export function getRedis() {
  return redis;
}

export async function cacheGet(key) {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function cacheSet(key, value, ttlSeconds = 3600) {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    logger.warn('Cache set falhou:', err.message);
  }
}

export async function cacheDel(key) {
  try { await redis.del(key); } catch {}
}

// Cache específico para sessões WhatsApp (TTL 30 min)
export async function getSession(phone) {
  return cacheGet(`session:${phone}`);
}

export async function setSession(phone, data) {
  return cacheSet(`session:${phone}`, data, 1800);
}

export async function updateSession(phone, updates) {
  const existing = await getSession(phone) || {};
  return setSession(phone, { ...existing, ...updates, updatedAt: Date.now() });
}

// Cache de configurações do tenant (TTL 1h)
export async function getTenantCache(tenantId) {
  return cacheGet(`tenant:${tenantId}`);
}

export async function setTenantCache(tenantId, data) {
  return cacheSet(`tenant:${tenantId}`, data, 3600);
}
