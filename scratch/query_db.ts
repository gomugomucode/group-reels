import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Manually parse .env file
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    }
  } catch (err) {
    console.error("Error loading .env file:", err);
  }
}

loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing environment variables!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("--- querying content table ---");
  const { data: content, error: contentErr } = await supabase
    .from("content")
    .select("id, title, url, platform_id, status, external_id, created_at")
    .is("deleted_at", null)
    .limit(10);

  if (contentErr) {
    console.error("Error fetching content:", contentErr);
  } else {
    console.log("Content rows:");
    console.dir(content, { depth: null });
  }

  console.log("\n--- querying content_metrics table ---");
  const { data: metrics, error: metricsErr } = await supabase
    .from("content_metrics")
    .select("*")
    .limit(10);

  if (metricsErr) {
    console.error("Error fetching metrics:", metricsErr);
  } else {
    console.log("Metrics rows:");
    console.dir(metrics, { depth: null });
  }

  console.log("\n--- querying system_logs table ---");
  const { data: logs, error: logsErr } = await supabase
    .from("system_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (logsErr) {
    console.error("Error fetching system_logs:", logsErr);
  } else {
    console.log("Latest system logs:");
    console.dir(logs, { depth: null });
  }
}

main().catch(console.error);
