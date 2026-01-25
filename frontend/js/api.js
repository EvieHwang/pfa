/**
 * API client for PFA backend
 */

const API = {
    baseUrl: '/api',

    /**
     * Get the auth token from localStorage
     */
    getToken() {
        return localStorage.getItem('pfa_token');
    },

    /**
     * Set the auth token in localStorage
     */
    setToken(token) {
        localStorage.setItem('pfa_token', token);
    },

    /**
     * Clear the auth token
     */
    clearToken() {
        localStorage.removeItem('pfa_token');
    },

    /**
     * Make an API request
     */
    async request(path, options = {}) {
        const url = this.baseUrl + path;
        const token = this.getToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle 401 - redirect to login
            if (response.status === 401) {
                this.clearToken();
                window.location.reload();
                return null;
            }

            // Handle no content
            if (response.status === 204) {
                return { success: true };
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    /**
     * GET request
     */
    async get(path, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const fullPath = queryString ? `${path}?${queryString}` : path;
        return this.request(fullPath, { method: 'GET' });
    },

    /**
     * POST request
     */
    async post(path, data) {
        return this.request(path, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    /**
     * PATCH request
     */
    async patch(path, data) {
        return this.request(path, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    },

    /**
     * DELETE request
     */
    async delete(path) {
        return this.request(path, { method: 'DELETE' });
    },

    /**
     * Upload a file
     */
    async upload(path, file, data = {}) {
        const url = this.baseUrl + path;
        const token = this.getToken();

        const formData = new FormData();
        formData.append('file', file);
        Object.entries(data).forEach(([key, value]) => {
            formData.append(key, value);
        });

        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    },

    // Auth endpoints
    auth: {
        async login(password) {
            return API.post('/auth/login', { password });
        },

        async verify() {
            return API.get('/auth/verify');
        }
    },

    // Dashboard endpoints
    dashboard: {
        async get(params = {}) {
            return API.get('/dashboard', params);
        }
    },

    // Transactions endpoints
    transactions: {
        async list(params = {}) {
            return API.get('/transactions', params);
        },

        async get(id) {
            return API.get(`/transactions/${id}`);
        },

        async update(id, data) {
            return API.patch(`/transactions/${id}`, data);
        },

        async upload(file, accountId) {
            return API.upload('/transactions/upload', file, { account_id: accountId });
        },

        async getReviewQueue(limit = 50) {
            return API.get('/transactions/review', { limit });
        },

        async batchCategorize(updates, createRules = []) {
            return API.post('/transactions/review/batch', { updates, create_rules: createRules });
        }
    },

    // Categories endpoints
    categories: {
        async list() {
            return API.get('/categories');
        },

        async create(data) {
            return API.post('/categories', data);
        },

        async update(id, data) {
            return API.patch(`/categories/${id}`, data);
        },

        async delete(id) {
            return API.delete(`/categories/${id}`);
        }
    },

    // Rules endpoints
    rules: {
        async list() {
            return API.get('/rules');
        },

        async create(data) {
            return API.post('/rules', data);
        },

        async update(id, data) {
            return API.patch(`/rules/${id}`, data);
        },

        async delete(id) {
            return API.delete(`/rules/${id}`);
        }
    },

    // Budgets endpoints
    budgets: {
        async list(month = null) {
            const params = month ? { month } : {};
            return API.get('/budgets', params);
        },

        async upsert(data) {
            return API.post('/budgets', data);
        },

        async delete(id) {
            return API.delete(`/budgets/${id}`);
        }
    },

    // Accounts endpoints
    accounts: {
        async list() {
            return API.get('/accounts');
        }
    }
};
