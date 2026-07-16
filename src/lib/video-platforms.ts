import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type Platform = Database["public"]["Enums"]["platform_type"] | "linkedin";
export type LinkStatus = Database["public"]["Enums"]["link_status"];

export const PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "vimeo",
  "linkedin",
  "other",
];

export const SUPPORTED_PLATFORMS: Platform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "vimeo",
  "linkedin",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  vimeo: "Vimeo",
  linkedin: "LinkedIn",
  other: "Other",
};

// oklch tokens mapped to platform chips for consistent charting/coloring.
export const PLATFORM_COLOR_VAR: Record<Platform, string> = {
  youtube: "var(--color-destructive)",
  tiktok: "var(--color-accent)",
  instagram: "var(--color-chart-4)",
  facebook: "var(--color-chart-2)",
  vimeo: "var(--color-primary)",
  linkedin: "var(--color-chart-5)",
  other: "var(--color-muted-foreground)",
};

import { parseUrl } from "./url-parser";

/** Detect the platform from a URL string. Falls back to "other". */
export function detectPlatform(url: string): Platform {
  return parseUrl(url).platform;
}

/** Basic URL format validation used both client- and server-side. */
export const urlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .max(2048, "URL is too long")
  .url("Enter a valid URL, e.g. https://youtube.com/watch?v=abc");

export function isValidUrl(url: string): boolean {
  return urlSchema.safeParse(url).success;
}

/**
 * Derive a link status from the URL.
 * - invalid: not a well-formed URL
 * - valid: well-formed and matches a known video platform pattern
 * - pending: well-formed but platform could not be confirmed ("other")
 */
export function deriveStatus(url: string): LinkStatus {
  if (!isValidUrl(url)) return "invalid";
  return detectPlatform(url) === "other" ? "pending" : "valid";
}

export const videoLinkSchema = z.object({
  title: z.string().trim().max(120, "Title is too long").optional().or(z.literal("")),
  url: urlSchema,
});

export const socialUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url("Enter a valid URL")
  .optional()
  .or(z.literal(""));

export const groupSchema = z.object({
  team_name: z.string().trim().min(2, "Team name is required").max(80),
  team_leader: z.string().trim().max(80).optional().or(z.literal("")),
  member_names: z.array(z.string().trim().max(80)).max(20),
  instagram: socialUrlSchema,
  tiktok: socialUrlSchema,
  facebook: socialUrlSchema,
  youtube: socialUrlSchema,
  linkedin: socialUrlSchema,
  website: socialUrlSchema,
});

export type GroupFormValues = z.infer<typeof groupSchema>;
