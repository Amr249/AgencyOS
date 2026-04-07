"use client";

import * as React from "react";

export type ReportsCurrency = "SAR" | "EGP";

type ContextValue = {
  currency: ReportsCurrency;
  setCurrency: (c: ReportsCurrency) => void;
  rate: number;
  /** Numeric string only (no SAR/EGP suffix). Use ReportsMoney for display. */
  formatNumber: (amount: number) => string;
  /** @deprecated Prefer formatNumber + ReportsMoney */
  formatAmount: (amount: number) => string;
  convertedRate: number;
};

const ReportsCurrencyContext = React.createContext<ContextValue | null>(null);

export function ReportsCurrencyProvider({
  rate,
  children,
}: {
  rate: number;
  children: React.ReactNode;
}) {
  const [currency, setCurrency] = React.useState<ReportsCurrency>("SAR");
  const convertedRate = currency === "EGP" ? rate : 1;
  const formatNumber = React.useCallback(
    (amount: number) => {
      const converted = amount * convertedRate;
      return converted.toLocaleString("en-US", { maximumFractionDigits: 0 });
    },
    [convertedRate]
  );
  const formatAmount = React.useCallback(
    (amount: number) => formatNumber(amount),
    [formatNumber]
  );
  const value: ContextValue = {
    currency,
    setCurrency,
    rate,
    formatNumber,
    formatAmount,
    convertedRate,
  };
  return (
    <ReportsCurrencyContext.Provider value={value}>
      {children}
    </ReportsCurrencyContext.Provider>
  );
}

export function useReportsCurrency(): ContextValue {
  const ctx = React.useContext(ReportsCurrencyContext);
  if (!ctx) throw new Error("useReportsCurrency must be used within ReportsCurrencyProvider");
  return ctx;
}
