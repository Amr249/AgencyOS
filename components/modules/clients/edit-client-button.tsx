"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { ClientFormSheet } from "./client-form-sheet";
import type { clients } from "@/lib/db/schema";

type ClientRow = typeof clients.$inferSelect;

export function EditClientButton({ client }: { client: ClientRow }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        تعديل العميل
      </Button>
      <ClientFormSheet open={open} onOpenChange={setOpen} client={client} />
    </>
  );
}
