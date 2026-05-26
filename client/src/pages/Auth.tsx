import SiteLayout from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Lock, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";

export function SignInPage() {
  return <AuthForm mode="signin" />;
}

export function SignUpPage() {
  return <AuthForm mode="signup" />;
}

function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const [, navigate] = useLocation();
  const [, adminParams] = useRoute("/admin/:rest*");
  const utils = trpc.useUtils();
  const login = trpc.auth.login.useMutation();
  const signup = trpc.auth.signup.useMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const isSignup = mode === "signup";
  const pending = login.isPending || signup.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (isSignup) {
        await signup.mutateAsync({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        toast.success("Account created.");
      } else {
        await login.mutateAsync({ email: email.trim(), password });
        toast.success("Signed in.");
      }
      await utils.auth.me.invalidate();
      navigate(adminParams ? "/admin" : "/");
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
            {isSignup ? (
              <UserPlus className="h-5 w-5" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
          <h1 className="mt-4 font-serif text-3xl font-bold text-[var(--sunmoon-navy)]">
            {isSignup ? "Create account" : "Sign in"}
          </h1>
          <p className="font-mm text-sm text-foreground/60 mt-1">
            {isSignup ? "အကောင့်ဖွင့်ရန်" : "အကောင့်ဝင်ရန်"}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div>
                <Label
                  htmlFor="name"
                  className="text-xs uppercase tracking-wider"
                >
                  Full name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  autoComplete="name"
                  className="mt-1.5"
                />
              </div>
            )}
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
                minLength={isSignup ? 8 : 1}
                autoComplete={isSignup ? "new-password" : "current-password"}
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
              ) : isSignup ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-4 text-sm text-foreground/60">
            {isSignup ? "Already have an account?" : "Need an account?"}{" "}
            <Link
              href={isSignup ? "/signin" : "/signup"}
              className="font-semibold text-[var(--sunmoon-blue)] hover:text-[var(--sunmoon-navy)]"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </p>
        </div>
      </div>
    </SiteLayout>
  );
}
