"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { NewMemberModal } from "@/components/modules/team/new-member-modal";
import type { TeamMemberRow } from "@/actions/team";

export function EditTeamMemberButton({ member }: { member: TeamMemberRow }) {
  const router = useRouter();
  return (
    <NewMemberModal
      trigger={<Button variant="outline">Edit member</Button>}
      member={member}
      asChild
      onSuccess={() => router.refresh()}
    />
  );
}
