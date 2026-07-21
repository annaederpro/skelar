"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthFormState } from "@/app/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: AuthFormState = { error: null, message: null };

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Пароль</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </div>

        {state.error && <p className="text-sm text-coral">{state.error}</p>}
        {state.message && <p className="text-sm text-sea-deep">{state.message}</p>}

        <Button type="submit" disabled={isPending} className="rounded-full">
          {mode === "signin" ? "Увійти" : "Зареєструватися"}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
      >
        {mode === "signin" ? "Немає акаунту? Зареєструватися" : "Вже є акаунт? Увійти"}
      </button>
    </div>
  );
}
