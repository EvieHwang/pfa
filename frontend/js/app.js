/**
 * Burn Rate - Main Application
 */

// State
let accounts = [];
let categories = [];
let transactionsTable = null;
let foodChart = null;
let discretionaryChart = null;

// DOM Elements
const loginModal = document.getElementById('login-modal');
const app = document.getElementById('app');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const uploadModal = document.getElementById('upload-modal');
const uploadForm = document.getElementById('upload-form');
const uploadStatus = document.getElementById('upload-status');
const reviewBadge = document.getElementById('review-badge');
const loading = document.getElementById('loading');
const ruleModal = document.getElementById('rule-modal');
const ruleForm = document.getElementById('rule-form');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    if (api.isAuthenticated()) {
        try {
            await loadInitialData();
            showApp();
        } catch (e) {
            api.logout();
            showLogin();
        }
    } else {
        showLogin();
    }
    setupEventListeners();
}

function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Navigation tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Upload modal
    document.getElementById('upload-btn').addEventListener('click', () => showModal('upload-modal'));
    uploadForm.addEventListener('submit', handleUpload);

    // Rule modal
    document.getElementById('add-rule-btn').addEventListener('click', () => {
        document.getElementById('rule-modal-title').textContent = 'Add Rule';
        document.getElementById('rule-id').value = '';
        ruleForm.reset();
        populateRuleCategoryDropdown();
        showModal('rule-modal');
    });
    ruleForm.addEventListener('submit', handleSaveRule);

    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => hideModal(btn.dataset.close));
    });

    // Filters
    document.getElementById('account-filter').addEventListener('change', loadTransactions);
    document.getElementById('category-filter').addEventListener('change', loadTransactions);
    document.getElementById('start-date').addEventListener('change', loadTransactions);
    document.getElementById('end-date').addEventListener('change', loadTransactions);

    // Feedback buttons
    document.querySelectorAll('.feedback-buttons button').forEach(btn => {
        btn.addEventListener('click', handleFeedback);
    });

    // Review queue sort
    document.getElementById('review-sort').addEventListener('change', loadReviewQueue);
}

// Auth
async function handleLogin(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    showLoading();
    try {
        await api.login(password);
        await loadInitialData();
        showApp();
        loginError.classList.add('hidden');
    } catch (error) {
        loginError.textContent = error.message || 'Login failed';
        loginError.classList.remove('hidden');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    api.logout();
    showLogin();
}

function showLogin() {
    loginModal.classList.remove('hidden');
    app.classList.add('hidden');
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
}

function showApp() {
    loginModal.classList.add('hidden');
    app.classList.remove('hidden');
    switchView('dashboard');
}

// Data loading
async function loadInitialData() {
    const [accountsData, categoriesData, statusData] = await Promise.all([
        api.getAccounts(),
        api.getCategories(),
        api.getStatus(),
    ]);

    accounts = accountsData.accounts;
    categories = categoriesData.categories;

    populateAccountDropdowns();
    populateCategoryDropdowns();
    updateReviewBadge(statusData.pending_review_count);
}

function populateAccountDropdowns() {
    const selects = [
        document.getElementById('account-select'),
        document.getElementById('account-filter'),
    ];

    selects.forEach(select => {
        const firstOption = select.options[0];
        select.innerHTML = '';
        select.appendChild(firstOption);

        accounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = account.name;
            select.appendChild(option);
        });
    });
}

function populateCategoryDropdowns() {
    const select = document.getElementById('category-filter');
    const firstOption = select.options[0];
    select.innerHTML = '';
    select.appendChild(firstOption);

    // Flat list of categories
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

function populateRuleCategoryDropdown() {
    const select = document.getElementById('rule-category');
    select.innerHTML = '<option value="">Select category...</option>';

    // Flat list of categories
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.name;
        select.appendChild(option);
    });
}

function updateReviewBadge(count) {
    if (count > 0) {
        reviewBadge.textContent = count;
        reviewBadge.classList.remove('hidden');
    } else {
        reviewBadge.classList.add('hidden');
    }
}

// Views
function switchView(viewName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(`${viewName}-view`).classList.remove('hidden');

    if (viewName === 'dashboard') {
        loadDashboard();
    } else if (viewName === 'transactions') {
        loadTransactions();
    } else if (viewName === 'review') {
        loadReviewQueue();
    } else if (viewName === 'rules') {
        loadRules();
    } else if (viewName === 'categories') {
        loadCategories();
    }
}

