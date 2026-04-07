import { getWorkspaceWorkload } from "@/actions/workspace";
import { WorkspaceWorkloadView } from "@/components/modules/workspace/workspace-workload-view";

export default async function WorkspaceWorkloadPage() {
  const result = await getWorkspaceWorkload();
  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceWorkloadView rows={result.ok ? result.data : []} />
    </div>
  );
}
