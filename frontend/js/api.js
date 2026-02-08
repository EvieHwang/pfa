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

    // Transactions
    async getTransactions(params = {}) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value) searchParams.append(key, value);
        }
        const query = searchParams.toString();
        return this.request(`/transactions${query ? '?' + query : ''}`);
    }

    async getReviewQueue() {
        return this.request('/transactions/review-queue');
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
}

// Global API instance
const api = new ApiClient();
