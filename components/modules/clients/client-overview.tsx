import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { getLocale, getTranslations } from "next-intl/server";
import type { ClientRevenueStats } from "@/actions/clients";
import type { clients } from "@/lib/db/schema";
import type { AddressJson } from "@/lib/db/schema";
import { clientSourceLabel } from "@/lib/client-metadata";
import { formatAmount } from "@/lib/utils";

type ClientRow = typeof clients.$inferSelect;

function formatAddress(addr: AddressJson | null | undefined): string {
  if (!addr) return "—";
  const parts = [addr.street, addr.city, addr.postal, addr.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function toWhatsAppLink(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function StatMoney({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-neutral-900">
      {formatAmount(String(value.toFixed(2)))}
      <SarCurrencyIcon className="size-3.5 shrink-0 text-muted-foreground" />
    </span>
  );
}

export async function ClientOverview({
  client,
  revenue,
}: {
  client: ClientRow;
  revenue: ClientRevenueStats | null;
}) {
  const locale = await getLocale();
  const t = await getTranslations("clients");
  const isArabic = locale === "ar";
  const address = client.address as AddressJson | null | undefined;
  const whatsappLink = toWhatsAppLink(client.contactPhone);

  return (
    <div className="grid gap-4 md:grid-cols-2" dir={isArabic ? "rtl" : "ltr"}>
      {revenue ? (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className={isArabic ? "text-right" : "text-left"}>
              {t("revenueSectionTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-muted-foreground text-xs">{t("lifetimeValueLabel")}</p>
                <StatMoney value={revenue.lifetimeValue} />
              </div>
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-muted-foreground text-xs">{t("totalProjectsLabel")}</p>
                <p className="text-lg font-semibold tabular-nums text-neutral-900">
                  {revenue.projectCount}
                </p>
              </div>
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-muted-foreground text-xs">{t("avgProjectValueLabel")}</p>
                <StatMoney value={revenue.avgProjectValue} />
              </div>
              <div className={isArabic ? "text-right" : "text-left"}>
                <p className="text-muted-foreground text-xs">{t("outstandingLabel")}</p>
                <StatMoney value={revenue.totalOutstanding} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className={isArabic ? "text-right" : "text-left"}>Source</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className={`w-full ${isArabic ? "text-right" : "text-left"}`}>
            <p className="text-muted-foreground text-xs">Source</p>
            <p className="font-medium">{clientSourceLabel(client.source)}</p>
          </div>
          <div className={`w-full ${isArabic ? "text-right" : "text-left"}`}>
            <p className="text-muted-foreground text-xs">Source Details</p>
            <p className="font-medium whitespace-pre-wrap">
              {client.sourceDetails?.trim() ? client.sourceDetails.trim() : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className={isArabic ? "text-right" : "text-left"}>
            {t("contactSectionTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className={`w-full ${isArabic ? "text-right" : "text-left"}`}>
            <p className="text-muted-foreground text-xs">{t("contactLabel")}</p>
            <p className="font-medium">{client.contactName || "—"}</p>
          </div>
          <div className={`w-full ${isArabic ? "text-right" : "text-left"}`}>
            <p className="text-muted-foreground text-xs">{t("phoneText")}</p>
            <p className="font-medium">{client.contactPhone || "—"}</p>
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("openWhatsApp")}
                title={t("openWhatsApp")}
                className="mt-2 inline-flex size-8 items-center justify-center rounded-md border text-[#25D366] hover:bg-muted"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.198.297-.768.966-.941 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.787-1.48-1.76-1.653-2.057-.173-.297-.018-.458.13-.606.133-.133.297-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.793.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.078 4.487.709.306 1.262.489 1.693.625.711.226 1.359.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                  <path d="M20.52 3.48A11.88 11.88 0 0 0 12.06 0C5.49 0 .12 5.37.12 11.94c0 2.1.55 4.15 1.59 5.96L0 24l6.27-1.64a11.83 11.83 0 0 0 5.79 1.48h.01c6.57 0 11.94-5.37 11.94-11.94 0-3.19-1.24-6.19-3.5-8.42zm-8.46 18.35h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.72.97.99-3.62-.24-.37a9.9 9.9 0 0 1-1.52-5.3c0-5.47 4.45-9.92 9.93-9.92 2.65 0 5.14 1.03 7 2.9a9.86 9.86 0 0 1 2.91 7.01c0 5.47-4.45 9.92-9.94 9.92z" />
                </svg>
              </a>
            ) : null}
          </div>
          <div className={`w-full ${isArabic ? "text-right" : "text-left"}`}>
            <p className="text-muted-foreground text-xs">{t("websiteText")}</p>
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
          <CardTitle className={isArabic ? "text-right" : "text-left"}>
            {t("addressText")}
          </CardTitle>
        </CardHeader>
        <CardContent className={isArabic ? "text-right" : "text-left"}>
          <p className="text-sm">{formatAddress(address)}</p>
        </CardContent>
      </Card>
      {client.notes ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className={isArabic ? "text-right" : "text-left"}>
              {t("tabNotes")}
            </CardTitle>
          </CardHeader>
          <CardContent className={isArabic ? "text-right" : "text-left"}>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
