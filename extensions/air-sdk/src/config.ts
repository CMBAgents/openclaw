import { normalizeSecretInput } from "../../../src/utils/normalize-secret-input.js";

export function resolveAirApiKey(): string | undefined {
  return normalizeSecretInput(process.env.AIR_API_KEY);
}

export function resolveAirBaseUrl(): string {
  const env = process.env.AIR_BASE_URL;
  if (typeof env === "string" && env.trim()) {
    return env.trim().replace(/\/+$/, "");
  }
  return "http://localhost:8000";
}
