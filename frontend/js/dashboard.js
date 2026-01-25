/**
 * Dashboard module for PFA
 */

const Dashboard = {
    categoryChart: null,
    trendChart: null,
    data: null,

    /**
     * Initialize the dashboard
     */
    async init() {
        await this.loadData();
        this.setupEventListeners();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Review card click
        document.getElementById('review-card').addEventListener('click', () => {
            this.showReviewModal();
        });

        // View all transactions
        document.getElementById('view-all-transactions').addEventListener('click', (e) => {
            e.preventDefault();
            Transactions.showView();
        });
    },

    /**
     * Load dashboard data
     */
    async loadData() {
        try {
            App.showLoading();
            const params = App.getFilterParams();
            this.data = await API.dashboard.get(params);
            this.render();
        } catch (error) {
            App.showToast('Failed to load dashboard', 'error');
            console.error('Dashboard load error:', error);
        } finally {
            App.hideLoading();
        }
    },

    /**
     * Render the dashboard
     */
    render() {
        if (!this.data) return;

        this.renderSummaryCards();
        this.renderCategoryChart();
        this.renderTrendChart();
        this.renderRecentTransactions();
    },

    /**
     * Render summary cards
     */
    renderSummaryCards() {
        const { summary } = this.data;

        // Net worth
        document.getElementById('net-worth').textContent = App.formatCurrency(summary.net_worth);
        const netWorthChange = document.getElementById('net-worth-change');
        if (summary.net_worth_change !== 0) {
            const changeClass = summary.net_worth_change > 0 ? 'positive' : 'negative';
            const changeSign = summary.net_worth_change > 0 ? '+' : '';
            netWorthChange.textContent = `${changeSign}${App.formatCurrency(summary.net_worth_change)} this period`;
            netWorthChange.className = `card-change ${changeClass}`;
        } else {
            netWorthChange.textContent = '';
        }

        // Monthly spending
        document.getElementById('monthly-spending').textContent = App.formatCurrency(summary.monthly_spending);
        const spendingChange = document.getElementById('spending-change');
        if (summary.previous_month_spending > 0) {
            const diff = summary.monthly_spending - summary.previous_month_spending;
            const changeClass = diff > 0 ? 'negative' : 'positive';
            const changeSign = diff > 0 ? '+' : '';
            spendingChange.textContent = `${changeSign}${App.formatCurrency(diff)} vs last period`;
            spendingChange.className = `card-change ${changeClass}`;
        } else {
            spendingChange.textContent = '';
        }

        // Top category
        document.getElementById('top-category').textContent = summary.top_category || '-';
        document.getElementById('top-category-amount').textContent =
            summary.top_category ? App.formatCurrency(summary.top_category_amount) : '';

        // Review count
        document.getElementById('review-count').textContent = summary.pending_review_count;
    },

    /**
     * Render spending by category chart
     */
    renderCategoryChart() {
        const ctx = document.getElementById('category-chart').getContext('2d');
        const categories = this.data.spending_by_category || [];

        // Destroy existing chart
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        if (categories.length === 0) {
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#64748B';
            ctx.textAlign = 'center';
            ctx.fillText('No spending data', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const colors = [
            '#3B82F6', '#22C55E', '#EF4444', '#F59E0B', '#8B5CF6',
            '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
        ];

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categories.map(c => c.category_name),
                datasets: [{
                    data: categories.map(c => c.amount),
                    backgroundColor: colors.slice(0, categories.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            padding: 16
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const value = App.formatCurrency(context.raw);
                                const pct = categories[context.dataIndex].percentage;
                                return `${context.label}: ${value} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Render monthly trend chart
     */
    renderTrendChart() {
        const ctx = document.getElementById('trend-chart').getContext('2d');
        const trend = this.data.monthly_trend || [];

        // Destroy existing chart
        if (this.trendChart) {
            this.trendChart.destroy();
        }

        if (trend.length === 0) {
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#64748B';
            ctx.textAlign = 'center';
            ctx.fillText('No trend data', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trend.map(t => t.month),
                datasets: [
                    {
                        label: 'Income',
                        data: trend.map(t => t.income),
                        borderColor: '#22C55E',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'Expenses',
                        data: trend.map(t => t.expenses),
                        borderColor: '#EF4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.dataset.label}: ${App.formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => App.formatCurrency(value, true)
                        }
                    }
                }
            }
        });
    },

    /**
     * Render recent transactions
     */
    renderRecentTransactions() {
        const container = document.getElementById('recent-transactions');
        const transactions = this.data.recent_transactions || [];

        if (transactions.length === 0) {
            container.innerHTML = '<p style="color: var(--color-text-secondary); padding: 20px;">No recent transactions</p>';
            return;
        }

        const html = transactions.map(t => `
            <div class="review-item" data-id="${t.id}">
                <div>
                    <div class="review-description">${this.escapeHtml(t.description)}</div>
                    <div class="review-details">${t.date} &bull; ${t.account_name || ''} &bull; ${t.category_name || 'Uncategorized'}</div>
                </div>
                <div class="review-amount ${t.amount < 0 ? 'negative' : 'positive'}">
                    ${App.formatCurrency(t.amount)}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    },

    /**
     * Show review modal
     */
    async showReviewModal() {
        try {
            App.showLoading();
            const result = await API.transactions.getReviewQueue();
            const transactions = result.items || [];

            if (transactions.length === 0) {
                App.showToast('No transactions to review', 'info');
                return;
            }

            // Get categories for dropdown
            const catResult = await API.categories.list();
            const categories = catResult.items || [];

            this.renderReviewList(transactions, categories);
            document.getElementById('review-modal').classList.remove('hidden');
        } catch (error) {
            App.showToast('Failed to load review queue', 'error');
        } finally {
            App.hideLoading();
        }
    },

    /**
     * Suggest a pattern from transaction description
     */
    suggestPattern(description) {
        if (!description) return '';

        const excludeWords = new Set([
            'THE', 'AND', 'OR', 'OF', 'IN', 'AT', 'TO', 'FOR', 'A', 'AN',
            'LLC', 'INC', 'CORP', 'LTD', 'DES', 'ID', 'CO', 'COMPANY',
            'PURCHASE', 'PAYMENT', 'DEBIT', 'CREDIT', 'CARD', 'ONLINE',
            'ACH', 'TRANSFER', 'WITHDRAWAL', 'DEPOSIT', 'CHECK', 'FEE'
        ]);

        const words = description.toUpperCase().split(/\s+/);
        const meaningful = words.filter(w =>
            !excludeWords.has(w) && w.length > 2 && !/^\d+$/.test(w) && !/^#/.test(w)
        );

        if (meaningful.length === 0) {
            return words[0] || description.slice(0, 20);
        }

        // Return first meaningful word, or first two if very short
        if (meaningful[0].length < 5 && meaningful.length > 1) {
            return meaningful.slice(0, 2).join(' ');
        }
        return meaningful[0];
    },

    /**
     * Store categories for the review modal
     */
    reviewCategories: [],

    /**
     * Render review list
     */
    renderReviewList(transactions, categories) {
        const container = document.getElementById('review-list');
        this.reviewCategories = categories;

        const categoryOptions = categories.map(c =>
            `<option value="${c.id}">${c.parent_name ? c.parent_name + ' > ' : ''}${c.name}</option>`
        ).join('');

        const html = transactions.map(t => {
            const suggestedPattern = this.suggestPattern(t.description);
            return `
            <div class="review-item" data-id="${t.id}" data-description="${this.escapeHtml(t.description)}">
                <div class="review-item-main">
                    <div class="review-item-info">
                        <div class="review-description">${this.escapeHtml(t.description)}</div>
                        <div class="review-details">${t.date} &bull; ${t.account_name || ''}</div>
                    </div>
                    <div class="review-amount ${t.amount < 0 ? 'negative' : 'positive'}">
                        ${App.formatCurrency(t.amount)}
                    </div>
                    <select class="review-category" data-id="${t.id}">
                        <option value="">Select category...</option>
                        <option value="__create_new__">+ Create New...</option>
                        ${categoryOptions}
                    </select>
                </div>
                <div class="review-item-rule">
                    <label class="checkbox-label">
                        <input type="checkbox" class="create-rule-checkbox" data-id="${t.id}">
                        Create rule for similar transactions
                    </label>
                    <div class="rule-fields hidden">
                        <div class="rule-field">
                            <label>Pattern:</label>
                            <input type="text" class="rule-pattern" data-id="${t.id}"
                                   value="${this.escapeHtml(suggestedPattern)}"
                                   placeholder="Text to match">
                        </div>
                        <div class="rule-field">
                            <label>Priority:</label>
                            <input type="number" class="rule-priority" data-id="${t.id}"
                                   value="50" min="1" max="100" title="Lower = higher priority">
                        </div>
                    </div>
                </div>
            </div>
        `}).join('');

        container.innerHTML = html;

        // Setup checkbox listeners to show/hide rule fields
        container.querySelectorAll('.create-rule-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const ruleFields = e.target.closest('.review-item-rule').querySelector('.rule-fields');
                ruleFields.classList.toggle('hidden', !e.target.checked);
            });
        });

        // Setup category dropdown listeners for "+ Create New..."
        container.querySelectorAll('.review-category').forEach(select => {
            select.addEventListener('change', (e) => {
                if (e.target.value === '__create_new__') {
                    // Reset selection while creating
                    e.target.value = '';
                    // Show category modal with callback
                    App.showCategoryModal(null, (newCategory) => {
                        this.handleNewCategoryCreated(newCategory, e.target);
                    });
                }
            });
        });

        // Setup save button
        document.getElementById('save-reviews').onclick = () => this.saveReviews();
    },

    /**
     * Handle new category created from dropdown
     */
    handleNewCategoryCreated(newCategory, selectElement) {
        // Add the new category to our local list
        this.reviewCategories.push(newCategory);

        // Update all dropdowns in the review modal
        const allSelects = document.querySelectorAll('.review-category');
        allSelects.forEach(select => {
            // Add the new option before the existing options (after "+ Create New...")
            const newOption = document.createElement('option');
            newOption.value = newCategory.id;
            newOption.textContent = newCategory.parent_name
                ? `${newCategory.parent_name} > ${newCategory.name}`
                : newCategory.name;

            // Insert after the "+ Create New..." option
            const createNewOption = select.querySelector('option[value="__create_new__"]');
            if (createNewOption && createNewOption.nextSibling) {
                select.insertBefore(newOption, createNewOption.nextSibling);
            } else {
                select.appendChild(newOption);
            }
        });

        // Select the new category in the dropdown that triggered creation
        if (selectElement) {
            selectElement.value = newCategory.id;
        }
    },

    /**
     * Save review changes
     */
    async saveReviews() {
        const reviewItems = document.querySelectorAll('.review-item');
        const updates = [];
        const rulesToCreate = [];

        reviewItems.forEach(item => {
            const id = item.dataset.id;
            const categorySelect = item.querySelector('.review-category');
            const createRuleCheckbox = item.querySelector('.create-rule-checkbox');
            const patternInput = item.querySelector('.rule-pattern');
            const priorityInput = item.querySelector('.rule-priority');

            if (categorySelect.value) {
                const categoryId = parseInt(categorySelect.value);
                updates.push({ id, category_id: categoryId });

                // Check if rule creation is requested
                if (createRuleCheckbox && createRuleCheckbox.checked) {
                    const pattern = patternInput ? patternInput.value.trim() : '';
                    const priority = priorityInput ? parseInt(priorityInput.value) || 50 : 50;

                    if (pattern) {
                        rulesToCreate.push({
                            pattern,
                            category_id: categoryId,
                            priority
                        });
                    }
                }
            }
        });

        if (updates.length === 0) {
            App.showToast('No changes to save', 'info');
            return;
        }

        try {
            App.showLoading();

            // Batch categorize transactions
            await API.transactions.batchCategorize(updates);

            // Create rules
            let rulesCreated = 0;
            for (const rule of rulesToCreate) {
                try {
                    await API.rules.create(rule);
                    rulesCreated++;
                } catch (err) {
                    console.error('Failed to create rule:', rule, err);
                }
            }

            // Build success message
            let message = `Updated ${updates.length} transaction${updates.length > 1 ? 's' : ''}`;
            if (rulesCreated > 0) {
                message += `, created ${rulesCreated} rule${rulesCreated > 1 ? 's' : ''}`;
            }
            App.showToast(message, 'success');

            document.getElementById('review-modal').classList.add('hidden');
            await this.loadData();
        } catch (error) {
            App.showToast('Failed to save changes', 'error');
        } finally {
            App.hideLoading();
        }
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
