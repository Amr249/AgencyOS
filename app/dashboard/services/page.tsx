import type { Metadata } from "next";
import { getServices } from "@/actions/services";
import { ServicesListView } from "@/components/modules/services/services-list-view";
import { requireAgencyOrganization } from "@/lib/org-session";

export const metadata: Metadata = {
  title: "Services",
  description: "Manage agency service types",
};

export default async function ServicesPage() {
  await requireAgencyOrganization();

  const result = await getServices();
  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }
  return <ServicesListView services={result.data} />;
}
