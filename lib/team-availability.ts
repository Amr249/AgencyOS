export const TEAM_AVAILABILITY_TYPES = ["holiday", "vacation", "sick", "half_day"] as const;

export type TeamAvailabilityType = (typeof TEAM_AVAILABILITY_TYPES)[number];

/** Hours deducted from weekly nominal capacity per entry (weekdays only, applied in workload). */
export function availabilityDeductionHours(type: string): number {
  return type === "half_day" ? 4 : 8;
}

/** True if ISO date string (yyyy-MM-dd) is Mon–Fri in UTC. */
export function isUtcWeekday(isoDate: string): boolean {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  const wd = d.getUTCDay();
  return wd >= 1 && wd <= 5;
}
