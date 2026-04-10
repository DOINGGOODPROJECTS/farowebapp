export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
