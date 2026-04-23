import { redirect } from "next/navigation";
import { getPortalSharedFiles } from "@/actions/portal-dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default async function PortalFilesPage() {
  const res = await getPortalSharedFiles();
  if (!res.ok) {
    if (res.error === "unauthorized") redirect("/portal/login");
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">Could not load files.</p>
      </div>
    );
  }

  const rows = res.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Shared files</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Deliverables and documents linked to your client or projects (no internal agency-only records).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Library</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No shared files yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-muted-foreground">{f.projectName ?? "General"}</TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {f.createdAt instanceof Date
                          ? f.createdAt.toLocaleDateString()
                          : new Date(f.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button variant="outline" size="sm" asChild>
                          <a href={f.imagekitUrl} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Need something else? Contact your agency using the email from your invoice or proposal.
      </p>
    </div>
  );
}
