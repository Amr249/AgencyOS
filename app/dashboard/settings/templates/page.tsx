import { getProjectTemplates } from "@/actions/templates";
import { TemplatesList } from "@/components/modules/templates/templates-list";

export const metadata = {
  title: "Project Templates",
};

export default async function ProjectTemplatesSettingsPage() {
  const result = await getProjectTemplates();
  const templates = result.ok ? result.data : [];

  return (
    <div className="space-y-6" dir="ltr" lang="en">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Templates</h1>
        <p className="text-muted-foreground text-sm">
          Reusable phase and task blueprints for new projects.
        </p>
      </div>
      <TemplatesList initialTemplates={templates} loadError={result.ok ? null : result.error} />
    </div>
  );
}
