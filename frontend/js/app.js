/**
 * Main application module for PFA
 */

const App = {
    initialized: false,

    /**
     * Initialize the application
     */
    async init() {
        if (this.initialized) return;
        this.initialized = true;

        this.setupEventListeners();
        this.setupFilters();
        this.setupModals();

        // Initialize modules
        await Transactions.init();
        Upload.init();

        // Load dashboard
        await Dashboard.init();
    },

    /**
     * Setup global event listeners
     */
    setupEventListeners() {
        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        // Settings tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                this.switchTab(tabId);
            });
        });
    },

    /**
     * Setup filters
     */
    setupFilters() {
        const periodFilter = document.getElementById('period-filter');
        const accountFilter = document.getElementById('account-filter');
        const customRange = document.getElementById('custom-date-range');
        const startDate = document.getElementById('start-date');
        const endDate = document.getElementById('end-date');

        // Period filter change
        periodFilter.addEventListener('change', () => {
            if (periodFilter.value === 'custom') {
                customRange.classList.remove('hidden');
            } else {
                customRange.classList.add('hidden');
                Dashboard.loadData();
            }
        });

        // Account filter change
        accountFilter.addEventListener('change', () => {
            Dashboard.loadData();
        });

        // Custom date changes
        startDate.addEventListener('change', () => {
            if (startDate.value && endDate.value) {
                Dashboard.loadData();
            }
        });

        endDate.addEventListener('change', () => {
            if (startDate.value && endDate.value) {
                Dashboard.loadData();
            }
        });

        // Set default dates
        const today = new Date();
        endDate.value = today.toISOString().split('T')[0];
        startDate.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    },

    /**
     * Setup modal close buttons
     */
    setupModals() {
        // Close buttons
        document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.dataset.modal;
                if (modalId) {
                    document.getElementById(modalId).classList.add('hidden');
                }
            });
        });

        // Click outside to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    },

    /**
     * Get filter parameters
     */
    getFilterParams() {
        const periodFilter = document.getElementById('period-filter').value;
        const accountFilter = document.getElementById('account-filter').value;
        const params = {};

        // Calculate date range
        const today = new Date();
        let startDate, endDate;

        switch (periodFilter) {
            case 'this-month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = today;
                break;
            case 'last-month':
                startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'last-3-months':
                startDate = new Date(today.getFullYear(), today.getMonth() - 2, 1);
                endDate = today;
                break;
            case 'ytd':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = today;
                break;
            case 'custom':
                const start = document.getElementById('start-date').value;
                const end = document.getElementById('end-date').value;
                if (start) params.start_date = start;
                if (end) params.end_date = end;
                if (accountFilter) params.account_id = accountFilter;
                return params;
        }

        params.start_date = startDate.toISOString().split('T')[0];
        params.end_date = endDate.toISOString().split('T')[0];

        if (accountFilter) {
            params.account_id = accountFilter;
        }

        return params;
    },

    /**
     * Show settings modal
     */
    async showSettings() {
        document.getElementById('settings-modal').classList.remove('hidden');
        await this.loadRules();
    },

    /**
     * Switch settings tab
     */
    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== tabId);
            content.classList.toggle('active', content.id === tabId);
        });

        // Load content
        switch (tabId) {
            case 'rules-tab':
                this.loadRules();
                break;
            case 'budgets-tab':
                this.loadBudgets();
                break;
            case 'categories-tab':
                this.loadCategories();
                break;
        }
    },

    /**
     * Load categorization rules
     */
    async loadRules() {
        try {
            const result = await API.rules.list();
            const rules = result.items || [];

            const container = document.getElementById('rules-list');
            if (rules.length === 0) {
                container.innerHTML = '<p style="color: var(--color-text-secondary); padding: 20px;">No rules defined</p>';
                return;
            }

            container.innerHTML = rules.map(rule => `
                <div class="rule-item">
                    <div class="rule-info">
                        <span class="rule-pattern">${this.escapeHtml(rule.pattern)}</span>
                        <span class="rule-category"> &rarr; ${rule.category_name}</span>
                        <span style="color: var(--color-text-secondary); font-size: 12px;"> (priority: ${rule.priority})</span>
                    </div>
                    <div class="rule-actions">
                        <button class="btn btn-ghost" onclick="App.deleteRule(${rule.id})">Delete</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load rules:', error);
        }
    },

    /**
     * Delete a rule
     */
    async deleteRule(id) {
        if (!confirm('Delete this rule?')) return;

        try {
            await API.rules.delete(id);
            this.showToast('Rule deleted', 'success');
            this.loadRules();
        } catch (error) {
            this.showToast('Failed to delete rule', 'error');
        }
    },

    /**
     * Load budgets
     */
    async loadBudgets() {
        try {
            const result = await API.budgets.list();
            const budgets = result.items || [];

            const container = document.getElementById('budgets-list');
            if (budgets.length === 0) {
                container.innerHTML = '<p style="color: var(--color-text-secondary); padding: 20px;">No budgets set</p>';
                return;
            }

            container.innerHTML = budgets.map(budget => {
                const overBudget = budget.percent_used > 100;
                return `
                    <div class="budget-item">
                        <div class="budget-info">
                            <div class="budget-category">${budget.category_name}</div>
                        </div>
                        <div class="budget-progress">
                            <div class="progress-bar">
                                <div class="progress-fill ${overBudget ? 'over-budget' : ''}"
                                     style="width: ${Math.min(budget.percent_used, 100)}%"></div>
                            </div>
                            <div class="progress-text">
                                ${this.formatCurrency(budget.actual_spent)} / ${this.formatCurrency(budget.budget_amount)}
                                (${budget.percent_used.toFixed(1)}%)
                            </div>
                        </div>
                        <div class="budget-actions">
                            <button class="btn btn-ghost" onclick="App.deleteBudget(${budget.id})">Delete</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Failed to load budgets:', error);
        }
    },

    /**
     * Delete a budget
     */
    async deleteBudget(id) {
        if (!confirm('Delete this budget?')) return;

        try {
            await API.budgets.delete(id);
            this.showToast('Budget deleted', 'success');
            this.loadBudgets();
        } catch (error) {
            this.showToast('Failed to delete budget', 'error');
        }
    },

    /**
     * Load categories
     */
    async loadCategories() {
        try {
            const result = await API.categories.list();
            const categories = result.items || [];

            const container = document.getElementById('categories-list');
            container.innerHTML = categories.map(cat => `
                <div class="category-item">
                    <div>
                        ${cat.parent_name ? '<span style="color: var(--color-text-secondary);">' + cat.parent_name + ' &gt; </span>' : ''}
                        <span>${cat.name}</span>
                        <span style="color: var(--color-text-secondary); font-size: 12px;"> (${cat.category_type})</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    },

    /**
     * Format currency
     */
    formatCurrency(value, compact = false) {
        const absValue = Math.abs(value);
        if (compact && absValue >= 1000) {
            return '$' + (absValue / 1000).toFixed(1) + 'k';
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(absValue);
    },

    /**
     * Show loading overlay
     */
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    /**
     * Escape HTML
     */
    escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
};
