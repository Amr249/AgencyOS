export type WinLossStats = {
  wonCount: number;
  lostCount: number;
  winRate: number;
  topWonReasons: { reason: string; count: number }[];
  topLostReasons: { reason: string; count: number }[];
  monthlyTrend: { monthKey: string; monthLabel: string; won: number; lost: number }[];
};
