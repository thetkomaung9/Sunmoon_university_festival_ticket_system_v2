import type { PoolOptions } from "mysql2/promise";

export type DrizzleKitMysqlCredentials = {
  host: string;
  port?: number;
  user?: string;
  password?: string;
  database: string;
  ssl?: { rejectUnauthorized: boolean };
};

function shouldEnableTls(url: URL) {
  const sslAccept = url.searchParams.get("sslaccept");
  const sslMode = url.searchParams.get("ssl-mode") ?? url.searchParams.get("sslmode");
  const ssl = url.searchParams.get("ssl");
  return (
    sslAccept === "strict" ||
    sslMode === "REQUIRED" ||
    sslMode === "require" ||
    sslMode === "VERIFY_IDENTITY" ||
    sslMode === "verify-full" ||
    ssl === "true" ||
    /\.tidbcloud\.com$/i.test(url.hostname)
  );
}

function parseDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\/+/, "");
  if (!database) {
    throw new Error("DATABASE_URL must include a database name");
  }

  const tls = shouldEnableTls(url);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(database),
    ssl: tls ? { rejectUnauthorized: true } : undefined,
  };
}

export function createMysqlPoolOptions(databaseUrl: string): PoolOptions {
  const parsed = parseDatabaseUrl(databaseUrl);
  return {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    ssl: parsed.ssl,
    waitForConnections: true,
    connectionLimit: 10,
  };
}

export function createDrizzleKitMysqlCredentials(
  databaseUrl: string
): DrizzleKitMysqlCredentials {
  return parseDatabaseUrl(databaseUrl);
}
