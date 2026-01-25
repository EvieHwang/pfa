/**
 * Authentication module for PFA
 */

const Auth = {
    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!API.getToken();
    },

    /**
     * Verify the current token with the server
     */
    async verifyToken() {
        if (!this.isAuthenticated()) {
            return false;
        }

        try {
            const result = await API.auth.verify();
            return result && result.valid;
        } catch (error) {
            console.error('Token verification failed:', error);
            return false;
        }
    },

    /**
     * Login with password
     */
    async login(password) {
        try {
            const result = await API.auth.login(password);
            if (result && result.token) {
                API.setToken(result.token);
                return { success: true };
            }
            return { success: false, error: 'Invalid response' };
        } catch (error) {
            return { success: false, error: error.message || 'Login failed' };
        }
    },

    /**
     * Logout
     */
    logout() {
        API.clearToken();
        window.location.reload();
    },

    /**
     * Initialize auth UI
     */
    init() {
        const loginModal = document.getElementById('login-modal');
        const loginForm = document.getElementById('login-form');
        const loginError = document.getElementById('login-error');
        const logoutBtn = document.getElementById('logout-btn');

        // Handle login form submission
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');

            // Disable button while logging in
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            loginError.classList.add('hidden');

            const result = await this.login(password);

            if (result.success) {
                loginModal.classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                App.init();
            } else {
                loginError.textContent = result.error || 'Invalid password';
                loginError.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });

        // Handle logout
        logoutBtn.addEventListener('click', () => {
            this.logout();
        });

        // Check authentication on load
        this.checkAuth();
    },

    /**
     * Check authentication and show appropriate UI
     */
    async checkAuth() {
        const loginModal = document.getElementById('login-modal');
        const app = document.getElementById('app');

        if (this.isAuthenticated()) {
            const valid = await this.verifyToken();
            if (valid) {
                loginModal.classList.add('hidden');
                app.classList.remove('hidden');
                App.init();
                return;
            }
            // Token invalid, clear it
            API.clearToken();
        }

        // Show login
        loginModal.classList.remove('hidden');
        app.classList.add('hidden');
    }
};

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
