import { TreeDeciduous } from "lucide-react";
import { cn } from "@/lib/utils";

type RimbunMarkProps = React.ComponentProps<"svg">;

export function RimbunMark({ className, ...props }: RimbunMarkProps) {
  return <TreeDeciduous className={cn("size-8", className)} {...props} />;
}
