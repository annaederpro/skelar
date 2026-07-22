import { AuthForm } from "@/components/gentle/auth-form";
import { Wordmark } from "@/components/gentle/wordmark";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex flex-col items-center text-center">
        <Wordmark />
        <p className="mt-1 text-sm text-muted-foreground">Лагідний таск-менеджер</p>
      </div>
      <AuthForm />
    </main>
  );
}
