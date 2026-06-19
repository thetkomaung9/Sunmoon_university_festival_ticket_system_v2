import { describe, expect, it, vi, afterEach } from "vitest";
import type { TrpcContext } from "./context";
import { assertCsrfSafe, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf";

function createContext(input: {
  origin?: string;
  cookieToken?: string;
  headerToken?: string;
}): Pick<TrpcContext, "req"> {
  return {
    req: {
      headers: {
        ...(input.origin ? { origin: input.origin } : {}),
        ...(input.cookieToken
          ? { cookie: `${CSRF_COOKIE_NAME}=${encodeURIComponent(input.cookieToken)}` }
          : {}),
        ...(input.headerToken ? { [CSRF_HEADER_NAME]: input.headerToken } : {}),
      },
    } as TrpcContext["req"],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("csrf protection", () => {
  it("rejects a missing CSRF token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://festival.example.com");

    expect(() =>
      assertCsrfSafe(createContext({ origin: "https://festival.example.com" }))
    ).toThrow("Missing CSRF token.");
  });

  it("rejects an invalid CSRF token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://festival.example.com");

    expect(() =>
      assertCsrfSafe(
        createContext({
          origin: "https://festival.example.com",
          cookieToken: "valid-token",
          headerToken: "wrong-token",
        })
      )
    ).toThrow("Invalid CSRF token.");
  });

  it("rejects an invalid Origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://festival.example.com");

    expect(() =>
      assertCsrfSafe(
        createContext({
          origin: "https://evil.example.com",
          cookieToken: "valid-token",
          headerToken: "valid-token",
        })
      )
    ).toThrow("Invalid request origin.");
  });

  it("accepts a valid token and valid Origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_URL", "https://festival.example.com");

    expect(() =>
      assertCsrfSafe(
        createContext({
          origin: "https://festival.example.com",
          cookieToken: "valid-token",
          headerToken: "valid-token",
        })
      )
    ).not.toThrow();
  });
});
