/**
 * Burn Rate - Main Application
 */

// State
let accounts = [];
let categories = [];
let transactionsTable = null;

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

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Check if already logged in
    if (api.isAuthenticated()) {
        try {
            await loadInitialData();
            showApp();
        } catch (e) {
            // Token expired or invalid
            api.logout();
            showLogin();
        }
    } else {
        showLogin();
    }

    // Event listeners
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

    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => hideModal(btn.dataset.close));
    });

    // Filters
    document.getElementById('account-filter').addEventListener('change', loadTransactions);
    document.getElementById('category-filter').addEventListener('change', loadTransactions);
    document.getElementById('start-date').addEventListener('change', loadTransactions);
    document.getElementById('end-date').addEventListener('change', loadTransactions);
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

    // Populate dropdowns
    populateAccountDropdowns();
    populateCategoryDropdowns();

    // Update review badge
    updateReviewBadge(statusData.pending_review_count);
}

function populateAccountDropdowns() {
    const selects = [
        document.getElementById('account-select'),
        document.getElementById('account-filter'),
    ];

    selects.forEach(select => {
        // Keep first option
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

    // Group by burn_rate_group
    const groups = {};
    categories.forEach(cat => {
        if (!groups[cat.burn_rate_group]) {
            groups[cat.burn_rate_group] = [];
        }
        groups[cat.burn_rate_group].push(cat);
    });

    for (const [group, cats] of Object.entries(groups)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = group.charAt(0).toUpperCase() + group.slice(1);
        cats.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            optgroup.appendChild(option);
        });
        select.appendChild(optgroup);
    }
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
    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Update views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(`${viewName}-view`).classList.remove('hidden');

    // Load view data
    if (viewName === 'transactions') {
        loadTransactions();
    } else if (viewName === 'review') {
        loadReviewQueue();
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
            { title: 'Category', field: 'category_name', width: 140 },
            { title: 'Account', field: 'account_name', width: 120 },
        ],
    });
}

// Review Queue
async function loadReviewQueue() {
    showLoading();
    try {
        const data = await api.getReviewQueue();
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

    // Add event listeners
    container.querySelectorAll('.category-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const item = e.target.closest('.review-item');
            const txnId = item.dataset.id;
            const categoryId = e.target.value;

            if (!categoryId) return;

            try {
                await api.categorize(parseInt(txnId), parseInt(categoryId), true);
                item.remove();

                // Update badge
                const remaining = container.querySelectorAll('.review-item').length;
                updateReviewBadge(remaining);

                if (remaining === 0) {
                    container.innerHTML = '<div class="dashboard-placeholder"><p>All done!</p></div>';
                }

                showToast('Categorized!', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    });
}

function renderCategoryOptions() {
    const groups = {};
    categories.forEach(cat => {
        if (!groups[cat.burn_rate_group]) {
            groups[cat.burn_rate_group] = [];
        }
        groups[cat.burn_rate_group].push(cat);
    });

    let html = '';
    for (const [group, cats] of Object.entries(groups)) {
        html += `<optgroup label="${group.charAt(0).toUpperCase() + group.slice(1)}">`;
        cats.forEach(cat => {
            html += `<option value="${cat.id}">${cat.name}</option>`;
        });
        html += '</optgroup>';
    }
    return html;
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

        // Update review badge
        updateReviewBadge(result.needs_review_count);

        // Reset form
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
    uploadStatus.classList.add('hidden');
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
