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
     * Render review list
     */
    renderReviewList(transactions, categories) {
        const container = document.getElementById('review-list');

        const categoryOptions = categories.map(c =>
            `<option value="${c.id}">${c.parent_name ? c.parent_name + ' > ' : ''}${c.name}</option>`
        ).join('');

        const html = transactions.map(t => `
            <div class="review-item" data-id="${t.id}" data-description="${this.escapeHtml(t.description)}">
                <div class="review-item-main">
                    <div class="review-item-info">
                        <div class="review-description">${this.escapeHtml(t.description)}</div>
                        <div class="review-details">${t.date} &bull; ${t.account_name || ''}</div>
                    </div>
                    <div class="review-amount ${t.amount < 0 ? 'negative' : 'positive'}">
                        ${App.formatCurrency(t.amount)}
                    </div>
                    <div class="review-actions">
                        <select class="review-category" data-id="${t.id}">
                            <option value="">Select category...</option>
                            ${categoryOptions}
                        </select>
                        <label class="create-rule-label">
                            <input type="checkbox" class="create-rule-checkbox" data-id="${t.id}">
                            <span>Create rule</span>
                        </label>
                    </div>
                </div>
                <div class="rule-pattern-input hidden" data-id="${t.id}">
                    <label>
                        Pattern:
                        <input type="text" class="rule-pattern" data-id="${t.id}" value="${this.escapeHtml(this.cleanPattern(t.description))}" placeholder="Pattern to match">
                    </label>
                    <span class="pattern-hint">Edit to make more general (e.g., remove reference numbers)</span>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // Setup create rule checkbox toggle
        container.querySelectorAll('.create-rule-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const patternInput = container.querySelector(`.rule-pattern-input[data-id="${id}"]`);
                patternInput.classList.toggle('hidden', !e.target.checked);
            });
        });

        // Setup save button
        document.getElementById('save-reviews').onclick = () => this.saveReviews();
    },

    /**
     * Clean a transaction description to create a pattern
     */
    cleanPattern(description) {
        if (!description) return '';
        return description
            .replace(/\s+#?\d{4,}/g, '')      // Remove long numbers (references)
            .replace(/\s+\d{1,2}\/\d{1,2}(\/\d{2,4})?/g, '')  // Remove dates
            .replace(/\s{2,}/g, ' ')           // Normalize whitespace
            .trim();
    },

    /**
     * Save review changes
     */
    async saveReviews() {
        const selects = document.querySelectorAll('.review-category');
        const updates = [];
        const createRules = [];

        selects.forEach(select => {
            if (select.value) {
                const id = select.dataset.id;
                const categoryId = parseInt(select.value);

                updates.push({
                    id: id,
                    category_id: categoryId
                });

                // Check if create rule is checked
                const checkbox = document.querySelector(`.create-rule-checkbox[data-id="${id}"]`);
                if (checkbox && checkbox.checked) {
                    const patternInput = document.querySelector(`.rule-pattern[data-id="${id}"]`);
                    const pattern = patternInput ? patternInput.value.trim() : '';
                    if (pattern) {
                        createRules.push({
                            pattern: pattern,
                            category_id: categoryId,
                            priority: 10
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
            await API.transactions.batchCategorize(updates, createRules);

            const ruleMsg = createRules.length > 0 ? ` and created ${createRules.length} rule(s)` : '';
            App.showToast(`Updated ${updates.length} transaction(s)${ruleMsg}`, 'success');

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
