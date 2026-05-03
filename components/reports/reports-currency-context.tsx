"use client";

import * as React from "react";
import { useLocale } from "next-intl";

export type ReportsCurrency = "SAR" | "USD";

type ContextValue = {
  currency: ReportsCurrency;
  setCurrency: (c: ReportsCurrency) => void;
  rate: number;
  /** Numeric string only (no currency suffix). Use ReportsMoney for display. */
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
  const appLocale = useLocale();
  const numberLocale = appLocale === "ar" ? "ar-SA" : "en-US";
  const [currency, setCurrency] = React.useState<ReportsCurrency>("SAR");
  const convertedRate = currency === "USD" ? rate : 1;
  const formatNumber = React.useCallback(
    (amount: number) => {
      const converted = amount * convertedRate;
      return converted.toLocaleString(numberLocale, { maximumFractionDigits: 0 });
    },
    [convertedRate, numberLocale]
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
