import { getWorkspaceWorkloadCapacity } from "@/actions/workspace";
import { WorkspaceWorkloadView } from "@/components/modules/workspace/workspace-workload-view";

export default async function WorkspaceWorkloadPage() {
  const capacityRes = await getWorkspaceWorkloadCapacity();

  return (
    <div dir="ltr" lang="en" className="h-full">
      <WorkspaceWorkloadView rows={capacityRes.ok ? capacityRes.data : []} />
    </div>
  );
}
