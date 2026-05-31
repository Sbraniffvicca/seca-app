import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.CHAT_SERVICE_PORT || process.env.PORT || 3002),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'chat_app_user',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'chat',
  },
  jwt: {
    publicKeyPath: process.env.JWT_PUBLIC_KEY || './pubkey/public.key',
  },
  weaviate: {
    url: process.env.WEAVIATE_URL || 'http://localhost:8080',
  },
  llm: {
    localUrl: process.env.LOCAL_LLM_URL || 'http://localhost:8082/v1/chat/completions',
    openAiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    openAiRegularModel: process.env.OPENAI_REGULAR_MODEL || 'gpt-5.4',
    openRouterReferer: process.env.OPENROUTER_REFERER || 'http://localhost:3000',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro-exp-03-25',
  },
  seca: {
    canonicalSessionId: Number(process.env.SECA_CANONICAL_SESSION_ID || 0),
  },
};
