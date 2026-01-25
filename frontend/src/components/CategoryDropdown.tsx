import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCategories } from "@/api/hooks"
import type { Category, CategoryWithChildren } from "@/types"

interface CategoryDropdownProps {
  value?: number | null
  onValueChange: (value: number | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CategoryDropdown({
  value,
  onValueChange,
  placeholder = "Select category",
  disabled = false,
  className,
}: CategoryDropdownProps) {
  const { data, isLoading } = useCategories()

  // Organize categories into hierarchy
  const categoriesHierarchy = useMemo(() => {
    if (!data?.categories) return []

    const categories = data.categories
    const parentCategories: CategoryWithChildren[] = []
    const childrenByParent = new Map<number, Category[]>()

    // First pass: separate parents and children
    categories.forEach((cat) => {
      if (cat.parent_id === null) {
        parentCategories.push({ ...cat, children: [] })
      } else {
        const children = childrenByParent.get(cat.parent_id) || []
        children.push(cat)
        childrenByParent.set(cat.parent_id, children)
      }
    })

    // Second pass: attach children to parents
    parentCategories.forEach((parent) => {
      parent.children = childrenByParent.get(parent.id) || []
      // Sort children by display_order
      parent.children.sort((a, b) => a.display_order - b.display_order)
    })

    // Sort parents by display_order
    parentCategories.sort((a, b) => a.display_order - b.display_order)

    return parentCategories
  }, [data?.categories])

  const handleValueChange = (val: string) => {
    if (val === "") {
      onValueChange(null)
    } else {
      onValueChange(parseInt(val, 10))
    }
  }

  return (
    <Select
      value={value?.toString() ?? ""}
      onValueChange={handleValueChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {categoriesHierarchy.map((parent) => (
          <SelectGroup key={parent.id}>
            <SelectLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {parent.name}
            </SelectLabel>
            {/* If parent has children, show children as selectable items */}
            {parent.children && parent.children.length > 0 ? (
              parent.children.map((child) => (
                <SelectItem
                  key={child.id}
                  value={child.id.toString()}
                  className="pl-4"
                >
                  {child.name}
                </SelectItem>
              ))
            ) : (
              // If no children, parent itself is selectable
              <SelectItem value={parent.id.toString()} className="pl-4">
                {parent.name}
              </SelectItem>
            )}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}

// Simple non-hierarchical version for cases where we need flat list
interface SimpleCategoryDropdownProps {
  value?: number | null
  onValueChange: (value: number | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SimpleCategoryDropdown({
  value,
  onValueChange,
  placeholder = "Select category",
  disabled = false,
  className,
}: SimpleCategoryDropdownProps) {
  const { data, isLoading } = useCategories()

  const handleValueChange = (val: string) => {
    if (val === "") {
      onValueChange(null)
    } else {
      onValueChange(parseInt(val, 10))
    }
  }

  // Sort categories: leaf categories first (ones with parents), then by name
  const sortedCategories = useMemo(() => {
    if (!data?.categories) return []
    return [...data.categories].sort((a, b) => {
      // Leaf categories (with parent_id) should come before top-level
      if (a.parent_id && !b.parent_id) return -1
      if (!a.parent_id && b.parent_id) return 1
      return a.name.localeCompare(b.name)
    })
  }, [data?.categories])

  return (
    <Select
      value={value?.toString() ?? ""}
      onValueChange={handleValueChange}
      disabled={disabled || isLoading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {sortedCategories.map((category) => (
          <SelectItem key={category.id} value={category.id.toString()}>
            {category.parent_id ? `  ${category.name}` : category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
