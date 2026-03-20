"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createService, updateService, type ServiceRow } from "@/actions/services";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Service name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

export function NewServiceModal({ trigger, service, open, onOpenChange, asChild, onSuccess }: { trigger: React.ReactNode; service?: ServiceRow; open?: boolean; onOpenChange?: (o: boolean) => void; asChild?: boolean; onSuccess?: () => void }) {
  const [localOpen, setLocalOpen] = React.useState(false);
  const controlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = controlled ? open : localOpen;
  const setOpen = controlled ? onOpenChange! : setLocalOpen;
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: service?.name ?? "", description: service?.description ?? "", status: (service?.status as "active" | "inactive") ?? "active" } });

  React.useEffect(() => { if (!isOpen) return; form.reset({ name: service?.name ?? "", description: service?.description ?? "", status: (service?.status as "active" | "inactive") ?? "active" }); }, [isOpen, service, form]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild={asChild}>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{service ? "Edit service" : "New service"}</DialogTitle><DialogDescription>{service ? "Update service details." : "Create a service type."}</DialogDescription></DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const result = service
                ? await updateService({ id: service.id, ...values })
                : await createService(values);
              if (result.ok) {
                toast.success(service ? "Service updated" : "Service created");
                setOpen(false);
                onSuccess?.();
              } else {
                const err = result.error as { _form?: string[] } | Record<string, string[]>;
                toast.error(err?._form?.[0] ?? "Operation failed");
              }
            })}
            className="space-y-4"
          >
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name *</FormLabel><FormControl><Input placeholder="Service name" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Optional..." className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="status" render={({ field }) => <FormItem><FormLabel>Status</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select><FormMessage /></FormItem>} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">{service ? "Save changes" : "Create service"}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
