import { useReviewQueue } from "@/api/hooks"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface ReviewBadgeProps {
  className?: string
}

export function ReviewBadge({ className }: ReviewBadgeProps) {
  const { data, isLoading } = useReviewQueue()

  const count = data?.total_count ?? 0

  if (isLoading || count === 0) {
    return null
  }

  return (
    <Badge
      variant="destructive"
      className={cn("ml-1.5 px-1.5 py-0 text-xs font-medium", className)}
    >
      {count > 99 ? "99+" : count}
    </Badge>
  )
}