// Dashboard with Burn Rate
async function loadDashboard() {
    showLoading();
    try {
        const data = await api.getBurnRate();
        renderBurnRateCard('food', data.food);
        renderBurnRateCard('discretionary', data.discretionary);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderBurnRateCard(group, data) {
    // Update stats
    document.getElementById(`${group}-current`).textContent = `$${data.current_14day.toFixed(0)}/day`;
    document.getElementById(`${group}-target`).textContent = `$${data.target.toFixed(0)}/day`;

    // Update arrow
    const arrow = document.getElementById(`${group}-arrow`);
    arrow.className = `arrow ${data.arrow}`;

    // Render chart
    const ctx = document.getElementById(`${group}-chart`).getContext('2d');
    const chartInstance = group === 'food' ? foodChart : discretionaryChart;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = data.curve.map(p => `${p.window}d`);
    const values = data.curve.map(p => p.daily_rate);
    const targetLine = data.curve.map(() => data.target);

    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Burn Rate',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                },
                {
                    label: 'Target',
                    data: targetLine,
                    borderColor: '#22c55e',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
            },
            scales: {
                x: {
                    grid: { color: '#262626' },
                    ticks: { color: '#737373' },
                },
                y: {
                    grid: { color: '#262626' },
                    ticks: {
                        color: '#737373',
                        callback: v => `$${v}`,
                    },
                },
            },
        },
    });

    if (group === 'food') {
        foodChart = newChart;
    } else {
        discretionaryChart = newChart;
    }
}

