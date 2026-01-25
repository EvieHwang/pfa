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
     * Store categories for rules dropdown
     */
    rulesCategories: [],

    /**
     * Load categorization rules
     */
    async loadRules() {
        try {
            // Load rules and categories in parallel
            const [rulesResult, catResult] = await Promise.all([
                API.rules.list(),
                API.categories.list()
            ]);

            const rules = rulesResult.items || [];
            this.rulesCategories = catResult.items || [];

            const container = document.getElementById('rules-list');

            // Build category options for dropdowns
            const categoryOptions = this.rulesCategories.map(c =>
                `<option value="${c.id}">${c.parent_name ? c.parent_name + ' > ' : ''}${c.name}</option>`
            ).join('');

            // Build table
            let html = `
                <div class="rules-add-form hidden" id="add-rule-form">
                    <div class="rule-form-row">
                        <input type="text" id="new-rule-pattern" placeholder="Pattern to match" class="rule-input">
                        <select id="new-rule-category" class="rule-select">
                            <option value="">Select category...</option>
                            ${categoryOptions}
                        </select>
                        <input type="number" id="new-rule-priority" value="50" min="1" max="100"
                               class="rule-priority-input" title="Priority (lower = higher)">
                        <button class="btn btn-primary btn-sm" onclick="App.saveNewRule()">Save</button>
                        <button class="btn btn-ghost btn-sm" onclick="App.hideAddRuleForm()">Cancel</button>
                    </div>
                </div>
            `;

            if (rules.length === 0) {
                html += '<p style="color: var(--color-text-secondary); padding: 20px;">No rules defined. Click "Add Rule" to create one.</p>';
            } else {
                html += `
                    <table class="rules-table">
                        <thead>
                            <tr>
                                <th>Pattern</th>
                                <th>Category</th>
                                <th>Priority</th>
                                <th>Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rules.map(rule => `
                                <tr data-id="${rule.id}" class="${rule.is_active ? '' : 'inactive'}">
                                    <td class="rule-pattern-cell">
                                        <code>${this.escapeHtml(rule.pattern)}</code>
                                    </td>
                                    <td>${rule.category_name || 'Unknown'}</td>
                                    <td class="center">${rule.priority}</td>
                                    <td class="center">
                                        <input type="checkbox" class="rule-active-toggle"
                                               data-id="${rule.id}"
                                               ${rule.is_active ? 'checked' : ''}
                                               onchange="App.toggleRuleActive(${rule.id}, this.checked)">
                                    </td>
                                    <td class="actions">
                                        <button class="btn btn-ghost btn-sm" onclick="App.editRule(${rule.id})">Edit</button>
                                        <button class="btn btn-ghost btn-sm btn-danger" onclick="App.deleteRule(${rule.id})">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }

            container.innerHTML = html;

            // Update Add Rule button handler
            const addBtn = document.getElementById('add-rule-btn');
            if (addBtn) {
                addBtn.onclick = () => this.showAddRuleForm();
            }
        } catch (error) {
            console.error('Failed to load rules:', error);
        }
    },

    /**
     * Show add rule form
     */
    showAddRuleForm() {
        const form = document.getElementById('add-rule-form');
        if (form) {
            form.classList.remove('hidden');
            document.getElementById('new-rule-pattern').focus();
        }
    },

    /**
     * Hide add rule form
     */
    hideAddRuleForm() {
        const form = document.getElementById('add-rule-form');
        if (form) {
            form.classList.add('hidden');
            document.getElementById('new-rule-pattern').value = '';
            document.getElementById('new-rule-category').value = '';
            document.getElementById('new-rule-priority').value = '50';
        }
    },

    /**
     * Save new rule
     */
    async saveNewRule() {
        const pattern = document.getElementById('new-rule-pattern').value.trim();
        const categoryId = document.getElementById('new-rule-category').value;
        const priority = parseInt(document.getElementById('new-rule-priority').value) || 50;

        if (!pattern) {
            this.showToast('Pattern is required', 'error');
            return;
        }
        if (!categoryId) {
            this.showToast('Category is required', 'error');
            return;
        }

        try {
            await API.rules.create({
                pattern,
                category_id: parseInt(categoryId),
                priority
            });
            this.showToast('Rule created', 'success');
            this.hideAddRuleForm();
            this.loadRules();
        } catch (error) {
            this.showToast('Failed to create rule', 'error');
        }
    },

    /**
     * Toggle rule active status
     */
    async toggleRuleActive(id, isActive) {
        try {
            await API.rules.update(id, { is_active: isActive });
            // Update row styling
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                row.classList.toggle('inactive', !isActive);
            }
        } catch (error) {
            this.showToast('Failed to update rule', 'error');
            // Revert checkbox
            const checkbox = document.querySelector(`.rule-active-toggle[data-id="${id}"]`);
            if (checkbox) {
                checkbox.checked = !isActive;
            }
        }
    },

    /**
     * Edit rule (inline)
     */
    async editRule(id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (!row) return;

        // Get current values
        const patternCell = row.querySelector('.rule-pattern-cell');
        const currentPattern = patternCell.querySelector('code').textContent;
        const currentCategory = row.cells[1].textContent;
        const currentPriority = row.cells[2].textContent;

        // Find category ID
        const category = this.rulesCategories.find(c =>
            c.name === currentCategory || `${c.parent_name} > ${c.name}` === currentCategory
        );
        const currentCategoryId = category ? category.id : '';

        // Build category options
        const categoryOptions = this.rulesCategories.map(c =>
            `<option value="${c.id}" ${c.id === currentCategoryId ? 'selected' : ''}>
                ${c.parent_name ? c.parent_name + ' > ' : ''}${c.name}
            </option>`
        ).join('');

        // Replace row with edit form
        row.innerHTML = `
            <td><input type="text" class="edit-pattern" value="${this.escapeHtml(currentPattern)}"></td>
            <td>
                <select class="edit-category">
                    ${categoryOptions}
                </select>
            </td>
            <td><input type="number" class="edit-priority" value="${currentPriority}" min="1" max="100" style="width: 60px;"></td>
            <td></td>
            <td class="actions">
                <button class="btn btn-primary btn-sm" onclick="App.saveRuleEdit(${id})">Save</button>
                <button class="btn btn-ghost btn-sm" onclick="App.loadRules()">Cancel</button>
            </td>
        `;

        row.querySelector('.edit-pattern').focus();
    },

    /**
     * Save rule edit
     */
    async saveRuleEdit(id) {
        const row = document.querySelector(`tr[data-id="${id}"]`);
        if (!row) return;

        const pattern = row.querySelector('.edit-pattern').value.trim();
        const categoryId = row.querySelector('.edit-category').value;
        const priority = parseInt(row.querySelector('.edit-priority').value) || 50;

        if (!pattern) {
            this.showToast('Pattern is required', 'error');
            return;
        }

        try {
            await API.rules.update(id, {
                pattern,
                category_id: parseInt(categoryId),
                priority
            });
            this.showToast('Rule updated', 'success');
            this.loadRules();
        } catch (error) {
            this.showToast('Failed to update rule', 'error');
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
