import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MissingSessionSecretError,
  getSessionSecret,
  validateStartupEnvironment,
} from "./env";

describe("getSessionSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a deterministic development secret when JWT_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("JWT_SECRET", "");

    expect(getSessionSecret()).toBe("sunmoon-dev-secret");
  });

  it("rejects an empty production JWT_SECRET with a clear error", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");

    expect(() => getSessionSecret()).toThrow(
      "JWT_SECRET is required in production and must not be empty."
    );
    expect(() => getSessionSecret()).toThrow(MissingSessionSecretError);
  });

  it("trims and returns the configured JWT_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "  configured-secret  ");

    expect(getSessionSecret()).toBe("configured-secret");
  });

  it("validates production JWT_SECRET during startup", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => validateStartupEnvironment()).toThrow(
      MissingSessionSecretError
    );
    expect(console.error).toHaveBeenCalledWith(
      "[Startup] Missing required JWT_SECRET. Configure a non-empty JWT_SECRET in Railway variables before starting the production server."
    );
  });
});
