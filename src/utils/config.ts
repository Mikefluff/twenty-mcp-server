/**
 * Configuration Management
 * Handles environment variables and configuration
 */

import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const configSchema = z.object({
  TWENTY_API_URL: z.string().url(),
  TWENTY_API_KEY: z.string().min(1),
  MCP_SERVER_PORT: z.coerce.number().default(3002),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CACHE_ENABLED: z.coerce.boolean().default(true),
  CACHE_TTL_SECONDS: z.coerce.number().default(300),
  MAX_CONCURRENT_REQUESTS: z.coerce.number().default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().default(10000),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse(process.env);
