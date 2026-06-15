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
};

const DEV_SESSION_SECRET = "sunmoon-dev-secret";

export function getSessionSecret(): string {
  const secret = process.env.JWT_SECRET?.trim() || ENV.cookieSecret.trim();

  if (secret.length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is required in production and must not be empty."
    );
  }

  return DEV_SESSION_SECRET;
}
