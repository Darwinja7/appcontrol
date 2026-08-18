import { getEnv } from "@/lib/env";
import type { StorageAdapter } from "./types";
import { googleSheetsStorage } from "./google-sheets";

export function getStorageAdapter(): StorageAdapter {
  const provider = getEnv("STORAGE_PROVIDER", "google_sheets");

  if (provider === "google_sheets") {
    return googleSheetsStorage;
  }

  throw new Error(`UNSUPPORTED_STORAGE_PROVIDER_${provider}`);
}
