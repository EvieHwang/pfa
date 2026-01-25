/**
 * Upload module for PFA
 */

const Upload = {
    /**
     * Initialize upload functionality
     */
    init() {
        this.setupEventListeners();
    },

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const uploadBtn = document.getElementById('upload-btn');
        const uploadForm = document.getElementById('upload-form');

        // Open upload modal
        uploadBtn.addEventListener('click', () => {
            this.showModal();
        });

        // Handle form submission
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleUpload();
        });
    },

    /**
     * Show upload modal
     */
    showModal() {
        const modal = document.getElementById('upload-modal');
        const form = document.getElementById('upload-form');
        const status = document.getElementById('upload-status');

        // Reset form
        form.reset();
        status.classList.add('hidden');

        modal.classList.remove('hidden');
    },

    /**
     * Hide upload modal
     */
    hideModal() {
        document.getElementById('upload-modal').classList.add('hidden');
    },

    /**
     * Handle file upload
     */
    async handleUpload() {
        const accountId = document.getElementById('account-select').value;
        const fileInput = document.getElementById('csv-file');
        const file = fileInput.files[0];
        const status = document.getElementById('upload-status');
        const submitBtn = document.getElementById('upload-submit');

        if (!accountId || !file) {
            status.textContent = 'Please select an account and file';
            status.className = 'upload-status error';
            status.classList.remove('hidden');
            return;
        }

        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            status.textContent = 'File too large. Maximum size is 5MB.';
            status.className = 'upload-status error';
            status.classList.remove('hidden');
            return;
        }

        try {
            // Disable button
            submitBtn.disabled = true;
            submitBtn.textContent = 'Uploading...';
            status.classList.add('hidden');

            // Read and upload file
            const result = await this.uploadFile(file, accountId);

            // Show success
            status.innerHTML = `
                <strong>Upload complete!</strong><br>
                New transactions: ${result.new_count}<br>
                Duplicates skipped: ${result.duplicate_count}<br>
                Needs review: ${result.review_count}
            `;
            status.className = 'upload-status success';
            status.classList.remove('hidden');

            // Reset form
            document.getElementById('upload-form').reset();

            // Refresh dashboard after delay
            setTimeout(() => {
                this.hideModal();
                Dashboard.loadData();
            }, 2000);

        } catch (error) {
            status.textContent = `Upload failed: ${error.message}`;
            status.className = 'upload-status error';
            status.classList.remove('hidden');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload';
        }
    },

    /**
     * Upload file to server
     */
    async uploadFile(file, accountId) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('account_id', accountId);

        const response = await fetch('/api/transactions/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API.getToken()}`
            },
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        return response.json();
    }
};
