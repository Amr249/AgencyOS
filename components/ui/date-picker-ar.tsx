"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import type { DateRange, Matcher } from "react-day-picker";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerArProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  direction?: "rtl" | "ltr";
  locale?: Locale;
  popoverAlign?: "start" | "center" | "end";
  /** Passed to the underlying Calendar (e.g. `{ after: endDate }` for a start field). */
  calendarDisabled?: Matcher | Matcher[];
}

export function DatePickerAr({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  direction,
  locale: localeProp,
  popoverAlign = "end",
  calendarDisabled,
}: DatePickerArProps) {
  const appLocale = useLocale();
  const isAr = appLocale === "ar";
  const dir = direction ?? (isAr ? "rtl" : "ltr");
  const dateFnsLocale = localeProp ?? (isAr ? arSA : enUS);
  const defaultPlaceholder = isAr ? "اختر تاريخًا" : "Pick a date";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            dir === "rtl" ? "text-right" : "text-left",
            !value && "text-muted-foreground",
            className
          )}
          dir={dir}
        >
          {value ? (
            format(value, "dd MMM yyyy", { locale: dateFnsLocale })
          ) : (
            <span>{placeholder ?? defaultPlaceholder}</span>
          )}
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={popoverAlign} dir={dir}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          defaultMonth={value}
          dir={dir}
          locale={dateFnsLocale}
          disabled={calendarDisabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

interface DateRangePickerArProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  direction?: "rtl" | "ltr";
  locale?: Locale;
  popoverAlign?: "start" | "center" | "end";
  /** Months shown side-by-side in the popover. */
  numberOfMonths?: number;
}

function formatRangeButtonLabel(
  range: DateRange | undefined,
  dateFnsLocale: Locale,
  ellipsisLabel: string
): React.ReactElement | null {
  if (!range?.from) return null;
  const a = format(range.from, "dd MMM yyyy", { locale: dateFnsLocale });
  if (!range.to) {
    return (
      <>
        {a}
        <span className="text-muted-foreground px-0.5">–</span>
        <span className="text-muted-foreground">{ellipsisLabel}</span>
      </>
    );
  }
  const b = format(range.to, "dd MMM yyyy", { locale: dateFnsLocale });
  return (
    <>
      {a}
      <span className="text-muted-foreground px-0.5">–</span>
      {b}
    </>
  );
}

export function DateRangePickerAr({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  direction,
  locale: localeProp,
  popoverAlign = "start",
  numberOfMonths = 2,
}: DateRangePickerArProps) {
  const appLocale = useLocale();
  const isAr = appLocale === "ar";
  const dir = direction ?? (isAr ? "rtl" : "ltr");
  const dateFnsLocale = localeProp ?? (isAr ? arSA : enUS);
  const defaultPlaceholder = isAr ? "اختر من وإلى" : "Pick start & end dates";
  const ellipsisLabel = "…";

  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start gap-2 text-start font-normal",
            dir === "rtl" ? "text-right" : "text-left",
            !value?.from && "text-muted-foreground",
            className
          )}
          dir={dir}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-50" />
          <span className="min-w-0 flex-1 truncate">
            {value?.from ? (
              formatRangeButtonLabel(value, dateFnsLocale, ellipsisLabel)
            ) : (
              <span>{placeholder ?? defaultPlaceholder}</span>
            )}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-1.5rem)] w-auto p-0"
        align={popoverAlign}
        dir={dir}
      >
        <Calendar
          mode="range"
          selected={value}
          onSelect={(r) => {
            onChange(r);
            if (r?.from && r?.to) setOpen(false);
          }}
          defaultMonth={value?.from}
          numberOfMonths={numberOfMonths}
          dir={dir}
          locale={dateFnsLocale}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
