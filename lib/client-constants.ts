/**
 * Client-related literals shared by UI and DB schema.
 * Kept separate from `lib/db/schema` so client bundles do not import Drizzle.
 */

/** Stored on `clients.source` — UI labels in lib/client-metadata.ts */
export const CLIENT_SOURCE_VALUES = [
  "referral",
  "website",
  "proposal",
  "social_media",
  "cold_outreach",
  "other",
] as const;
export type ClientSourceValue = (typeof CLIENT_SOURCE_VALUES)[number];

/** Tag accent colors for `client_tags.color` */
export const CLIENT_TAG_COLOR_VALUES = [
  "blue",
  "green",
  "red",
  "purple",
  "orange",
  "gray",
] as const;
export type ClientTagColorValue = (typeof CLIENT_TAG_COLOR_VALUES)[number];
