import { AuthForm } from "@/components/gentle/auth-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Gentle Productivity</h1>
        <p className="mt-1 text-sm text-muted-foreground">Бережний таск-менеджер</p>
      </div>
      <AuthForm />
    </main>
  );
}
