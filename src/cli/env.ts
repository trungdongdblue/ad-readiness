// Side-effect import: loads ./.env (git-ignored) so CRUX_API_KEY need not be exported by hand.
// Missing file, or Node older than 20.12 (no loadEnvFile): skip silently, real env vars still work.
try {
  process.loadEnvFile('.env');
} catch {
  /* no .env */
}
