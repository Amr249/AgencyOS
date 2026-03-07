"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteExpense, type ExpenseRow, type ExpenseCategory } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExpenseCategoryBadge, CATEGORY_LABELS } from "./expense-category-badge";
import { NewExpenseDialog } from "./new-expense-dialog";
import { formatBudgetSAR } from "@/lib/utils";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

const categoryValues: ExpenseCategory[] = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
];

type Summary = {
  totalThisMonth: number;
  totalThisYear: number;
  topCategory: { category: ExpenseCategory; total: number } | null;
};

type TeamMemberOption = { id: string; name: string; role: string | null };

type ExpensesListViewProps = {
  initialExpenses: ExpenseRow[];
  summary: Summary;
  teamMembers?: TeamMemberOption[];
};

function formatDateDDMMYYYY(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function ExpensesListView({ initialExpenses, summary, teamMembers = [] }: ExpensesListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") ?? "";
  const dateFromParam = searchParams.get("dateFrom") ?? "";
  const dateToParam = searchParams.get("dateTo") ?? "";

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editExpense, setEditExpense] = React.useState<ExpenseRow | null>(null);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [expenses, setExpenses] = React.useState<ExpenseRow[]>(initialExpenses);

  React.useEffect(() => {
    setExpenses(initialExpenses);
  }, [initialExpenses]);

  function handleFiltersChange(category: string, dateFrom: string, dateTo: string) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    router.push(`/dashboard/expenses?${params.toString()}`);
  }

  function handleSuccess() {
    router.refresh();
  }

  async function handleDelete(id: string) {
    const res = await deleteExpense(id);
    if (res.ok) {
      toast.success("تم حذف المصروف");
      setDeleteId(null);
      router.refresh();
    } else {
      toast.error(res.error ?? "فشل الحذف");
    }
  }

  const openEdit = (row: ExpenseRow) => {
    setEditExpense(row);
    setDialogOpen(true);
  };
  const openNew = () => {
    setEditExpense(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">المصروفات</h1>
        <Button onClick={openNew}>+ إضافة مصروف</Button>
      </div>

      {/* Summary bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right">إجمالي المصروفات هذا الشهر</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-2xl font-bold">{formatBudgetSAR(String(summary.totalThisMonth))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right">إجمالي المصروفات هذه السنة</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-2xl font-bold">{formatBudgetSAR(String(summary.totalThisYear))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-right">أكبر فئة مصروفات</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="text-2xl font-bold">
              {summary.topCategory
                ? `${CATEGORY_LABELS[summary.topCategory.category]} — ${formatBudgetSAR(String(summary.topCategory.total))}`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <Select
          value={categoryParam || "all"}
          onValueChange={(v) => handleFiltersChange(v === "all" ? "" : v, dateFromParam, dateToParam)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الفئة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الفئات</SelectItem>
            {categoryValues.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePickerAr
          placeholder="من تاريخ"
          className="w-[160px]"
          value={dateFromParam ? new Date(dateFromParam + "T12:00:00") : undefined}
          onChange={(date) =>
            handleFiltersChange(
              categoryParam,
              date ? format(date, "yyyy-MM-dd") : "",
              dateToParam
            )
          }
        />
        <DatePickerAr
          placeholder="إلى تاريخ"
          className="w-[160px]"
          value={dateToParam ? new Date(dateToParam + "T12:00:00") : undefined}
          onChange={(date) =>
            handleFiltersChange(
              categoryParam,
              dateFromParam,
              date ? format(date, "yyyy-MM-dd") : ""
            )
          }
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">العنوان</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    لا توجد مصروفات. اضغط "+ إضافة مصروف" للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-right">
                      <div>
                        <span className="font-medium">{row.title}</span>
                        {row.category === "salaries" && row.teamMemberName && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            👤 {row.teamMemberName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <ExpenseCategoryBadge category={row.category} />
                    </TableCell>
                    <TableCell className="text-right">{formatBudgetSAR(row.amount)}</TableCell>
                    <TableCell className="text-right">{formatDateDDMMYYYY(row.date)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-right text-muted-foreground">
                      {row.notes ?? "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="ml-2 h-4 w-4" />
                            تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(row.id)}
                          >
                            <Trash2 className="ml-2 h-4 w-4" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={handleSuccess}
        editExpense={editExpense}
        teamMembers={teamMembers}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا المصروف نهائياً ولا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
