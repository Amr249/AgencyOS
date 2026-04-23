import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalInvoices } from "@/actions/portal-dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  projectName: string | null;
  issueDate: string;
  status: string;
  total: unknown;
  currency: string;
  amountDue: number;
};

export default async function PortalInvoicesPage() {
  const res = await getPortalInvoices();
  if (!res.ok) {
    if (res.error === "unauthorized") redirect("/portal/login");
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">Could not load invoices.</p>
      </div>
    );
  }

  const rows = (res.data ?? []) as InvoiceRow[];

  const openRows = rows.filter((r) => r.status !== "paid");
  const paidRows = rows.filter((r) => r.status === "paid");

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Outstanding and paid invoices for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Open & partial</CardTitle>
          <CardDescription>Amounts still due</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTable rows={openRows} showDue />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Paid history</CardTitle>
          <CardDescription>Recently settled invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <InvoiceTable rows={paidRows} showDue={false} />
        </CardContent>
      </Card>
    </div>
  );
}

function InvoiceTable({ rows, showDue }: { rows: InvoiceRow[]; showDue: boolean }) {
  if (!rows.length) {
    return <p className="text-muted-foreground text-sm">No invoices in this section.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Issue date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-end">Total</TableHead>
            {showDue ? <TableHead className="text-end">Due</TableHead> : null}
            <TableHead className="w-[120px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.invoiceNumber}</TableCell>
              <TableCell className="text-muted-foreground max-w-[200px] truncate">
                {r.projectName ?? "—"}
              </TableCell>
              <TableCell className="tabular-nums">{String(r.issueDate).slice(0, 10)}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="text-end tabular-nums">
                {r.currency}{" "}
                {parseFloat(String(r.total)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              {showDue ? (
                <TableCell className="text-end tabular-nums">
                  {r.currency}{" "}
                  {r.amountDue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
              ) : null}
              <TableCell className="text-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/api/invoices/${r.id}/pdf`} target="_blank" rel="noopener noreferrer">
                    PDF
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
