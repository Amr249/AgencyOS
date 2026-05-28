import { Loader2 } from "lucide-react";

export default function OnboardingLoading() {
  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-muted/50 via-background to-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
    </div>
  );
}
