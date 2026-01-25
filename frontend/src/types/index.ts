// Category types
export interface Category {
  id: number
  name: string
  category_type: "income" | "expense" | "transfer"
  parent_id: number | null
  display_order: number
  created_at?: string
}

export interface CategoryWithChildren extends Category {
  children?: Category[]
}

// Categorization rule types
export interface CategorizationRule {
  id: number
  pattern: string
  category_id: number
  category_name?: string
  priority: number
  is_active: boolean
  account_filter?: string | null
  created_at?: string
}

export interface CreateRuleInput {
  pattern: string
  category_id: number
  priority?: number
  account_filter?: string | null
}

export interface UpdateRuleInput {
  pattern?: string
  category_id?: number
  priority?: number
  is_active?: boolean
  account_filter?: string | null
}

// Transaction types
export interface Transaction {
  id: string
  account_id: string
  account_name?: string
  date: string
  description: string
  amount: number
  category_id: number | null
  category_name?: string | null
  needs_review: boolean
  hash?: string
  raw_data?: Record<string, unknown>
  created_at?: string
}

export interface TransactionUpdate {
  category_id?: number | null
  needs_review?: boolean
}

// Review queue types
export interface ReviewQueueResponse {
  transactions: Transaction[]
  total_count: number
}

export interface BatchCategorizeInput {
  transaction_ids: string[]
  category_id: number
  create_rule?: boolean
  rule_pattern?: string
  rule_priority?: number
}

export interface BatchCategorizeResponse {
  updated_count: number
  rule_created?: boolean
  rule_id?: number
}

// Upload types
export interface UploadResponse {
  new_count: number
  duplicate_count: number
  categorized_count: number
  review_count: number
  errors?: string[]
}

// Account types
export interface Account {
  id: string
  name: string
  account_type: "checking" | "savings" | "credit"
  created_at?: string
}

// Dashboard types
export interface DashboardSummary {
  total_balance: number
  total_income: number
  total_expenses: number
  pending_review_count: number
  spending_by_category: CategorySpending[]
  monthly_trends: MonthlyTrend[]
}

export interface CategorySpending {
  category_id: number
  category_name: string
  amount: number
  percentage: number
}

export interface MonthlyTrend {
  month: string
  income: number
  expenses: number
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Auth types
export interface LoginResponse {
  token: string
  expires_at: string
}

export interface AuthState {
  token: string | null
  isAuthenticated: boolean
}
