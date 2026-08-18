export function getEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`MISSING_ENV_${name}`);
  }
  return value;
}
