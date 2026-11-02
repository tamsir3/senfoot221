export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureSeeded } = await import("./lib/seed");
    await ensureSeeded();
  }
}
