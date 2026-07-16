/**
 * Convert any thrown error (Supabase PostgrestError, network error, or plain Error)
 * into a concise, user-friendly string suitable for display in a toast or UI element.
 *
 * Technical details are preserved in `console.error` calls at the call site.
 */

interface PostgrestError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/** Map Supabase / Postgres error codes to human-readable messages. */
const PGRST_MESSAGES: Record<string, string> = {
  // PostgREST
  PGRST116: "No matching record was found.",
  PGRST204: "The requested resource has no content.",
  PGRST301: "You don't have permission to perform this action.",
  PGRST302: "Access denied. Please sign in again.",
  // Postgres
  "23505": "This item already exists. Please check for duplicates.",
  "23503": "This action references a record that doesn't exist.",
  "23502": "A required field is missing.",
  "42501": "You don't have permission to perform this action.",
  "42703": "An internal data error occurred. Please try again.",
  "22P02": "Invalid data format. Please check your input.",
  "P0001": "A validation rule prevented this action.",
};

const NETWORK_PATTERNS: Array<[RegExp, string]> = [
  [/fetch/i, "A network error occurred. Please check your connection and try again."],
  [/timeout/i, "The request timed out. Please try again."],
  [/unauthorized|401/i, "Your session has expired. Please sign in again."],
  [/forbidden|403/i, "You don't have permission to perform this action."],
  [/not found|404/i, "The requested resource was not found."],
  [/duplicate|already exists/i, "This item already exists. Please check for duplicates."],
  [/unique constraint/i, "This URL has already been added to your workspace."],
  [/violates.*constraint/i, "This action conflicts with existing data."],
];

export function friendlyError(err: unknown): string {
  if (!err) return "An unexpected error occurred. Please try again.";

  // Plain string
  if (typeof err === "string") return err || "An unexpected error occurred.";

  const e = err as PostgrestError & { message?: string };

  // Check Supabase/Postgres code first
  if (e.code && PGRST_MESSAGES[e.code]) {
    return PGRST_MESSAGES[e.code];
  }

  const raw = e.message ?? e.details ?? "";

  // Check network / message patterns
  for (const [pattern, message] of NETWORK_PATTERNS) {
    if (pattern.test(raw)) return message;
  }

  // If message is short enough and doesn't look like a stack trace, show it
  if (raw && raw.length < 200 && !raw.includes("at ")) {
    return raw;
  }

  return "An unexpected error occurred. Please try again.";
}

/** Duplicate URL error message for consistent use in Add Content / Edit Content. */
export const ERR_DUPLICATE_URL =
  "This URL has already been added to your workspace.";

/** Generic save error. */
export const ERR_SAVE = "We couldn't save your content. Please try again.";

/** Generic delete error. */
export const ERR_DELETE = "We couldn't delete this item. Please try again.";

/** Generic sync error. */
export const ERR_SYNC = "Analytics sync failed. Please try again later.";
