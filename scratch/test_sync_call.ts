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

const apiKey = process.env.YOUTUBE_API_KEY;
console.log("YouTube API Key found:", apiKey ? "YES (starts with " + apiKey.substring(0, 5) + "...)" : "NO");

const testVideoId = "PjEL2X70zrs"; // From the db entry query

async function testFetch() {
  if (!apiKey) {
    console.error("No API key, skipping fetch");
    return;
  }
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: testVideoId,
    key: apiKey,
  });
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`;
  console.log("Fetching URL:", apiUrl.replace(apiKey, "API_KEY_HIDDEN"));

  try {
    const res = await fetch(apiUrl);
    console.log("HTTP Status:", res.status);
    console.log("HTTP OK:", res.ok);

    const json = await res.json() as any;
    console.log("JSON response keys:", Object.keys(json));
    
    if (json.error) {
      console.error("API Returned Error:", JSON.stringify(json.error, null, 2));
    } else {
      console.log("Items count:", json.items?.length);
      if (json.items && json.items.length > 0) {
        console.log("Item 0 snippet title:", json.items[0].snippet?.title);
        console.log("Item 0 statistics:", json.items[0].statistics);
        console.log("Item 0 contentDetails duration:", json.items[0].contentDetails?.duration);
      }
    }
  } catch (err) {
    console.error("Fetch failed with error:", err);
  }
}

testFetch().catch(console.error);
