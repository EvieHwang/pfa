/**
 * API client for Burn Rate backend
 */

const API_BASE = '/api';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    async request(path, options = {}) {
        const url = `${API_BASE}${path}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            const error = new Error(data.error || 'Request failed');
            error.status = response.status;
            error.code = data.code;
            throw error;
        }

        return data;
    }

    // Auth
    async login(password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        this.token = data.token;
        localStorage.setItem('token', data.token);
        return data;
    }

    logout() {
        this.token = null;
        localStorage.removeItem('token');
    }

    isAuthenticated() {
        return !!this.token;
    }

    // Accounts
    async getAccounts() {
        return this.request('/accounts');
    }

    // Categories
    async getCategories() {
        return this.request('/categories');
    }

    async createCategory(name, burnRateGroup, parentId = null) {
        return this.request('/categories', {
            method: 'POST',
            body: JSON.stringify({
                name,
                burn_rate_group: burnRateGroup,
                parent_id: parentId,
            }),
        });
    }

    async updateCategory(categoryId, updates) {
        return this.request(`/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteCategory(categoryId) {
        return this.request(`/categories/${categoryId}`, {
            method: 'DELETE',
        });
    }

    // Transactions
    async getTransactions(params = {}) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value) searchParams.append(key, value);
        }
        const query = searchParams.toString();
        return this.request(`/transactions${query ? '?' + query : ''}`);
    }

    async getReviewQueue(sort = 'description') {
        return this.request(`/transactions/review-queue?sort=${sort}`);
    }

    async categorize(transactionId, categoryId, createRule = false) {
        return this.request(`/transactions/${transactionId}/categorize`, {
            method: 'PUT',
            body: JSON.stringify({ category_id: categoryId, create_rule: createRule }),
        });
    }

    async upload(accountId, csvContent) {
        return this.request('/transactions/upload', {
            method: 'POST',
            body: JSON.stringify({ account_id: accountId, csv_content: csvContent }),
        });
    }

    // Status
    async getStatus() {
        return this.request('/status');
    }

    // Rules
    async getRules() {
        return this.request('/rules');
    }

    async createRule(pattern, categoryId, priority = 100, accountFilter = null) {
        return this.request('/rules', {
            method: 'POST',
            body: JSON.stringify({
                pattern,
                category_id: categoryId,
                priority,
                account_filter: accountFilter,
            }),
        });
    }

    async updateRule(ruleId, updates) {
        return this.request(`/rules/${ruleId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deleteRule(ruleId) {
        return this.request(`/rules/${ruleId}`, {
            method: 'DELETE',
        });
    }

    // Recurring
    async toggleRecurring(transactionId) {
        return this.request(`/transactions/${transactionId}/recurring`, {
            method: 'PATCH',
        });
    }

    // Explosion (one-off large purchases)
    async toggleExplosion(transactionId) {
        return this.request(`/transactions/${transactionId}/explosion`, {
            method: 'PATCH',
        });
    }

    // Burn Rate
    async getBurnRate() {
        return this.request('/burn-rate');
    }

    async getTargets() {
        return this.request('/targets');
    }

    async submitFeedback(burnRateGroup, sentiment) {
        return this.request('/feedback', {
            method: 'POST',
            body: JSON.stringify({
                burn_rate_group: burnRateGroup,
                sentiment,
            }),
        });
    }
}

// Global API instance
const api = new ApiClient();
