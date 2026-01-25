/**
 * Transactions module for PFA
 */

const Transactions = {
    table: null,
    categories: [],
    currentTransaction: null,

    /**
     * Initialize transactions view
     */
    async init() {
        await this.loadCategories();
        this.setupTable();
        this.setupEventListeners();
    },

    /**
     * Load categories for dropdowns
     */
    async loadCategories() {
        try {
            const result = await API.categories.list();
            this.categories = result.items || [];
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    },

    /**
     * Setup Tabulator table
     */
    setupTable() {
        this.table = new Tabulator('#transactions-table', {
            height: '500px',
            layout: 'fitColumns',
            placeholder: 'No transactions found',
            pagination: true,
            paginationMode: 'remote',
            paginationSize: 25,
            paginationSizeSelector: [25, 50, 100],
            ajaxURL: '/api/transactions',
            ajaxConfig: {
                headers: {
                    'Authorization': `Bearer ${API.getToken()}`
                }
            },
            ajaxParams: () => this.getTableParams(),
            ajaxResponse: (url, params, response) => {
                return {
                    data: response.items || [],
                    last_page: Math.ceil(response.total / params.size)
                };
            },
            columns: [
                {
                    title: 'Date',
                    field: 'date',
                    width: 100,
                    formatter: (cell) => {
                        const date = new Date(cell.getValue() + 'T00:00:00');
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }
                },
                {
                    title: 'Account',
                    field: 'account_name',
                    width: 100
                },
                {
                    title: 'Category',
                    field: 'category_name',
                    width: 130,
                    formatter: (cell) => {
                        const value = cell.getValue();
                        if (!value) {
                            return '<span style="color: var(--color-warning);">Uncategorized</span>';
                        }
                        return value;
                    }
                },
                {
                    title: 'Description',
                    field: 'description',
                    minWidth: 200
                },
                {
                    title: 'Amount',
                    field: 'amount',
                    width: 100,
                    hozAlign: 'right',
                    formatter: (cell) => {
                        const value = cell.getValue();
                        const formatted = App.formatCurrency(Math.abs(value));
                        const color = value < 0 ? 'var(--color-negative)' : 'var(--color-positive)';
                        const sign = value < 0 ? '-' : '+';
                        return `<span style="color: ${color}">${sign}${formatted}</span>`;
                    }
                }
            ],
            rowClick: (e, row) => {
                this.showEditModal(row.getData());
            }
        });
    },

    /**
     * Get table filter params
     */
    getTableParams() {
        const params = App.getFilterParams();
        const search = document.getElementById('search-input').value;
        if (search) {
            params.search = search;
        }
        return params;
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Back to dashboard
        document.getElementById('back-to-dashboard').addEventListener('click', () => {
            this.hideView();
        });

        // Search
        let searchTimeout;
        document.getElementById('search-input').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.table.setData();
            }, 300);
        });

        // Export
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportCSV();
        });

        // Edit form
        document.getElementById('edit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTransaction();
        });
    },

    /**
     * Show transactions view
     */
    showView() {
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('transactions-view').classList.remove('hidden');

        // Refresh table data
        if (this.table) {
            this.table.setData();
        }
    },

    /**
     * Hide transactions view
     */
    hideView() {
        document.getElementById('transactions-view').classList.add('hidden');
        document.getElementById('dashboard-view').classList.remove('hidden');
        Dashboard.loadData();
    },

    /**
     * Refresh table
     */
    refresh() {
        if (this.table) {
            this.table.setData();
        }
    },

    /**
     * Show edit modal for a transaction
     */
    showEditModal(transaction) {
        this.currentTransaction = transaction;

        // Show transaction details
        const details = document.getElementById('edit-transaction-details');
        details.innerHTML = `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600;">${this.escapeHtml(transaction.description)}</div>
                <div style="color: var(--color-text-secondary); margin-top: 4px;">
                    ${transaction.date} &bull; ${transaction.account_name || ''}
                </div>
                <div style="font-size: 24px; font-weight: 600; margin-top: 8px; color: ${transaction.amount < 0 ? 'var(--color-negative)' : 'var(--color-positive)'}">
                    ${App.formatCurrency(transaction.amount)}
                </div>
            </div>
        `;

        // Populate category dropdown
        const select = document.getElementById('edit-category');
        select.innerHTML = '<option value="">Select category...</option>' +
            '<option value="__create_new__">+ Create New...</option>' +
            this.categories.map(c =>
                `<option value="${c.id}" ${c.id === transaction.category_id ? 'selected' : ''}>
                    ${c.parent_name ? c.parent_name + ' > ' : ''}${c.name}
                </option>`
            ).join('');

        // Setup listener for "+ Create New..."
        select.onchange = (e) => {
            if (e.target.value === '__create_new__') {
                e.target.value = transaction.category_id || '';
                App.showCategoryModal(null, (newCategory) => {
                    this.handleNewCategoryCreated(newCategory, select);
                });
            }
        };

        // Reset create rule checkbox
        document.getElementById('create-rule').checked = false;

        // Show modal
        document.getElementById('edit-modal').classList.remove('hidden');
    },

    /**
     * Handle new category created from edit dropdown
     */
    handleNewCategoryCreated(newCategory, selectElement) {
        // Add to local categories
        this.categories.push(newCategory);

        // Add option to dropdown
        const newOption = document.createElement('option');
        newOption.value = newCategory.id;
        newOption.textContent = newCategory.parent_name
            ? `${newCategory.parent_name} > ${newCategory.name}`
            : newCategory.name;

        // Insert after "+ Create New..."
        const createNewOption = selectElement.querySelector('option[value="__create_new__"]');
        if (createNewOption && createNewOption.nextSibling) {
            selectElement.insertBefore(newOption, createNewOption.nextSibling);
        } else {
            selectElement.appendChild(newOption);
        }

        // Select the new category
        selectElement.value = newCategory.id;
    },

    /**
     * Save transaction changes
     */
    async saveTransaction() {
        if (!this.currentTransaction) return;

        const categoryId = document.getElementById('edit-category').value;
        const createRule = document.getElementById('create-rule').checked;

        if (!categoryId) {
            App.showToast('Please select a category', 'error');
            return;
        }

        try {
            App.showLoading();

            // Update transaction
            await API.transactions.update(this.currentTransaction.id, {
                category_id: parseInt(categoryId)
            });

            // Create rule if requested
            if (createRule) {
                // Extract pattern from description (first word or first 20 chars)
                const pattern = this.currentTransaction.description.split(' ')[0].substring(0, 20).toUpperCase();
                await API.rules.create({
                    pattern: pattern,
                    category_id: parseInt(categoryId),
                    priority: 50
                });
                App.showToast('Transaction updated and rule created', 'success');
            } else {
                App.showToast('Transaction updated', 'success');
            }

            // Close modal and refresh
            document.getElementById('edit-modal').classList.add('hidden');
            this.currentTransaction = null;
            this.refresh();
        } catch (error) {
            App.showToast('Failed to save changes', 'error');
        } finally {
            App.hideLoading();
        }
    },

    /**
     * Export transactions as CSV
     */
    exportCSV() {
        const params = this.getTableParams();
        const queryString = new URLSearchParams(params).toString();
        const url = `/api/export?${queryString}`;

        // Create a link and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transactions.csv';

        // Add auth header via fetch
        fetch(url, {
            headers: {
                'Authorization': `Bearer ${API.getToken()}`
            }
        })
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            App.showToast('Export failed', 'error');
        });
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
