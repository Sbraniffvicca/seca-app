import * as dotenv from 'dotenv';

dotenv.config();

function boolFromEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export const config = {
  port: Number(process.env.AUTH_SERVICE_PORT || process.env.PORT || 3001),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'chat_app_user',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'chat',
  },
  cookie: {
    domain: process.env.COOKIE_DOMAIN || undefined,
    secure: boolFromEnv(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
    sameSite: (process.env.COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
  },
  jwt: {
    privateKeyPath: process.env.JWT_PRIVATE_KEY || './prvtkey/private.key',
    publicKeyPath: process.env.JWT_PUBLIC_KEY || './pubkey/public.key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  seca: {
    canonicalSessionId: Number(process.env.SECA_CANONICAL_SESSION_ID || 0),
  },
};
