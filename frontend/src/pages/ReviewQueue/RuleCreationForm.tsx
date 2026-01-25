import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Wand2 } from "lucide-react"

interface RuleCreationFormProps {
  description: string
  onSubmit: (pattern: string, priority: number) => void
  onCancel: () => void
  isSubmitting: boolean
}

export function RuleCreationForm({
  description,
  onSubmit,
  onCancel,
  isSubmitting,
}: RuleCreationFormProps) {
  // Initialize pattern with a cleaned version of the description
  // Remove common noise like reference numbers, dates, etc.
  const cleanPattern = (desc: string): string => {
    return desc
      .replace(/\s+#?\d{4,}/g, "") // Remove long numbers (references, IDs)
      .replace(/\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, "") // Remove dates
      .replace(/\s{2,}/g, " ") // Normalize whitespace
      .trim()
  }

  const [pattern, setPattern] = useState(cleanPattern(description))
  const [priority, setPriority] = useState(10)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedPattern = pattern.trim()
    if (!trimmedPattern) {
      setError("Pattern cannot be empty")
      return
    }

    if (priority < 1) {
      setError("Priority must be at least 1")
      return
    }

    setError(null)
    onSubmit(trimmedPattern, priority)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 p-4 bg-muted/50 rounded-lg space-y-4"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Wand2 className="h-4 w-4" />
        Create Categorization Rule
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_100px]">
        <div className="space-y-1.5">
          <label htmlFor="pattern" className="text-sm font-medium">
            Pattern
          </label>
          <Input
            id="pattern"
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value)
              setError(null)
            }}
            placeholder="Text to match in descriptions"
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            Matches any description containing this text (case-insensitive)
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="priority" className="text-sm font-medium">
            Priority
          </label>
          <Input
            id="priority"
            type="number"
            min={1}
            value={priority}
            onChange={(e) => {
              setPriority(parseInt(e.target.value) || 1)
              setError(null)
            }}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">Lower = higher priority</p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Save Rule & Categorize"}
        </Button>
      </div>
    </form>
  )
}
