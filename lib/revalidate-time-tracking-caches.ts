import { revalidatePath } from "next/cache";

/** Invalidate home dashboard, reports, tasks, and optional project page. */
export function revalidateTimeTrackingCaches(projectId?: string | null) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/workspace");
  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`);
  }
}
