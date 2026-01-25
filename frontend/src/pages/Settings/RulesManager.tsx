import { useState } from "react"
import { toast } from "sonner"
import { useRules, useCreateRule, useUpdateRule, useDeleteRule } from "@/api/hooks"
import { CategorizationRule, CreateRuleInput, UpdateRuleInput } from "@/types"
import { CategoryDropdown } from "@/components/CategoryDropdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function RulesManager() {
  const { data, isLoading, error } = useRules()
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()

  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingRule, setEditingRule] = useState<CategorizationRule | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<CategorizationRule | null>(null)

  // Form state
  const [formPattern, setFormPattern] = useState("")
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null)
  const [formPriority, setFormPriority] = useState(10)

  const rules = data?.rules ?? []

  // Filter rules by search query
  const filteredRules = rules.filter(
    (rule) =>
      rule.pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.category_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Sort by priority
  const sortedRules = [...filteredRules].sort((a, b) => a.priority - b.priority)

  const resetForm = () => {
    setFormPattern("")
    setFormCategoryId(null)
    setFormPriority(10)
  }

  const openCreateDialog = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  const openEditDialog = (rule: CategorizationRule) => {
    setFormPattern(rule.pattern)
    setFormCategoryId(rule.category_id)
    setFormPriority(rule.priority)
    setEditingRule(rule)
  }

  const handleCreate = async () => {
    if (!formPattern.trim() || !formCategoryId) {
      toast.error("Please fill in all required fields")
      return
    }

    const input: CreateRuleInput = {
      pattern: formPattern.trim(),
      category_id: formCategoryId,
      priority: formPriority,
    }

    try {
      await createRule.mutateAsync(input)
      toast.success("Rule created")
      setShowCreateDialog(false)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create rule")
    }
  }

  const handleUpdate = async () => {
    if (!editingRule || !formPattern.trim() || !formCategoryId) {
      toast.error("Please fill in all required fields")
      return
    }

    const input: UpdateRuleInput = {
      pattern: formPattern.trim(),
      category_id: formCategoryId,
      priority: formPriority,
    }

    try {
      await updateRule.mutateAsync({ id: editingRule.id, data: input })
      toast.success("Rule updated")
      setEditingRule(null)
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update rule")
    }
  }

  const handleToggleActive = async (rule: CategorizationRule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        data: { is_active: !rule.is_active },
      })
      toast.success(rule.is_active ? "Rule disabled" : "Rule enabled")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update rule")
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return

    try {
      await deleteRule.mutateAsync(deleteConfirm.id)
      toast.success("Rule deleted")
      setDeleteConfirm(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete rule")
    }
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Error Loading Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load rules"}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorization Rules</h1>
          <p className="text-muted-foreground">
            Manage rules for auto-categorizing transactions
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search rules..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Rules table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead>Pattern</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-24">Active</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-9" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                </TableRow>
              ))
            ) : sortedRules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {searchQuery
                    ? "No rules match your search"
                    : "No rules yet. Create one to start auto-categorizing!"}
                </TableCell>
              </TableRow>
            ) : (
              sortedRules.map((rule) => (
                <TableRow
                  key={rule.id}
                  className={cn(!rule.is_active && "opacity-50")}
                >
                  <TableCell className="font-mono">{rule.priority}</TableCell>
                  <TableCell className="font-medium">{rule.pattern}</TableCell>
                  <TableCell>{rule.category_name}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(rule)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || !!editingRule}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingRule(null)
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit Rule" : "Create Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule
                ? "Update the rule's pattern, category, or priority."
                : "Create a new rule to auto-categorize transactions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="pattern" className="text-sm font-medium">
                Pattern <span className="text-destructive">*</span>
              </label>
              <Input
                id="pattern"
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                placeholder="Text to match in descriptions"
              />
              <p className="text-xs text-muted-foreground">
                Case-insensitive substring match
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Category <span className="text-destructive">*</span>
              </label>
              <CategoryDropdown
                value={formCategoryId}
                onValueChange={setFormCategoryId}
                placeholder="Select category"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium">
                Priority
              </label>
              <Input
                id="priority"
                type="number"
                min={1}
                value={formPriority}
                onChange={(e) => setFormPriority(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Lower number = higher priority. Rules are checked in order.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingRule(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingRule ? handleUpdate : handleCreate}
              disabled={
                createRule.isPending ||
                updateRule.isPending ||
                !formPattern.trim() ||
                !formCategoryId
              }
            >
              {createRule.isPending || updateRule.isPending
                ? "Saving..."
                : editingRule
                  ? "Update"
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the rule for pattern "{deleteConfirm?.pattern}"?
              This won't affect already-categorized transactions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteRule.isPending}
            >
              {deleteRule.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
