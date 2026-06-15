import { afterEach, describe, expect, it, vi } from "vitest";
import { getSessionSecret } from "./env";

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
  });

  it("trims and returns the configured JWT_SECRET", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "  configured-secret  ");

    expect(getSessionSecret()).toBe("configured-secret");
  });
});
