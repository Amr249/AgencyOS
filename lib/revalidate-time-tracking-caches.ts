import { revalidatePath } from "next/cache";

/** Invalidate workspace, timesheet, home dashboard, reports, and optional project page. */
export function revalidateTimeTrackingCaches(projectId?: string | null) {
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/workspace/timesheet");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/reports");
  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`);
  }
}
