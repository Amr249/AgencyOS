import { cn } from "@/lib/utils";
import Link from "next/link";

type LogoProps = {
  className?: string;
};

export default function Logo({ className }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 px-5 py-4 font-bold", className)}>
      <img src="/Logo1.png" className="block h-5 w-5 rounded-sm object-cover" alt="AgencyOS logo" />
      AgencyOS
    </Link>
  );
}
