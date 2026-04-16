"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createProject, type CreateProjectInput } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClientSelectOptionRow,
  TeamMemberSelectOptionRow,
  entityInitials,
} from "@/components/entity-select-option";

const projectStatusOptions = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On Hold" },
  { value: "review", label: "Review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().uuid("Select a client"),
  status: z.enum(["lead", "active", "on_hold", "review", "completed", "cancelled"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  teamMemberIds: z.array(z.string()).optional(),
  serviceIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ClientOption = { id: string; companyName: string | null; logoUrl?: string | null };
type TeamMemberOption = { id: string; name: string; role: string | null; avatarUrl?: string | null };
type ServiceOption = { id: string; name: string; status: string };

type NewProjectDialogProps = {
  trigger?: React.ReactNode;
  clients: ClientOption[];
  teamMembers?: TeamMemberOption[];
  services?: ServiceOption[];
  defaultCurrency?: string;
  /** When set, client is pre-selected and locked (e.g. from client detail page). */
  defaultClientId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
  onSuccess?: () => void;
};

export function NewProjectDialog({
  trigger,
  clients,
  teamMembers = [],
  services = [],
  defaultCurrency = "USD",
  defaultClientId,
  open,
  onOpenChange,
  asChild,
  onSuccess,
}: NewProjectDialogProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [coverImageUrl, setCoverImageUrl] = React.useState<string | null>(null);
  const [coverUploading, setCoverUploading] = React.useState(false);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const effectiveOpen = isControlled ? open : dialogOpen;
  const setEffectiveOpen = isControlled ? onOpenChange : setDialogOpen;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      clientId: "",
      status: "lead",
      startDate: "",
      endDate: "",
      budget: undefined,
      description: "",
      teamMemberIds: [],
      serviceIds: [],
    },
  });

  const lockedClient = !!defaultClientId;
  React.useEffect(() => {
    if (effectiveOpen && !form.formState.isDirty) {
      setCoverImageUrl(null);
      form.reset({
        name: "",
        clientId: defaultClientId ?? "",
        status: "lead",
        startDate: "",
        endDate: "",
        budget: undefined,
        description: "",
        teamMemberIds: [],
        serviceIds: [],
      });
    }
  }, [effectiveOpen, form, defaultClientId]);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("scope", "project-cover");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setCoverImageUrl(data.url);
      } else {
        toast.error(data.error ?? "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  };

  async function onSubmit(values: FormValues) {
    const payload: CreateProjectInput = {
      name: values.name,
      clientId: values.clientId,
      status: values.status,
      coverImageUrl: coverImageUrl ?? undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      budget: values.budget,
      description: values.description || undefined,
      teamMemberIds: values.teamMemberIds?.length ? values.teamMemberIds : undefined,
      serviceIds: values.serviceIds?.length ? values.serviceIds : undefined,
    };

    const result = await createProject(payload);

    if (result.ok) {
      toast.success("Project created");
      setEffectiveOpen(false);
      onSuccess?.();
    } else {
      const err = result.error as { _form?: string[] } | Record<string, string[]>;
      const msg = err._form?.[0] ?? Object.values(err ?? {}).flat().find(Boolean) ?? "Failed to create project";
      toast.error(String(msg));
    }
  }

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>New Project</DialogTitle>
        <DialogDescription>
          Add a new project linked to a client. Required fields are marked.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Cover Image (optional)</label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
              disabled={coverUploading}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
              >
                {coverUploading ? "Uploading..." : coverImageUrl ? "Replace image" : "Upload cover"}
              </Button>
              {coverImageUrl && (
                <>
                  <img src={coverImageUrl} alt="Cover preview" className="h-14 w-14 rounded object-cover border" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCoverImageUrl(null)}>
                    Remove
                  </Button>
                </>
              )}
            </div>
          </div>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Project name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client *</FormLabel>
                {lockedClient ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {(() => {
                      const c = clients.find((x) => x.id === field.value);
                      const label = c?.companyName ?? field.value;
                      return (
                        <>
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={c?.logoUrl?.trim() || undefined} alt="" />
                            <AvatarFallback className="text-[10px]">{entityInitials(label, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{label}</span>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => {
                        const label = c.companyName || c.id;
                        return (
                          <SelectItem key={c.id} value={c.id} textValue={label}>
                            <ClientSelectOptionRow logoUrl={c.logoUrl} label={label} />
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projectStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {teamMembers.length > 0 && (
            <FormField
              control={form.control}
              name="teamMemberIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Members</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Select
                        value=""
                        onValueChange={(v) => {
                          const arr = field.value ?? [];
                          if (v && !arr.includes(v)) {
                            field.onChange([...arr, v]);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers
                            .filter((m) => !(field.value ?? []).includes(m.id))
                            .map((m) => (
                              <SelectItem
                                key={m.id}
                                value={m.id}
                                textValue={`${m.name} ${m.role ?? ""}`}
                              >
                                <TeamMemberSelectOptionRow
                                  avatarUrl={m.avatarUrl}
                                  name={m.name}
                                  secondary={m.role ?? "—"}
                                />
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {(field.value ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(field.value ?? []).map((id) => {
                            const m = teamMembers.find((x) => x.id === id);
                            return (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="gap-1 pr-1.5 pl-1.5"
                              >
                                <Avatar className="h-4 w-4 shrink-0">
                                  <AvatarImage src={m?.avatarUrl?.trim() || undefined} alt="" />
                                  <AvatarFallback className="text-[8px]">
                                    {entityInitials(m?.name ?? id, 1)}
                                  </AvatarFallback>
                                </Avatar>
                                {m?.name ?? id}
                                <button
                                  type="button"
                                  className="rounded-full hover:bg-muted p-0.5"
                                  onClick={() =>
                                    field.onChange((field.value ?? []).filter((x) => x !== id))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {services.length > 0 && (
            <FormField
              control={form.control}
              name="serviceIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Services</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Select
                        value=""
                        onValueChange={(v) => {
                          const arr = field.value ?? [];
                          if (v && !arr.includes(v)) {
                            field.onChange([...arr, v]);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add service" />
                        </SelectTrigger>
                        <SelectContent>
                          {services
                            .filter((s) => s.status === "active")
                            .filter((s) => !(field.value ?? []).includes(s.id))
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {(field.value ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(field.value ?? []).map((id) => {
                            const s = services.find((x) => x.id === id);
                            return (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="gap-1 pr-1.5 pl-1.5"
                              >
                                {s?.name ?? id}
                                <button
                                  type="button"
                                  className="rounded-full hover:bg-muted p-0.5"
                                  onClick={() =>
                                    field.onChange((field.value ?? []).filter((x) => x !== id))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder="Select a date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date / Deadline</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder="Select a date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="inline-flex items-center gap-1">
                  Budget
                  <SarCurrencyIcon className="h-3.5 w-3.5 shrink-0" />
                </FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Project scope and goals..." className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEffectiveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );

  const dialogContent = (
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      {content}
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={effectiveOpen} onOpenChange={setEffectiveOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={effectiveOpen} onOpenChange={setEffectiveOpen}>
      {trigger && (
        <DialogTrigger asChild={asChild}>
          {trigger}
        </DialogTrigger>
      )}
      {dialogContent}
    </Dialog>
  );
}
