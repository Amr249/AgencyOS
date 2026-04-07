export const PROFIT_LOSS_PERIODS = [
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "all_time",
] as const;

export type ProfitLossPeriodKey = (typeof PROFIT_LOSS_PERIODS)[number];

/** Alias for UI / actions that use the name `ProfitLossPeriod`. */
export type ProfitLossPeriod = ProfitLossPeriodKey;
