import { Transaction } from "@/types"
import { ReviewItem } from "./ReviewItem"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface ReviewListProps {
  transactions: Transaction[]
  isLoading: boolean
}

export function ReviewList({ transactions, isLoading }: ReviewListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-64" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-9 w-16" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction) => (
        <ReviewItem key={transaction.id} transaction={transaction} />
      ))}
    </div>
  )
}
