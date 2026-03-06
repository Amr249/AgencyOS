"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { createExpense, updateExpense, type ExpenseCategory } from "@/actions/expenses";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { CATEGORY_LABELS } from "./expense-category-badge";

const categoryValues = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
] as const;

const formSchema = z.object({
  title: z.string().min(1, "العنوان مطلوب"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون موجباً"),
  category: z.enum(categoryValues),
  date: z.string().min(1, "التاريخ مطلوب"),
  notes: z.string().optional(),
  receiptUrl: z.string().url().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

type ExpenseRow = {
  id: string;
  title: string;
  amount: string;
  category: ExpenseCategory;
  date: string;
  notes: string | null;
  receiptUrl: string | null;
};

type NewExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editExpense?: ExpenseRow | null;
};

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  editExpense,
}: NewExpenseDialogProps) {
  const [receiptUploading, setReceiptUploading] = React.useState(false);
  const isEdit = !!editExpense;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      amount: 0,
      category: "other",
      date: getTodayISO(),
      notes: "",
      receiptUrl: null,
    },
  });

  React.useEffect(() => {
    if (open && editExpense) {
      form.reset({
        title: editExpense.title,
        amount: Number(editExpense.amount),
        category: editExpense.category,
        date: editExpense.date,
        notes: editExpense.notes ?? "",
        receiptUrl: editExpense.receiptUrl,
      });
    } else if (open && !editExpense) {
      form.reset({
        title: "",
        amount: 0,
        category: "other",
        date: getTodayISO(),
        notes: "",
        receiptUrl: null,
      });
    }
  }, [open, editExpense, form]);

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", "agencyos/expenses/receipts");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      form.setValue("receiptUrl", data.url);
      toast.success("تم رفع الإيصال");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setReceiptUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (isEdit && editExpense) {
      const res = await updateExpense({
        id: editExpense.id,
        title: values.title,
        amount: values.amount,
        category: values.category,
        date: values.date,
        notes: values.notes || undefined,
        receiptUrl: values.receiptUrl ?? null,
      });
      if (res.ok) {
        toast.success("تم تحديث المصروف");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "فشل التحديث");
      }
    } else {
      const res = await createExpense({
        title: values.title,
        amount: values.amount,
        category: values.category,
        date: values.date,
        notes: values.notes || undefined,
        receiptUrl: values.receiptUrl ?? null,
      });
      if (res.ok) {
        toast.success("تم إضافة المصروف");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(typeof res.error === "string" ? res.error : "فشل الحفظ");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل مصروف" : "إضافة مصروف"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "تعديل بيانات المصروف." : "أدخل تفاصيل المصروف الجديد."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>العنوان</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: Adobe Creative Cloud" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>المبلغ بالريال</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الفئة</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفئة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryValues.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>التاريخ</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder="اختر تاريخًا"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ملاحظات (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="وصف أو تفاصيل إضافية" className="min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>إيصال (اختياري)</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-2">
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        disabled={receiptUploading}
                        onChange={handleReceiptUpload}
                      />
                      {field.value && (
                        <a
                          href={field.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline"
                        >
                          عرض الإيصال
                        </a>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="submit">{isEdit ? "حفظ التعديلات" : "إضافة مصروف"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