async function handleFeedback(e) {
    const group = e.target.dataset.group;
    const sentiment = e.target.dataset.sentiment;

    showLoading();
    try {
        const result = await api.submitFeedback(group, sentiment);
        if (result.new_target) {
            showToast(`Target updated to $${result.new_target}/day`, 'success');
        } else {
            showToast('Feedback recorded', 'success');
        }
        await loadDashboard();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Transactions
async function loadTransactions() {
    const params = {
        account_id: document.getElementById('account-filter').value,
        category_id: document.getElementById('category-filter').value,
        start_date: document.getElementById('start-date').value,
        end_date: document.getElementById('end-date').value,
    };

    showLoading();
    try {
        const data = await api.getTransactions(params);
        renderTransactionsTable(data.transactions);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderTransactionsTable(transactions) {
    const container = document.getElementById('transactions-table');

    if (transactionsTable) {
        transactionsTable.destroy();
    }

    transactionsTable = new Tabulator(container, {
        data: transactions,
        layout: 'fitColumns',
        height: 'calc(100vh - 220px)',
        rowFormatter: (row) => {
            const data = row.getData();
            const el = row.getElement();
            // Highlight uncategorized rows
            if (!data.category_id) {
                el.classList.add('uncategorized-row');
            } else {
                el.classList.remove('uncategorized-row');
            }
            // Dim explosion rows
            if (data.is_explosion) {
                el.classList.add('explosion-row');
            } else {
                el.classList.remove('explosion-row');
            }
        },
        columns: [
            { title: 'Date', field: 'date', width: 100 },
            { title: 'Description', field: 'description', widthGrow: 3 },
            {
                title: 'Amount',
                field: 'amount',
                width: 100,
                hozAlign: 'right',
                formatter: (cell) => {
                    const val = cell.getValue();
                    const formatted = '$' + Math.abs(val).toFixed(2);
                    const color = val < 0 ? '#ef4444' : '#22c55e';
                    return `<span style="color: ${color}">${val < 0 ? '-' : '+'}${formatted}</span>`;
                }
            },
            {
                title: 'Category',
                field: 'category_id',
                width: 140,
                formatter: (cell) => {
                    const data = cell.getRow().getData();
                    const catId = data.category_id;
                    let html = `<select class="inline-category-select" data-txn-id="${data.id}">`;
                    html += '<option value="">Uncategorized</option>';
                    html += renderCategoryOptions();
                    html += '</select>';
                    return html;
                },
                cellRendered: (cell) => {
                    const select = cell.getElement().querySelector('.inline-category-select');
                    if (select) {
                        const data = cell.getRow().getData();
                        select.value = data.category_id ? String(data.category_id) : '';
                        select.addEventListener('change', async (e) => {
                            const txnId = parseInt(e.target.dataset.txnId);
                            const categoryId = e.target.value ? parseInt(e.target.value) : null;
                            try {
                                await api.categorize(txnId, categoryId, false);
                                data.category_id = categoryId;
                                data.category_name = categoryId ? categories.find(c => c.id === categoryId)?.name : null;
                                cell.getRow().update(data);
                                showToast('Category updated', 'success');
                            } catch (error) {
                                showToast(error.message, 'error');
                            }
                        });
                    }
                }
            },
            { title: 'Account', field: 'account_name', width: 120 },
            {
                title: 'Flags',
                field: 'is_explosion',
                width: 80,
                hozAlign: 'center',
                formatter: (cell) => {
                    const data = cell.getRow().getData();
                    const explosionClass = data.is_explosion ? 'active' : '';
                    const recurringClass = data.is_recurring ? 'active' : '';
                    return `<span class="flag-btn explosion-flag ${explosionClass}" title="Explosion (one-off)">💥</span>
                            <span class="flag-btn recurring-flag ${recurringClass}" title="Recurring">🔄</span>`;
                },
                cellClick: async (e, cell) => {
                    const target = e.target;
                    const data = cell.getRow().getData();

                    if (target.classList.contains('explosion-flag')) {
                        try {
                            const result = await api.toggleExplosion(data.id);
                            data.is_explosion = result.is_explosion;
                            cell.getRow().update(data);
                            showToast(result.is_explosion ? 'Marked as explosion' : 'Unmarked explosion', 'success');
                        } catch (error) {
                            showToast(error.message, 'error');
                        }
                    } else if (target.classList.contains('recurring-flag')) {
                        try {
                            const result = await api.toggleRecurring(data.id);
                            data.is_recurring = result.is_recurring;
                            cell.getRow().update(data);
                            showToast(result.is_recurring ? 'Marked as recurring' : 'Unmarked recurring', 'success');
                        } catch (error) {
                            showToast(error.message, 'error');
                        }
                    }
                }
            },
        ],
    });
}

// Review Queue
async function loadReviewQueue() {
    const sort = document.getElementById('review-sort').value;
    showLoading();
    try {
        const data = await api.getReviewQueue(sort);
        renderReviewList(data.transactions);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderReviewList(transactions) {
    const container = document.getElementById('review-list');

    if (transactions.length === 0) {
        container.innerHTML = '<div class="dashboard-placeholder"><p>No transactions to review!</p></div>';
        return;
    }

    container.innerHTML = transactions.map(txn => `
        <div class="review-item" data-id="${txn.id}">
            <div class="review-item-info">
                <div class="review-item-date">${txn.date} &middot; ${txn.account_name}</div>
                <div class="review-item-desc">${escapeHtml(txn.description)}</div>
            </div>
            <div class="review-item-amount ${txn.amount < 0 ? 'negative' : 'positive'}">
                ${txn.amount < 0 ? '-' : '+'}$${Math.abs(txn.amount).toFixed(2)}
            </div>
            <select class="category-select">
                <option value="">Select category...</option>
                ${renderCategoryOptions()}
            </select>
        </div>
    `).join('');

    container.querySelectorAll('.category-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const item = e.target.closest('.review-item');
            const txnId = item.dataset.id;
            const categoryId = e.target.value;

            if (!categoryId) return;

            try {
                const result = await api.categorize(parseInt(txnId), parseInt(categoryId), true);

                // Always reload the review queue to show updated state
                if (result.auto_categorized > 0) {
                    showToast(`Categorized! ${result.auto_categorized} similar transactions also updated.`, 'success');
                } else {
                    showToast('Categorized!', 'success');
                }

                // Reload to refresh the list
                await loadReviewQueue();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    });
}

function renderCategoryOptions() {
    // Flat list of categories - no optgroups needed
    let html = '';
    categories.forEach(cat => {
        html += `<option value="${cat.id}">${cat.name}</option>`;
    });
    return html;
}

// Rules
async function loadRules() {
    showLoading();
    try {
        const data = await api.getRules();
        renderRulesList(data.rules);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderRulesList(rules) {
    const container = document.getElementById('rules-list');

    if (rules.length === 0) {
        container.innerHTML = '<div class="dashboard-placeholder"><p>No rules yet. Add one above!</p></div>';
        return;
    }

    container.innerHTML = rules.map(rule => `
        <div class="rule-item" data-id="${rule.id}">
            <div class="rule-item-info">
                <span class="rule-item-pattern">${escapeHtml(rule.pattern)}</span>
                <div class="rule-item-category">→ ${rule.category_name} (priority: ${rule.priority})</div>
            </div>
            <div class="rule-item-actions">
                <button class="btn btn-ghost edit-rule-btn">Edit</button>
                <button class="btn btn-ghost delete-rule-btn" style="color: var(--danger)">Delete</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.edit-rule-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.target.closest('.rule-item');
            const rule = rules.find(r => r.id === parseInt(item.dataset.id));
            openEditRuleModal(rule);
        });
    });

    container.querySelectorAll('.delete-rule-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const item = e.target.closest('.rule-item');
            const ruleId = parseInt(item.dataset.id);

            if (confirm('Delete this rule?')) {
                try {
                    await api.deleteRule(ruleId);
                    item.remove();
                    showToast('Rule deleted', 'success');
                } catch (error) {
                    showToast(error.message, 'error');
                }
            }
        });
    });
}

function openEditRuleModal(rule) {
    document.getElementById('rule-modal-title').textContent = 'Edit Rule';
    document.getElementById('rule-id').value = rule.id;
    document.getElementById('rule-pattern').value = rule.pattern;
    document.getElementById('rule-priority').value = rule.priority;
    populateRuleCategoryDropdown();
    document.getElementById('rule-category').value = rule.category_id;
    showModal('rule-modal');
}

async function handleSaveRule(e) {
    e.preventDefault();

    const ruleId = document.getElementById('rule-id').value;
    const pattern = document.getElementById('rule-pattern').value;
    const categoryId = parseInt(document.getElementById('rule-category').value);
    const priority = parseInt(document.getElementById('rule-priority').value);

    showLoading();
    try {
        if (ruleId) {
            await api.updateRule(parseInt(ruleId), { pattern, category_id: categoryId, priority });
            showToast('Rule updated', 'success');
        } else {
            await api.createRule(pattern, categoryId, priority);
            showToast('Rule created', 'success');
        }
        hideModal('rule-modal');
        await loadRules();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Upload
async function handleUpload(e) {
    e.preventDefault();

    const accountId = document.getElementById('account-select').value;
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];

    if (!accountId || !file) {
        showToast('Please select an account and file', 'error');
        return;
    }

    showLoading();
    try {
        const csvContent = await file.text();
        const result = await api.upload(parseInt(accountId), csvContent);

        uploadStatus.innerHTML = `
            <div><strong>${result.new_count}</strong> new transactions imported</div>
            <div><strong>${result.duplicate_count}</strong> duplicates skipped</div>
            <div><strong>${result.categorized_count}</strong> auto-categorized</div>
            <div><strong>${result.needs_review_count}</strong> need review</div>
        `;
        uploadStatus.classList.remove('hidden', 'error');
        uploadStatus.classList.add('success');

        updateReviewBadge(result.needs_review_count);
        uploadForm.reset();
        showToast('Upload successful!', 'success');
    } catch (error) {
        uploadStatus.textContent = error.message;
        uploadStatus.classList.remove('hidden', 'success');
        uploadStatus.classList.add('error');
    } finally {
        hideLoading();
    }
}

// Modals
function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function hideModal(id) {
    document.getElementById(id).classList.add('hidden');
    if (id === 'upload-modal') {
        uploadStatus.classList.add('hidden');
    }
}

// Loading
function showLoading() {
    loading.classList.remove('hidden');
}

function hideLoading() {
    loading.classList.add('hidden');
}

// Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Categories View (read-only - 5 fixed categories)
async function loadCategories() {
    showLoading();
    try {
        const data = await api.getCategories();
        categories = data.categories;
        renderCategoriesList(categories);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

function renderCategoriesList(cats) {
    const container = document.getElementById('categories-list');

    // Simple list of the 5 fixed categories with descriptions
    const descriptions = {
        'Food': 'Groceries, restaurants, coffee, takeout - tracked in burn rate',
        'Discretionary': 'Shopping, entertainment, hobbies - tracked in burn rate',
        'Recurring': 'Rent, utilities, subscriptions - excluded from burn rate',
        'Explosion': 'One-off large purchases - excluded from burn rate',
        'Excluded': 'Transfers, income, payments - excluded from burn rate'
    };

    let html = '';
    cats.forEach(cat => {
        const desc = descriptions[cat.name] || cat.burn_rate_group;
        html += `
            <div class="category-item">
                <div class="category-item-name">${escapeHtml(cat.name)}</div>
                <div class="category-item-desc">${desc}</div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Utils
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
