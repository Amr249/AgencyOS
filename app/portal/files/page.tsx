import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("clientPortal");
  const res = await getPortalSharedFiles();
  if (!res.ok) {
    if (res.error === "unauthorized") {
      redirect(`/login?callbackUrl=${encodeURIComponent("/portal/files")}`);
    }
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-destructive text-sm">{t("filesLoadError")}</p>
      </div>
    );
  }

  const rows = res.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("filesTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("filesSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("filesLibrary")}</CardTitle>
          <CardDescription>{t("filesNewest")}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("filesEmpty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colName")}</TableHead>
                    <TableHead>{t("colProject")}</TableHead>
                    <TableHead>{t("colAdded")}</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.projectName ?? t("generalProject")}
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {(f.createdAt instanceof Date ? f.createdAt : new Date(f.createdAt)).toLocaleDateString(
                          "ar",
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button variant="outline" size="sm" asChild>
                          <a href={f.imagekitUrl} target="_blank" rel="noopener noreferrer">
                            {t("openFile")}
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

      <p className="text-muted-foreground text-xs">{t("filesFooterHint")}</p>
    </div>
  );
}
