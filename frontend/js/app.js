/**
 * Burn Rate - Main Application
 */

// State
let categories = [];
let transactionsTable = null;
let foodChart = null;
let discretionaryChart = null;
let explosionChart = null;
let combinedChart = null;

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
    document.getElementById('category-filter').addEventListener('change', loadTransactions);
    document.getElementById('start-date').addEventListener('change', loadTransactions);
    document.getElementById('end-date').addEventListener('change', loadTransactions);

    // Feedback buttons
    document.querySelectorAll('.feedback-buttons button').forEach(btn => {
        btn.addEventListener('click', handleFeedback);
    });
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
    const [categoriesData, statusData] = await Promise.all([
        api.getCategories(),
        api.getStatus(),
    ]);

    categories = categoriesData.categories;

    populateCategoryDropdowns();
    updateReviewBadge(statusData.pending_review_count);
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
    } else if (viewName === 'rules') {
        loadRules();
    }
}

// Dashboard with Burn Rate
async function loadDashboard() {
    showLoading();
    try {
        const data = await api.getBurnRate();
        renderBurnRateCard('food', data.food, '#3b82f6');
        renderBurnRateCard('discretionary', data.discretionary, '#8b5cf6');
        renderBurnRateCard('explosion', data.explosion, '#f97316');
        renderCombinedChart(data);
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Color mapping for charts
const chartColors = {
    food: '#3b82f6',
    discretionary: '#8b5cf6',
    explosion: '#f97316'
};

function renderBurnRateCard(group, data, color) {
    if (!data) return;

    // Update stats
    const currentEl = document.getElementById(`${group}-current`);
    const targetEl = document.getElementById(`${group}-target`);

    if (currentEl) {
        currentEl.textContent = `$${data.current_14day.toFixed(0)}/day`;
    }
    if (targetEl) {
        targetEl.textContent = `$${data.target.toFixed(0)}/day`;
    }

    // For explosion, show 30-day total instead of target
    const totalEl = document.getElementById(`${group}-total`);
    if (totalEl && data.curve) {
        const total30 = data.curve.find(p => p.window === 30);
        if (total30) {
            totalEl.textContent = `$${(total30.daily_rate * 30).toFixed(0)}`;
        }
    }

    // Update arrow with tooltip
    const arrow = document.getElementById(`${group}-arrow`);
    if (arrow) {
        arrow.className = `arrow ${data.arrow}`;
        // Add tooltip
        if (data.arrow === 'improving') {
            arrow.title = 'Spending trending down toward target';
        } else if (data.arrow === 'worsening') {
            arrow.title = 'Spending trending up away from target';
        } else {
            arrow.title = 'Spending stable';
        }
    }

    // Render chart
    const canvas = document.getElementById(`${group}-chart`);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Get existing chart instance
    let chartInstance;
    if (group === 'food') chartInstance = foodChart;
    else if (group === 'discretionary') chartInstance = discretionaryChart;
    else if (group === 'explosion') chartInstance = explosionChart;

    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = data.curve.map(p => `${p.window}d`);
    const values = data.curve.map(p => p.daily_rate);

    const datasets = [
        {
            label: group.charAt(0).toUpperCase() + group.slice(1),
            data: values,
            borderColor: color,
            backgroundColor: color + '1a',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
        }
    ];

    // Add target line only for food and discretionary
    if (data.target > 0) {
        datasets.push({
            label: 'Target',
            data: data.curve.map(() => data.target),
            borderColor: '#22c55e',
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
        });
    }

    const newChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
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

    if (group === 'food') foodChart = newChart;
    else if (group === 'discretionary') discretionaryChart = newChart;
    else if (group === 'explosion') explosionChart = newChart;
}

function renderCombinedChart(data) {
    const canvas = document.getElementById('combined-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (combinedChart) {
        combinedChart.destroy();
    }

    // Use food's labels as baseline
    const labels = data.food.curve.map(p => `${p.window}d`);

    const datasets = [];

    if (data.food) {
        datasets.push({
            label: 'Food',
            data: data.food.curve.map(p => p.daily_rate),
            borderColor: chartColors.food,
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
        });
    }

    if (data.discretionary) {
        datasets.push({
            label: 'Discretionary',
            data: data.discretionary.curve.map(p => p.daily_rate),
            borderColor: chartColors.discretionary,
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
        });
    }

    if (data.explosion) {
        datasets.push({
            label: 'Explosions',
            data: data.explosion.curve.map(p => p.daily_rate),
            borderColor: chartColors.explosion,
            backgroundColor: 'transparent',
            tension: 0.4,
            pointRadius: 0,
        });
    }

    combinedChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { color: '#a3a3a3' }
                },
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
        category_id: document.getElementById('category-filter').value,
        start_date: document.getElementById('start-date').value,
        end_date: document.getElementById('end-date').value,
    };

    showLoading();
    try {
        const data = await api.getTransactions(params);
        renderTransactionsTable(data.transactions);

        // Update badge with uncategorized count
        const uncategorizedCount = data.transactions.filter(t => !t.category_id).length;
        updateReviewBadge(uncategorizedCount);
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
                    return '$' + Math.abs(val).toFixed(2);
                }
            },
            {
                title: 'Category',
                field: 'category_id',
                width: 200,
                formatter: (cell, formatterParams, onRendered) => {
                    const data = cell.getRow().getData();
                    const catId = data.category_id;
                    const isUncategorized = !catId;

                    let html = '<div class="category-cell-wrapper">';

                    // Show checkbox only for uncategorized transactions (default checked)
                    if (isUncategorized) {
                        html += `<input type="checkbox" class="rule-checkbox" data-txn-id="${data.id}" checked title="Create rule">`;
                    }

                    html += `<select class="inline-category-select" data-txn-id="${data.id}">`;
                    html += `<option value="" ${!catId ? 'selected' : ''}>Uncategorized</option>`;
                    categories.forEach(cat => {
                        const selected = catId === cat.id ? 'selected' : '';
                        html += `<option value="${cat.id}" ${selected}>${cat.name}</option>`;
                    });
                    html += '</select></div>';

                    onRendered(() => {
                        const wrapper = cell.getElement().querySelector('.category-cell-wrapper');
                        const select = wrapper?.querySelector('.inline-category-select');
                        const checkbox = wrapper?.querySelector('.rule-checkbox');

                        if (select) {
                            select.addEventListener('change', async (e) => {
                                const txnId = parseInt(e.target.dataset.txnId);
                                const categoryId = e.target.value ? parseInt(e.target.value) : null;
                                const createRule = checkbox ? checkbox.checked : false;

                                try {
                                    const result = await api.categorize(txnId, categoryId, createRule);
                                    data.category_id = categoryId;
                                    data.category_name = categoryId ? categories.find(c => c.id === categoryId)?.name : null;

                                    if (createRule && result.auto_categorized > 0) {
                                        showToast(`Categorized! ${result.auto_categorized} similar transactions also updated.`, 'success');
                                        // Reload to show updated transactions
                                        await loadTransactions();
                                    } else {
                                        showToast('Category updated', 'success');
                                        // Just update this row - remove checkbox since now categorized
                                        cell.getRow().update(data);
                                    }
                                } catch (error) {
                                    showToast(error.message, 'error');
                                }
                            });
                        }
                    });

                    return html;
                }
            },
        ],
    });
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

    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];

    if (!file) {
        showToast('Please select a file', 'error');
        return;
    }

    showLoading();
    try {
        const csvContent = await file.text();
        const result = await api.upload(csvContent);

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

// Utils
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
