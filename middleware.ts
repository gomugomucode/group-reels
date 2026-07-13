import { createClient as createSupabaseClient } from "./utils/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Refresh Supabase session via middleware helper
  const response = createSupabaseClient(request);
  return response;
}
