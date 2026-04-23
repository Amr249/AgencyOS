import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { AiChatView } from "@/components/modules/ai-chat/ai-chat-view";

export default async function AiChatPageRoute() {
  const session = await getServerSession(authOptions);
  if (sessionUserRole(session) !== "admin") {
    redirect("/dashboard");
  }

  return <AiChatView />;
}
