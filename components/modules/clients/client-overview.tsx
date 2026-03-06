import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { clients } from "@/lib/db/schema";
import type { AddressJson } from "@/lib/db/schema";

type ClientRow = typeof clients.$inferSelect;

function formatAddress(addr: AddressJson | null | undefined): string {
  if (!addr) return "—";
  const parts = [addr.street, addr.city, addr.postal, addr.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function ClientOverview({ client }: { client: ClientRow }) {
  const address = client.address as AddressJson | null | undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="text-right">جهة الاتصال</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="w-full text-right">
            <p className="text-muted-foreground text-xs">جهة الاتصال</p>
            <p className="font-medium">{client.contactName || "—"}</p>
          </div>
          <div className="w-full text-right">
            <p className="text-muted-foreground text-xs">الهاتف</p>
            <p className="font-medium">{client.contactPhone || "—"}</p>
          </div>
          <div className="w-full text-right">
            <p className="text-muted-foreground text-xs">الموقع</p>
            <p className="font-medium">
              {client.website ? (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {client.website}
                </a>
              ) : (
                "—"
              )}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-right">العنوان</CardTitle>
        </CardHeader>
        <CardContent className="text-right">
          <p className="text-sm">{formatAddress(address)}</p>
        </CardContent>
      </Card>
      {client.notes ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-right">ملاحظات</CardTitle>
          </CardHeader>
          <CardContent className="text-right">
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
