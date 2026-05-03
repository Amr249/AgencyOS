import type { PlanTier } from "@/lib/plan-limits";

export type FeatureName =
  | "proposals"
  | "scrape_mostaql"
  | "convert_to_client"
  | "advanced_reports"
  | "custom_branding"
  | "services_module"
  | "api_access"
  | "ai_features"
  | "file_storage";

export type FeatureDefinition = {
  name: FeatureName;
  plans: readonly PlanTier[];
  description: string;
};

export const FEATURE_REGISTRY: Record<FeatureName, FeatureDefinition> = {
  proposals: {
    name: "proposals",
    plans: ["internal"],
    description: "Mostaql scraping, proposal tracking, and proposal pipeline.",
  },
  scrape_mostaql: {
    name: "scrape_mostaql",
    plans: ["internal"],
    description: "Server-side Mostaql HTML scrape helper.",
  },
  convert_to_client: {
    name: "convert_to_client",
    plans: ["internal"],
    description: "Convert a won proposal into a client and project.",
  },
  advanced_reports: {
    name: "advanced_reports",
    plans: ["pro", "enterprise", "internal"],
    description: "Advanced financial and operational reports.",
  },
  custom_branding: {
    name: "custom_branding",
    plans: ["pro", "enterprise", "internal"],
    description: "Invoice PDF color and agency branding customization.",
  },
  services_module: {
    name: "services_module",
    plans: ["starter", "pro", "enterprise", "internal"],
    description: "Service catalog and project–service linking.",
  },
  api_access: {
    name: "api_access",
    plans: ["enterprise", "internal"],
    description: "Programmatic API access (future).",
  },
  ai_features: {
    name: "ai_features",
    plans: ["starter", "pro", "enterprise", "internal"],
    description: "AI-assisted features (usage limited by plan tier).",
  },
  file_storage: {
    name: "file_storage",
    plans: ["starter", "pro", "enterprise", "internal"],
    description: "File uploads and drive (storage limited by plan tier).",
  },
};

/** Plan defaults + JSONB `features[feature]` boolean overrides. Safe for client bundles. */
export function evaluateFeatureAccess(
  plan: PlanTier,
  featuresJson: Record<string, unknown> | null | undefined,
  featureName: FeatureName
): boolean {
  const def = FEATURE_REGISTRY[featureName];
  const features = featuresJson ?? {};
  const override = features[featureName];
  if (override === true) return true;
  if (override === false) return false;
  return def.plans.includes(plan);
}
