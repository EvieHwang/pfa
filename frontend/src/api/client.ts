// API base URL - uses relative path in production (same origin)
const API_BASE = "/api"

// Get auth token from localStorage
function getToken(): string | null {
  return localStorage.getItem("auth_token")
}

// Set auth token in localStorage
export function setToken(token: string): void {
  localStorage.setItem("auth_token", token)
}

// Clear auth token
export function clearToken(): void {
  localStorage.removeItem("auth_token")
}

// Check if authenticated
export function isAuthenticated(): boolean {
  return !!getToken()
}

// API error class
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// Generic fetch wrapper with auth
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token) {
    ;(headers as Record<string, string>)["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      errorBody.code || "UNKNOWN_ERROR",
      errorBody.error || errorBody.message || `HTTP ${response.status}`
    )
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// API methods
export const api = {
  // Auth
  login: (password: string) =>
    fetchApi<{ token: string; expires_at: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  verifyToken: () =>
    fetchApi<{ valid: boolean }>("/auth/verify"),

  // Categories
  getCategories: () =>
    fetchApi<{ categories: import("@/types").Category[] }>("/categories"),

  // Rules
  getRules: () =>
    fetchApi<{ rules: import("@/types").CategorizationRule[] }>("/rules"),

  createRule: (data: import("@/types").CreateRuleInput) =>
    fetchApi<{ rule: import("@/types").CategorizationRule }>("/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateRule: (id: number, data: import("@/types").UpdateRuleInput) =>
    fetchApi<{ rule: import("@/types").CategorizationRule }>(`/rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteRule: (id: number) =>
    fetchApi<void>(`/rules/${id}`, { method: "DELETE" }),

  // Transactions
  getTransactions: (params?: {
    start_date?: string
    end_date?: string
    account_id?: string
    category_id?: number
    search?: string
    limit?: number
    offset?: number
  }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })
    }
    const query = searchParams.toString()
    return fetchApi<{ transactions: import("@/types").Transaction[]; total_count: number }>(
      `/transactions${query ? `?${query}` : ""}`
    )
  },

  getTransaction: (id: string) =>
    fetchApi<{ transaction: import("@/types").Transaction }>(`/transactions/${id}`),

  updateTransaction: (id: string, data: import("@/types").TransactionUpdate) =>
    fetchApi<{ transaction: import("@/types").Transaction }>(`/transactions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Review queue
  getReviewQueue: () =>
    fetchApi<import("@/types").ReviewQueueResponse>("/transactions/review"),

  batchCategorize: (data: import("@/types").BatchCategorizeInput) =>
    fetchApi<import("@/types").BatchCategorizeResponse>("/transactions/review/batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Upload
  uploadTransactions: async (file: File, accountId: string) => {
    const token = getToken()
    const formData = new FormData()
    formData.append("file", file)
    formData.append("account_id", accountId)

    const headers: HeadersInit = {}
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE}/transactions/upload`, {
      method: "POST",
      headers,
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        errorBody.code || "UPLOAD_ERROR",
        errorBody.error || errorBody.message || "Upload failed"
      )
    }

    return response.json() as Promise<import("@/types").UploadResponse>
  },

  // Accounts
  getAccounts: () =>
    fetchApi<{ accounts: import("@/types").Account[] }>("/accounts"),

  // Dashboard
  getDashboard: (params?: { start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value))
        }
      })
    }
    const query = searchParams.toString()
    return fetchApi<import("@/types").DashboardSummary>(
      `/dashboard${query ? `?${query}` : ""}`
    )
  },
}
