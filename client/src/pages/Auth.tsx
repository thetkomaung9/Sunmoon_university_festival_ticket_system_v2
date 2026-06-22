import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export function SignInPage() {
  return <AuthForm />;
}

export function SignUpPage() {
  return <AuthForm />;
}

function AuthForm() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const pending = login.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await login.mutateAsync({ email: email.trim(), password });
      toast.success("Signed in.");
      const user = await utils.auth.me.fetch();
      navigate(user?.role === "admin" ? "/admin" : "/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Authentication failed"
      );
    }
  }

  return (
    <SiteLayout>
      <div className="container py-14 max-w-md">
        <div className="rounded-lg border border-border bg-card p-6 shadow-[0_2px_24px_-12px_rgba(11,43,92,0.18)]">
          <div className="h-12 w-12 rounded-md bg-[var(--sunmoon-navy)] text-white flex items-center justify-center">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
            Admin sign in
          </h1>
          <p className="font-mm text-sm text-foreground/60 mt-1">
            အက်ဒမင် အကောင့်ဝင်ရန်
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label
                htmlFor="email"
                className="text-xs uppercase tracking-wider"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label
                htmlFor="password"
                className="text-xs uppercase tracking-wider"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
                minLength={1}
                autoComplete="current-password"
                className="mt-1.5"
              />
            </div>

            <Button
              type="submit"
              disabled={pending}
              className="w-full h-11 bg-[var(--sunmoon-navy)] hover:bg-[var(--sunmoon-navy-deep)]"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-4 text-sm text-foreground/60">
            Buyer checkout does not require an account. Use ticket lookup with
            the email entered during purchase.
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
