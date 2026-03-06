"use client";

import * as React from "react";

export type ReportsCurrency = "SAR" | "EGP";

type ContextValue = {
  currency: ReportsCurrency;
  setCurrency: (c: ReportsCurrency) => void;
  rate: number;
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
  const formatAmount = React.useCallback(
    (amount: number) => {
      const converted = amount * convertedRate;
      const symbol = currency === "EGP" ? "ج.م" : "ر.س";
      return `${converted.toLocaleString("ar-SA", { maximumFractionDigits: 0 })} ${symbol}`;
    },
    [currency, convertedRate]
  );
  const value: ContextValue = {
    currency,
    setCurrency,
    rate,
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
