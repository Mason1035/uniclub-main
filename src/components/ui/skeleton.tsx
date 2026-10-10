import "../../styles/ui-motion.css"
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("ui-skeleton rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
