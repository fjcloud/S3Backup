/**
 * UI Components and Interface Management
 * Handles all user interface interactions, state management, and screen transitions
 */

class UIManager {
    constructor() {
        this.currentScreen = 'config-screen';
        this.uploadQueue = new Map();
        this.photoGallery = [];
        this.currentPhoto = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the UI and set up event listeners
     */
    async initialize() {
        try {
            // Hide loading screen
            this.hideLoadingScreen();
            
            // Set up navigation event listeners
            this.setupNavigationListeners();
            
            // Set up configuration screen
            this.setupConfigurationScreen();
            
            // Set up upload screen
            this.setupUploadScreen();
            
            // Set up gallery screen
            this.setupGalleryScreen();
            
            // Set up photo viewer
            this.setupPhotoViewer();
            
            // Set up global keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Initialize configuration manager
            const hasConfig = await window.configManager.initialize();
            
            if (hasConfig) {
                this.updateConfigurationDisplay();
                this.showStatusMessage('Configuration loaded successfully');
            } else {
                this.showStatusMessage('Please configure your S3 settings');
            }
            
            this.isInitialized = true;
            console.log('UI Manager initialized successfully');
        } catch (error) {
            console.error('UI initialization failed:', error);
            this.showStatusMessage('Application initialization failed', 'error');
        }
    }

    /**
     * Set up navigation event listeners
     */
    setupNavigationListeners() {
        // Header navigation buttons
        document.getElementById('btn-settings').addEventListener('click', () => {
            this.showScreen('config-screen');
        });
        
        document.getElementById('btn-upload').addEventListener('click', () => {
            if (window.configManager.isConfigured) {
                this.showScreen('upload-screen');
            } else {
                this.showStatusMessage('Please configure S3 settings first', 'warning');
                this.showScreen('config-screen');
            }
        });
        
        // Gallery view controls
        document.getElementById('btn-grid-view').addEventListener('click', () => {
            this.setGalleryView('grid');
        });
        
        document.getElementById('btn-list-view').addEventListener('click', () => {
            this.setGalleryView('list');
        });
    }

    /**
     * Set up configuration screen event listeners
     */
    setupConfigurationScreen() {
        const configForm = document.getElementById('config-form');
        const testConnectionBtn = document.getElementById('btn-test-connection');
        const generateQRBtn = document.getElementById('btn-generate-qr');
        const startScannerBtn = document.getElementById('btn-start-scanner');

        // Configuration form submission
        configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveConfiguration();
        });

        // Test connection button
        testConnectionBtn.addEventListener('click', async () => {
            await this.testS3Connection();
        });

        // Generate QR code button
        generateQRBtn.addEventListener('click', async () => {
            await this.generateConfigQR();
        });

        // QR code scanner button
        startScannerBtn.addEventListener('click', async () => {
            await this.startQRScanner();
        });

