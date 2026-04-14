"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type ProposalServiceOption = { id: string; name: string };

type ProposalServicesFieldProps = {
  options: ProposalServiceOption[];
  value: string[];
  onChange: (serviceIds: string[]) => void;
  label?: string;
};

export function ProposalServicesField({
  options,
  value,
  onChange,
  label = "Services",
}: ProposalServicesFieldProps) {
  const selected = React.useMemo(() => new Set(value), [value]);

  const toggle = (id: string) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
        {options.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No services yet. Add them under Services in the dashboard.
          </p>
        ) : (
          options.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 text-sm leading-none"
            >
              <Checkbox
                checked={selected.has(o.id)}
                onCheckedChange={() => toggle(o.id)}
              />
              <span>{o.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
