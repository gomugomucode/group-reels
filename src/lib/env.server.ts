import fs from "fs";
import path from "path";

let envLoaded = false;

export function loadEnv() {
  if (envLoaded) return;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const match = trimmed.match(/^([^=]+?)\s*=\s*(.*)?$/);
      if (!match) continue;

      const key = match[1].trim().replace(/\s+/g, "_").replace(/[^A-Za-z0-9_.-]/g, "_").toUpperCase();
      const normalizedKey = key === "TIKTPK_CLIENT_SECRET" ? "TIKTOK_CLIENT_SECRET" : key;
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.substring(1, value.length - 1);
      }
      process.env[normalizedKey] = value.trim();
    }
    envLoaded = true;
  } catch (err) {
    console.error("Error loading .env file:", err);
  }
}
