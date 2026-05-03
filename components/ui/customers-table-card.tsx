"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const MESCHAC_AVATAR = "https://avatars.githubusercontent.com/u/47919550?v=4";
const BERNARD_AVATAR = "https://avatars.githubusercontent.com/u/31113941?v=4";
const THEO_AVATAR = "https://avatars.githubusercontent.com/u/68236786?v=4";
const GLODIE_AVATAR = "https://avatars.githubusercontent.com/u/99137927?v=4";

export type Customer = {
  id: number | string;
  date: string;
  status: "Paid" | "Cancelled" | "Ref";
  statusVariant: "success" | "danger" | "warning";
  name: string;
  avatar: string;
  revenue: string;
};

export type CustomersTableCardProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  customers?: Customer[];
};

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: 1,
    date: "10/31/2023",
    status: "Paid",
    statusVariant: "success",
    name: "Bernard Ng",
    avatar: BERNARD_AVATAR,
    revenue: "$43.99",
  },
  {
    id: 2,
    date: "10/21/2023",
    status: "Ref",
    statusVariant: "warning",
    name: "Méschac Irung",
    avatar: MESCHAC_AVATAR,
    revenue: "$19.99",
  },
  {
    id: 3,
    date: "10/15/2023",
    status: "Paid",
    statusVariant: "success",
    name: "Glodie Ng",
    avatar: GLODIE_AVATAR,
    revenue: "$99.99",
  },
  {
    id: 4,
    date: "10/12/2023",
    status: "Cancelled",
    statusVariant: "danger",
    name: "Theo Ng",
    avatar: THEO_AVATAR,
    revenue: "$19.99",
  },
];

function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant: "success" | "danger" | "warning";
}) {
  const styles =
    variant === "success"
      ? "bg-lime-500/15 text-lime-800 dark:text-lime-300"
      : variant === "danger"
        ? "bg-red-500/15 text-red-800 dark:text-red-300"
        : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300";

  return (
    <span className={cn("rounded-full px-2 py-1 text-xs font-medium", styles)}>
      {children}
    </span>
  );
}

export default function CustomersTableCard({
  title = "Customers",
  subtitle = "New users by First user primary channel group (Default Channel Group)",
  customers = DEFAULT_CUSTOMERS,
  className,
}: CustomersTableCardProps) {
  return (
    <section
      className={cn(
        "bg-background relative w-full overflow-hidden rounded-2xl border border-border/60 shadow-md ring-1 ring-border/40",
        className
      )}
      aria-label={title}
    >
      <div className="space-y-1 border-b border-border/60 p-4 sm:p-6">
        <div className="flex items-center gap-1.5">
          <span className="bg-muted size-2 rounded-full border border-black/5" />
          <span className="bg-muted size-2 rounded-full border border-black/5" />
          <span className="bg-muted size-2 rounded-full border border-black/5" />
        </div>
        <h2 className="text-base font-semibold leading-none tracking-tight sm:text-lg">{title}</h2>
        <p className="text-muted-foreground text-xs sm:text-sm">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-muted/50 supports-[backdrop-filter]:backdrop-blur-sm sticky top-0 z-10">
            <tr className="text-muted-foreground *:px-3 *:py-3 *:text-start *:font-medium">
              <th className="w-12">#</th>
              <th className="min-w-[120px]">Date</th>
              <th className="min-w-[120px]">Status</th>
              <th className="min-w-[220px]">Customer</th>
              <th className="min-w-[120px] pe-4 text-end">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer, idx) => (
              <tr
                key={customer.id}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30 *:px-3 *:py-2"
              >
                <td className="text-muted-foreground">{idx + 1}</td>
                <td className="whitespace-nowrap">{customer.date}</td>
                <td>
                  <Badge variant={customer.statusVariant}>{customer.status}</Badge>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="size-7 overflow-hidden rounded-full ring-1 ring-border/60">
                      <img
                        src={customer.avatar}
                        alt={customer.name}
                        width={28}
                        height={28}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    </div>
                    <span className="text-foreground truncate font-medium">{customer.name}</span>
                  </div>
                </td>
                <td className="pe-4 text-end font-medium tabular-nums">{customer.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-muted-foreground flex items-center justify-between border-t border-border/60 p-3 text-xs sm:p-4">
        <span>
          Showing <strong>{customers.length}</strong> {customers.length === 1 ? "row" : "rows"}
        </span>
        <span>Updated just now</span>
      </div>
    </section>
  );
}
