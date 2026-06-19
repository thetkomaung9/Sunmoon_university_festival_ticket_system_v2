import "dotenv/config";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  frontendUrl: process.env.FRONTEND_URL ?? "",
  corsOrigins: process.env.CORS_ORIGINS ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
};

const DEV_SESSION_SECRET = "sunmoon-dev-secret";
const MISSING_SESSION_SECRET_MESSAGE =
  "JWT_SECRET is required in production and must not be empty.";

export class MissingSessionSecretError extends Error {
  constructor() {
    super(MISSING_SESSION_SECRET_MESSAGE);
    this.name = "MissingSessionSecretError";
  }
}

export function isSessionSecretError(error: unknown): boolean {
  return (
    error instanceof MissingSessionSecretError ||
    (error instanceof Error &&
      (error.message === MISSING_SESSION_SECRET_MESSAGE ||
        error.message.includes("Zero-length key is not supported")))
  );
}

function getConfiguredSessionSecret(): string | null {
  const secret = process.env.JWT_SECRET?.trim() ?? "";
  return secret.length > 0 ? secret : null;
}

export function getSessionSecret(): string {
  const secret = getConfiguredSessionSecret();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new MissingSessionSecretError();
  }

  return DEV_SESSION_SECRET;
}

export function validateStartupEnvironment(): void {
  const configuredSecret = getConfiguredSessionSecret();

  if (process.env.NODE_ENV === "production" && !configuredSecret) {
    console.error(
      "[Startup] Missing required JWT_SECRET. Configure a non-empty JWT_SECRET in Railway variables before starting the production server."
    );
    throw new MissingSessionSecretError();
  }

  if (!configuredSecret) {
    console.warn(
      "[Startup] JWT_SECRET is not configured. Using deterministic development session secret; do not use this in production."
    );
    return;
  }

  console.info("[Startup] JWT_SECRET is configured for session signing.");
}
