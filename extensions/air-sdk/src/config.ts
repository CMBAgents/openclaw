// Config is resolved by the Python air SDK via AIR_API_KEY and AIR_BASE_URL
// environment variables. This file is kept as a placeholder for future
// TypeScript-side config needs (e.g. gating tool registration).

export function isAirConfigured(): boolean {
  return typeof process.env.AIR_API_KEY === "string" && process.env.AIR_API_KEY.length > 0;
}
