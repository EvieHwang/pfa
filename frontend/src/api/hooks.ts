import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "./client"
import type {
  BatchCategorizeInput,
  CreateRuleInput,
  TransactionUpdate,
  UpdateRuleInput,
} from "@/types"

// Query keys
export const queryKeys = {
  categories: ["categories"] as const,
  rules: ["rules"] as const,
  reviewQueue: ["reviewQueue"] as const,
  transactions: (params?: Record<string, unknown>) =>
    ["transactions", params] as const,
  transaction: (id: string) => ["transaction", id] as const,
  accounts: ["accounts"] as const,
  dashboard: (params?: Record<string, unknown>) =>
    ["dashboard", params] as const,
}

// Categories
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.getCategories(),
    staleTime: 1000 * 60 * 30, // 30 minutes - categories rarely change
  })
}

// Rules
export function useRules() {
  return useQuery({
    queryKey: queryKeys.rules,
    queryFn: () => api.getRules(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useCreateRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRuleInput) => api.createRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules })
    },
  })
}

export function useUpdateRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateRuleInput }) =>
      api.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules })
    },
  })
}

export function useDeleteRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules })
    },
  })
}

// Review Queue
export function useReviewQueue() {
  return useQuery({
    queryKey: queryKeys.reviewQueue,
    queryFn: () => api.getReviewQueue(),
    staleTime: 1000 * 30, // 30 seconds - review queue can change frequently
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TransactionUpdate }) =>
      api.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

export function useBatchCategorize() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: BatchCategorizeInput) => api.batchCategorize(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue })
      queryClient.invalidateQueries({ queryKey: queryKeys.rules })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    },
  })
}

// Transactions
export function useTransactions(params?: {
  start_date?: string
  end_date?: string
  account_id?: string
  category_id?: number
  search?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: queryKeys.transactions(params),
    queryFn: () => api.getTransactions(params),
    staleTime: 1000 * 60, // 1 minute
  })
}

// Accounts
export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => api.getAccounts(),
    staleTime: 1000 * 60 * 30, // 30 minutes - accounts rarely change
  })
}

// Dashboard
export function useDashboard(params?: {
  start_date?: string
  end_date?: string
}) {
  return useQuery({
    queryKey: queryKeys.dashboard(params),
    queryFn: () => api.getDashboard(params),
    staleTime: 1000 * 60, // 1 minute
  })
}

// Upload mutation
export function useUploadTransactions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, accountId }: { file: File; accountId: string }) =>
      api.uploadTransactions(file, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue })
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
    },
  })
}
