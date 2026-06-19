import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();
const apiBaseUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");
const trpcUrl = apiBaseUrl ? `${apiBaseUrl}/api/trpc` : "/api/trpc";
const csrfUrl = apiBaseUrl ? `${apiBaseUrl}/api/csrf-token` : "/api/csrf-token";
let csrfTokenPromise: Promise<string | null> | null = null;

function getCookie(name: string) {
  const prefix = `${name}=`;
  return (
    document.cookie
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith(prefix))
      ?.slice(prefix.length) ?? null
  );
}

async function getCsrfToken() {
  const existing = getCookie("csrf_token");
  if (existing) return decodeURIComponent(existing);
  csrfTokenPromise ??= fetch(csrfUrl, {
    credentials: "include",
  })
    .then(async response => {
      if (!response.ok) return null;
      const body = (await response.json()) as { token?: string };
      return body.token ?? getCookie("csrf_token");
    })
    .finally(() => {
      csrfTokenPromise = null;
    });
  return csrfTokenPromise;
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = "/signin";
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: trpcUrl,
      transformer: superjson,
      async fetch(input, init) {
        const headers = new Headers(init?.headers);
        const csrfToken = await getCsrfToken();
        if (csrfToken) headers.set("x-csrf-token", csrfToken);
        const response = await globalThis.fetch(input, {
          ...(init ?? {}),
          headers,
          credentials: "include",
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(
            "Backend API is not returning JSON. Set VITE_API_URL to the deployed Express backend URL."
          );
        }
        return response;
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