        // Real-time validation for encryption key
        const encryptionKeyInput = document.getElementById('encryption-key');
        encryptionKeyInput.addEventListener('input', (e) => {
            this.validateEncryptionKey(e.target.value);
        });
    }

    /**
     * Set up upload screen event listeners
     */
    setupUploadScreen() {
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');
        const selectFilesBtn = document.getElementById('btn-select-files');
        const startUploadBtn = document.getElementById('btn-start-upload');
        const clearQueueBtn = document.getElementById('btn-clear-queue');

        // File selection
        selectFilesBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Drag and drop
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFileSelection(e.dataTransfer.files);
        });

        // Upload controls
        startUploadBtn.addEventListener('click', () => {
            this.startBatchUpload();
        });

        clearQueueBtn.addEventListener('click', () => {
            this.clearUploadQueue();
        });
    }

    /**
     * Set up gallery screen event listeners
     */
    setupGalleryScreen() {
        const searchInput = document.getElementById('search-input');
        const searchBtn = document.getElementById('btn-search');

        // Search functionality
        searchBtn.addEventListener('click', () => {
            this.searchPhotos(searchInput.value);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchPhotos(searchInput.value);
            }
        });

        // Load gallery when first shown
        this.setupGalleryLoader();
    }

    /**
     * Set up photo viewer event listeners
     */
    setupPhotoViewer() {
        const viewer = document.getElementById('photo-viewer');
        const closeBtn = document.getElementById('btn-close-viewer');
        const downloadBtn = document.getElementById('btn-download-photo');
        const prevBtn = document.getElementById('btn-prev-photo');
        const nextBtn = document.getElementById('btn-next-photo');
        const overlay = viewer.querySelector('.modal-overlay');

        // Close viewer
        closeBtn.addEventListener('click', () => {
            this.closePhotoViewer();
        });

        overlay.addEventListener('click', () => {
            this.closePhotoViewer();
        });

        // Navigation
        prevBtn.addEventListener('click', () => {
            this.showPreviousPhoto();
        });

        nextBtn.addEventListener('click', () => {
            this.showNextPhoto();
        });

        // Download
        downloadBtn.addEventListener('click', () => {
            this.downloadCurrentPhoto();
        });
    }

    /**
     * Set up keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape key to close modals
            if (e.key === 'Escape') {
                this.closePhotoViewer();
            }

            // Arrow keys for photo navigation
            if (this.currentPhoto !== null) {
                if (e.key === 'ArrowLeft') {
                    this.showPreviousPhoto();
                } else if (e.key === 'ArrowRight') {
                    this.showNextPhoto();
                }
            }

            // Ctrl/Cmd + U for upload
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                if (window.configManager.isConfigured) {
                    this.showScreen('upload-screen');
                }
            }
        });
    }

    /**
     * Show a specific screen
     * @param {string} screenId - Screen to show
     */
    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;

            // Load content if needed
            if (screenId === 'gallery-screen') {
                this.loadGallery();
            }
        }
    }

    /**
     * Save configuration from form
     */
    async saveConfiguration() {
        try {
            const config = {
                s3_endpoint: document.getElementById('s3-endpoint').value.trim(),
                s3_region: document.getElementById('s3-region').value.trim(),
                s3_bucket: document.getElementById('s3-bucket').value.trim(),
                s3_access_key: document.getElementById('s3-access-key').value.trim(),
                s3_secret_key: document.getElementById('s3-secret-key').value.trim(),
                encryption_key: document.getElementById('encryption-key').value.trim(),
                path_prefix: document.getElementById('path-prefix').value.trim() || 'photos/'
            };

            await window.configManager.setConfig(config);
            this.updateConfigurationDisplay();
            this.showStatusMessage('Configuration saved successfully', 'success');
            
            // Enable QR code generation
            document.getElementById('btn-generate-qr').disabled = false;
        } catch (error) {
            this.showStatusMessage(`Configuration save failed: ${error.message}`, 'error');
        }
    }

    /**
     * Test S3 connection
     */
    async testS3Connection() {
        const testBtn = document.getElementById('btn-test-connection');
        const originalText = testBtn.textContent;
        
        try {
            testBtn.disabled = true;
            testBtn.textContent = '🔄 Testing...';
            
            const result = await window.configManager.testConnection();
            
            if (result.success) {
                this.showStatusMessage('S3 connection successful!', 'success');
            } else {
                this.showStatusMessage(`Connection failed: ${result.message}`, 'error');
            }
        } catch (error) {
            this.showStatusMessage(`Connection test failed: ${error.message}`, 'error');
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }

    /**
     * Generate QR code for configuration
     */
    async generateConfigQR() {
        try {
            const qrDataURL = await window.configManager.generateQRCode();
            const qrDisplay = document.getElementById('qr-code-display');
            
            qrDisplay.innerHTML = `<img src="${qrDataURL}" alt="Configuration QR Code" style="max-width: 100%;">`;
            qrDisplay.classList.remove('hidden');
            
            this.showStatusMessage('QR code generated successfully', 'success');
        } catch (error) {
            this.showStatusMessage(`QR code generation failed: ${error.message}`, 'error');
        }
    }

    /**
     * Start QR code scanner
     */
    async startQRScanner() {
        try {
            // This would integrate with the QR scanner library
            // For now, we'll show a placeholder message
            this.showStatusMessage('QR scanner not yet implemented - use manual configuration', 'warning');
        } catch (error) {
            this.showStatusMessage(`QR scanner failed: ${error.message}`, 'error');
        }
    }

    /**
     * Validate encryption key strength
     * @param {string} key - Encryption key to validate
     */
    validateEncryptionKey(key) {
        const validation = window.cryptoManager.validatePassphrase(key);
        const input = document.getElementById('encryption-key');
        
        // Update input styling based on validation
        if (validation.isValid) {
            input.style.borderColor = 'var(--success-color)';
        } else if (key.length > 0) {
            input.style.borderColor = 'var(--error-color)';
        } else {
            input.style.borderColor = 'var(--border-color)';
        }
    }

    /**
     * Update configuration display
     */
    updateConfigurationDisplay() {
        const config = window.configManager.getConfig();
        
        document.getElementById('s3-endpoint').value = config.s3_endpoint || '';
        document.getElementById('s3-region').value = config.s3_region || '';
        document.getElementById('s3-bucket').value = config.s3_bucket || '';
        document.getElementById('s3-access-key').value = config.s3_access_key || '';
        document.getElementById('path-prefix').value = config.path_prefix || 'photos/';
        
        // Don't populate sensitive fields for security
        // document.getElementById('s3-secret-key').value = '';
        // document.getElementById('encryption-key').value = '';
    }

    /**
     * Handle file selection for upload
     * @param {FileList} files - Selected files
     */
    async handleFileSelection(files) {
        try {
            const fileArray = Array.from(files);
            const validFiles = [];

            for (const file of fileArray) {
                try {
                    window.fileHandler.validateFile(file);
                    validFiles.push(file);
                } catch (error) {
                    this.showStatusMessage(`${file.name}: ${error.message}`, 'warning');
                }
            }

            if (validFiles.length > 0) {
                await this.addFilesToQueue(validFiles);
                this.showUploadQueue();
            }
        } catch (error) {
            this.showStatusMessage(`File selection failed: ${error.message}`, 'error');
        }
    }

    /**
     * Add files to upload queue
     * @param {Array} files - Files to add
     */
    async addFilesToQueue(files) {
        const processed = await window.fileHandler.batchProcess(files, (progress) => {
            this.showStatusMessage(`Processing files: ${progress.current}/${progress.total}`, 'info');
        });

        for (const item of processed) {
            if (item.status === 'success') {
                const queueId = Date.now() + Math.random();
                this.uploadQueue.set(queueId, {
                    id: queueId,
                    file: item.file,
                    metadata: item.metadata,
                    thumbnail: item.thumbnail,
                    status: 'pending'
                });
            }
        }

        this.updateUploadQueueDisplay();
    }

    /**
     * Show upload queue
     */
    showUploadQueue() {
        const queueElement = document.getElementById('upload-queue');
        queueElement.classList.remove('hidden');
    }

    /**
     * Update upload queue display
     */
    updateUploadQueueDisplay() {
        const uploadList = document.getElementById('upload-list');
        uploadList.innerHTML = '';

        this.uploadQueue.forEach((item) => {
            const listItem = this.createUploadListItem(item);
            uploadList.appendChild(listItem);
        });

        // Update button states
        const hasItems = this.uploadQueue.size > 0;
        document.getElementById('btn-start-upload').disabled = !hasItems;
        document.getElementById('btn-clear-queue').disabled = !hasItems;
    }

    /**
     * Create upload list item element
     * @param {Object} item - Upload item
     * @returns {HTMLElement} List item element
     */
    createUploadListItem(item) {
        const div = document.createElement('div');
        div.className = 'upload-item';
        div.innerHTML = `
            <img src="${item.thumbnail.dataUrl}" alt="${item.file.name}" class="upload-thumbnail">
            <div class="upload-info">
                <div class="upload-filename">${item.file.name}</div>
                <div class="upload-size">${window.fileHandler.formatFileSize(item.file.size)}</div>
                <div class="upload-progress">
                    <div class="upload-progress-fill" style="width: 0%"></div>
                </div>
            </div>
            <div class="upload-status">${item.status}</div>
        `;
        return div;
    }

    /**
     * Start batch upload
     */
    async startBatchUpload() {
        if (!window.configManager.isConfigured) {
            this.showStatusMessage('Please configure S3 settings first', 'error');
            return;
        }

        try {
            const s3Client = new window.S3Client(window.configManager.getConfig(true));
            const totalItems = this.uploadQueue.size;
            let completed = 0;

            for (const [id, item] of this.uploadQueue) {
                try {
                    // Update status
                    item.status = 'uploading';
                    this.updateUploadQueueDisplay();

                    // Encrypt file
                    const encryptedData = await window.cryptoManager.encryptFile(
                        item.file,
                        window.configManager.getConfig(true).encryption_key
                    );

                    // Generate S3 key
                    const objectKey = s3Client.generateObjectKey(item.file.name);

                    // Upload to S3
                    await s3Client.uploadFile(
                        encryptedData.encryptedData,
                        objectKey,
                        (progress) => {
                            this.updateUploadProgress(id, progress);
                        }
                    );

                    item.status = 'completed';
                    completed++;
                    this.showProgress(completed, totalItems);
                } catch (error) {
                    item.status = 'error';
                    console.error(`Upload failed for ${item.file.name}:`, error);
                }
            }

            this.showStatusMessage(`Upload completed: ${completed}/${totalItems} files`, 'success');
            this.clearUploadQueue();
        } catch (error) {
            this.showStatusMessage(`Upload failed: ${error.message}`, 'error');
        }
    }

    /**
     * Update upload progress for specific item
     * @param {string} id - Item ID
     * @param {number} progress - Progress percentage
     */
    updateUploadProgress(id, progress) {
        const item = this.uploadQueue.get(id);
        if (item) {
            // Update progress bar in UI
            // This would target the specific upload item's progress bar
        }
    }

    /**
     * Clear upload queue
     */
    clearUploadQueue() {
        this.uploadQueue.clear();
        this.updateUploadQueueDisplay();
        document.getElementById('upload-queue').classList.add('hidden');
    }

    /**
     * Load photo gallery
     */
    async loadGallery() {
        if (!window.configManager.isConfigured) {
            this.showStatusMessage('Please configure S3 settings first', 'warning');
            return;
        }

        try {
            this.showLoadingIndicator();
            const s3Client = new window.S3Client(window.configManager.getConfig(true));
            const objects = await s3Client.listObjects();
            
            this.photoGallery = objects;
            this.updateGalleryDisplay();
            this.hideLoadingIndicator();
        } catch (error) {
            this.showStatusMessage(`Failed to load gallery: ${error.message}`, 'error');
            this.hideLoadingIndicator();
        }
    }

    /**
     * Update gallery display
     */
    updateGalleryDisplay() {
        const photoGrid = document.getElementById('photo-grid');
        photoGrid.innerHTML = '';

        this.photoGallery.forEach((photo, index) => {
            const photoItem = this.createPhotoGridItem(photo, index);
            photoGrid.appendChild(photoItem);
        });
    }

    /**
     * Create photo grid item
     * @param {Object} photo - Photo object
     * @param {number} index - Photo index
     * @returns {HTMLElement} Photo grid item
     */
    createPhotoGridItem(photo, index) {
        const div = document.createElement('div');
        div.className = 'photo-item';
        div.innerHTML = `
            <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmMWY1ZjkiLz48cGF0aCBkPSJNMTAwIDEwMEM5Mi4yIDEwMCA4Ni4xIDk0IDg2LjEgODZWODBDODYuMSA3Mi4yIDkyLjEgNjYuMSAxMDAgNjYuMUMxMDcuOSA2Ni4xIDExMy45IDcyLjEgMTEzLjkgODBWODZDMTEzLjkgOTMuOCAxMDcuOCAxMDAgMTAwIDEwMFoiIGZpbGw9IiNjYmQ1ZTEiLz48L3N2Zz4=" alt="${photo.key}" loading="lazy">
            <div class="photo-overlay">
                <div>${photo.key}</div>
                <div>${new Date(photo.lastModified).toLocaleDateString()}</div>
            </div>
        `;
        
        div.addEventListener('click', () => {
            this.openPhotoViewer(index);
        });
        
        return div;
    }

    /**
     * Open photo viewer
     * @param {number} index - Photo index
     */
    openPhotoViewer(index) {
        this.currentPhoto = index;
        const viewer = document.getElementById('photo-viewer');
        viewer.classList.remove('hidden');
        this.loadPhotoInViewer(index);
    }

    /**
     * Close photo viewer
     */
    closePhotoViewer() {
        const viewer = document.getElementById('photo-viewer');
        viewer.classList.add('hidden');
        this.currentPhoto = null;
    }

    /**
     * Load photo in viewer
     * @param {number} index - Photo index
     */
    async loadPhotoInViewer(index) {
        // This would decrypt and load the full-size photo
        // For now, show placeholder
        const photo = this.photoGallery[index];
        if (photo) {
            document.getElementById('photo-title').textContent = photo.key;
            document.getElementById('photo-date').textContent = new Date(photo.lastModified).toLocaleString();
        }
    }

    /**
     * Show previous photo
     */
    showPreviousPhoto() {
        if (this.currentPhoto > 0) {
            this.loadPhotoInViewer(this.currentPhoto - 1);
            this.currentPhoto--;
        }
    }

    /**
     * Show next photo
     */
    showNextPhoto() {
        if (this.currentPhoto < this.photoGallery.length - 1) {
            this.loadPhotoInViewer(this.currentPhoto + 1);
            this.currentPhoto++;
        }
    }

    /**
     * Download current photo
     */
    async downloadCurrentPhoto() {
        // This would decrypt and download the photo
        this.showStatusMessage('Download functionality not yet implemented', 'info');
    }

    /**
     * Set gallery view mode
     * @param {string} mode - View mode (grid or list)
     */
    setGalleryView(mode) {
        document.querySelectorAll('.view-controls .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.getElementById(`btn-${mode}-view`).classList.add('active');
        
        // Update gallery styling based on mode
        const photoGrid = document.getElementById('photo-grid');
        if (mode === 'list') {
            photoGrid.style.gridTemplateColumns = '1fr';
        } else {
            photoGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        }
    }

    /**
     * Search photos
     * @param {string} query - Search query
     */
    searchPhotos(query) {
        if (!query.trim()) {
            this.updateGalleryDisplay();
            return;
        }

        const filteredPhotos = this.photoGallery.filter(photo => 
            photo.key.toLowerCase().includes(query.toLowerCase())
        );

        const photoGrid = document.getElementById('photo-grid');
        photoGrid.innerHTML = '';

        filteredPhotos.forEach((photo, index) => {
            const photoItem = this.createPhotoGridItem(photo, index);
            photoGrid.appendChild(photoItem);
        });
    }

    /**
     * Show status message
     * @param {string} message - Message to show
     * @param {string} type - Message type (info, success, warning, error)
     */
    showStatusMessage(message, type = 'info') {
        const statusElement = document.getElementById('status-message');
        statusElement.textContent = message;
        
        // Update styling based on type
        statusElement.className = `status-message ${type}`;
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * Show progress
     * @param {number} current - Current progress
     * @param {number} total - Total items
     */
    showProgress(current, total) {
        const progressContainer = document.getElementById('progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        const percentage = (current / total) * 100;
        
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${Math.round(percentage)}%`;
        
        if (current === total) {
            setTimeout(() => {
                progressContainer.classList.add('hidden');
            }, 2000);
        } else {
            progressContainer.classList.remove('hidden');
        }
    }

    /**
     * Show loading indicator
     */
    showLoadingIndicator() {
        document.getElementById('loading-indicator').classList.remove('hidden');
    }

    /**
     * Hide loading indicator
     */
    hideLoadingIndicator() {
        document.getElementById('loading-indicator').classList.add('hidden');
    }

    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    /**
     * Set up gallery loader for lazy loading
     */
    setupGalleryLoader() {
        // Future: Implement intersection observer for lazy loading
    }
}

// Create global instance
window.uiManager = new UIManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} 