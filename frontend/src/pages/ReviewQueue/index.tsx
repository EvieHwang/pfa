import { useReviewQueue } from "@/api/hooks"
import { ReviewList } from "./ReviewList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export function ReviewQueue() {
  const { data, isLoading, error } = useReviewQueue()

  const count = data?.total_count ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Review Transactions</h1>
        <p className="text-muted-foreground">
          {isLoading
            ? "Loading..."
            : count > 0
              ? `${count} transaction${count === 1 ? "" : "s"} need${count === 1 ? "s" : ""} review`
              : "All transactions have been categorized"}
        </p>
      </div>

      {error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Review Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Failed to load transactions"}
            </p>
          </CardContent>
        </Card>
      ) : count === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold">All caught up!</h3>
            <p className="text-muted-foreground text-center mt-1">
              There are no transactions waiting for review.
              <br />
              Upload new transactions to start categorizing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReviewList
          transactions={data?.transactions ?? []}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
