export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { warmupHermes } = await import('./lib/gemini');
    // fire-and-forget — don't block server startup
    warmupHermes().catch(() => {});
  }
}
