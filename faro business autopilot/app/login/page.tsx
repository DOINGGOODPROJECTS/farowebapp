import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-xl font-semibold">Faro Autopilot</h1>
        <p className="mt-1 text-sm text-black/60">Sign in to the internal dashboard.</p>
      </div>
      <LoginForm />
    </main>
  );
}
