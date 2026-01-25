import { useState } from "react"
import { toast } from "sonner"
import { Transaction } from "@/types"
import { useUpdateTransaction, useBatchCategorize } from "@/api/hooks"
import { CategoryDropdown } from "@/components/CategoryDropdown"
import { RuleCreationForm } from "./RuleCreationForm"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp, Save } from "lucide-react"

interface ReviewItemProps {
  transaction: Transaction
}

export function ReviewItem({ transaction }: ReviewItemProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [showRuleForm, setShowRuleForm] = useState(false)

  const updateTransaction = useUpdateTransaction()
  const batchCategorize = useBatchCategorize()

  const formattedDate = new Date(transaction.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(transaction.amount))

  const isExpense = transaction.amount < 0

  const handleSave = async () => {
    if (!selectedCategoryId) return

    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        data: {
          category_id: selectedCategoryId,
          needs_review: false,
        },
      })
      toast.success("Transaction categorized")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save"
      )
    }
  }

  const handleCreateRule = async (pattern: string, priority: number) => {
    if (!selectedCategoryId) return

    try {
      await batchCategorize.mutateAsync({
        transaction_ids: [transaction.id],
        category_id: selectedCategoryId,
        create_rule: true,
        rule_pattern: pattern,
        rule_priority: priority,
      })
      toast.success("Rule created and transaction categorized")
      setShowRuleForm(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create rule"
      )
    }
  }

  const isPending = updateTransaction.isPending || batchCategorize.isPending

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Transaction details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{formattedDate}</span>
            {transaction.account_name && (
              <>
                <span>-</span>
                <span>{transaction.account_name}</span>
              </>
            )}
          </div>
          <p className="font-medium truncate" title={transaction.description}>
            {transaction.description}
          </p>
        </div>

        {/* Amount */}
        <div
          className={cn(
            "text-lg font-semibold whitespace-nowrap",
            isExpense ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
          )}
        >
          {isExpense ? "-" : "+"}
          {formattedAmount}
        </div>

        {/* Category dropdown and actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <CategoryDropdown
            value={selectedCategoryId}
            onValueChange={setSelectedCategoryId}
            placeholder="Select category"
            className="w-44"
            disabled={isPending}
          />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!selectedCategoryId || isPending}
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
          {selectedCategoryId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRuleForm(!showRuleForm)}
              disabled={isPending}
            >
              {showRuleForm ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Create Rule
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Rule creation form */}
      {showRuleForm && selectedCategoryId && (
        <RuleCreationForm
          description={transaction.description}
          onSubmit={handleCreateRule}
          onCancel={() => setShowRuleForm(false)}
          isSubmitting={batchCategorize.isPending}
        />
      )}
    </Card>
  )
}
