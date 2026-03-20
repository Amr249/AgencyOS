"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ClientFormSheet } from "./client-form-sheet";
import type { clients } from "@/lib/db/schema";

type ClientRow = typeof clients.$inferSelect;

export function EditClientButton({
  client,
  serviceOptions,
  initialServiceIds,
}: {
  client: ClientRow;
  serviceOptions: { id: string; name: string; status: string }[];
  initialServiceIds: string[];
}) {
  const t = useTranslations("clients");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("formEditTitle")}
      </Button>
      <ClientFormSheet
        open={open}
        onOpenChange={setOpen}
        client={client}
        serviceOptions={serviceOptions}
        initialServiceIds={initialServiceIds}
      />
    </>
  );
}
