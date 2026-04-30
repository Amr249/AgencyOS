"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "أدخل اسم المجلد").max(255),
  scope: z.enum(["standalone", "project"]).default("standalone"),
  projectId: z.string().uuid().optional(),
  accessTeamMemberIds: z.array(z.string().uuid()).optional().default([]),
}).superRefine((v, ctx) => {
  if (v.scope === "project" && !v.projectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["projectId"],
      message: "اختر مشروعاً",
    });
  }
});

type FormValues = z.infer<typeof schema>;

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentFolderId: string | null;
  availableProjects?: { id: string; name: string; iconUrl?: string | null }[];
  availableTeamMembers?: { id: string; name: string; avatarUrl?: string | null }[];
  allowStandaloneRoot?: boolean;
  onSubmit: (input: {
    name: string;
    scope: "standalone" | "project";
    projectId?: string;
    accessTeamMemberIds?: string[];
  }) => Promise<void> | void;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentFolderId,
  availableProjects = [],
  availableTeamMembers = [],
  allowStandaloneRoot = true,
  onSubmit,
}: CreateFolderDialogProps) {
  const isArabic = useLocale() === "ar";
  const showScopeAtRoot = parentFolderId == null;
  const [projectPickerOpen, setProjectPickerOpen] = React.useState(false);
  const [memberPickerOpen, setMemberPickerOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", scope: allowStandaloneRoot ? "standalone" : "project", accessTeamMemberIds: [] },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: "",
        scope: allowStandaloneRoot ? "standalone" : "project",
        projectId: undefined,
        accessTeamMemberIds: [],
      });
    }
  }, [open, form, allowStandaloneRoot]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        scope: values.scope,
        projectId: values.projectId,
        accessTeamMemberIds: values.accessTeamMemberIds,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isArabic ? "مجلد جديد" : "New folder"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isArabic ? "اسم المجلد" : "Folder name"}</FormLabel>
                  <FormControl>
                    <Input placeholder={isArabic ? "مثال: العلامة التجارية" : "Example: Branding"} autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {showScopeAtRoot ? (
              <>
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{isArabic ? "نوع المجلد" : "Folder type"}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {allowStandaloneRoot ? (
                            <SelectItem value="standalone">{isArabic ? "مستقل" : "Standalone"}</SelectItem>
                          ) : null}
                          <SelectItem value="project">{isArabic ? "مرتبط بمشروع" : "Project-linked"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {form.watch("scope") === "project" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isArabic ? "المشروع" : "Project"}</FormLabel>
                          <Popover open={projectPickerOpen} onOpenChange={setProjectPickerOpen} modal={false}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  type="button"
                                  variant="outline"
                                  role="combobox"
                                  className={cn(
                                    "w-full justify-between",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value
                                    ? availableProjects.find((p) => p.id === field.value)?.name
                                    : isArabic ? "اختر مشروعاً" : "Select a project"}
                                  <ChevronsUpDown className="opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={isArabic ? "ابحث عن مشروع..." : "Search projects..."} />
                                <CommandList>
                                  <CommandEmpty>{isArabic ? "لا توجد نتائج" : "No projects found."}</CommandEmpty>
                                  {availableProjects.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      value={`${p.name} ${p.id}`}
                                      onSelect={() => {
                                        field.onChange(p.id);
                                        setProjectPickerOpen(false);
                                      }}
                                      className="gap-2"
                                    >
                                      {p.iconUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={p.iconUrl}
                                          alt=""
                                          className="size-5 rounded object-cover"
                                        />
                                      ) : (
                                        <FolderKanban className="size-4 text-muted-foreground" />
                                      )}
                                      <span className="flex-1 truncate">{p.name}</span>
                                      <Check
                                        className={cn(
                                          "size-4",
                                          field.value === p.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                    </CommandItem>
                                  ))}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accessTeamMemberIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{isArabic ? "صلاحيات الفريق" : "Team access"}</FormLabel>
                          <Popover open={memberPickerOpen} onOpenChange={setMemberPickerOpen} modal={false}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                    (!field.value || field.value.length === 0) && "text-muted-foreground"
                                )}
                              >
                                  {field.value && field.value.length > 0
                                    ? `${field.value.length} ${isArabic ? "أعضاء" : "members"}`
                                    : isArabic ? "اختر أعضاء الفريق" : "Select team members"}
                                <ChevronsUpDown className="opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                              className="w-[--radix-popover-trigger-width] max-h-80 overflow-hidden p-0"
                            align="start"
                            onWheelCapture={(e) => e.stopPropagation()}
                          >
                            <Command>
                                <CommandInput placeholder={isArabic ? "ابحث عن عضو..." : "Search members..."} />
                              <CommandList className="max-h-64 overflow-y-auto overscroll-contain">
                                  <CommandEmpty>{isArabic ? "لا توجد نتائج" : "No members found."}</CommandEmpty>
                                  {availableTeamMembers.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                      value={p.name}
                                    onSelect={() => {
                                        const prev = field.value ?? [];
                                        const next = prev.includes(p.id)
                                          ? prev.filter((id) => id !== p.id)
                                          : [...prev, p.id];
                                        field.onChange(next);
                                    }}
                                    className="gap-2"
                                  >
                                      {p.avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                          src={p.avatarUrl}
                                        alt=""
                                        className="size-5 rounded object-cover"
                                      />
                                    ) : (
                                      <FolderKanban className="size-4 text-muted-foreground" />
                                    )}
                                    <span className="flex-1 truncate">{p.name}</span>
                                    <Check
                                      className={cn(
                                        "size-4",
                                          (field.value ?? []).includes(p.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                  </CommandItem>
                                ))}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </>
                ) : null}
              </>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                {isArabic ? "إلغاء" : "Cancel"}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (isArabic ? "جاري الإنشاء…" : "Creating...") : isArabic ? "إنشاء" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
