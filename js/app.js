/**
 * Main Application Controller
 * Initializes all components and manages the application lifecycle
 */

class S3PhotoBackupApp {
    constructor() {
        this.version = '1.0.0';
        this.isInitialized = false;
        this.components = {
            cryptoManager: null,
            configManager: null,
            fileHandler: null,
            uiManager: null
        };
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log(`Initializing S3 Photo Backup App v${this.version}`);
            
            // Check browser compatibility
            this.checkBrowserCompatibility();
            
                    // Initialize components (order matters for dependencies)
        try {
            // Configuration management (with built-in encryption)
            if (!window.ConfigManager) {
                throw new Error('ConfigManager not loaded');
            }
            this.configManager = new ConfigManager();
            
            // S3 client with SSE-C encryption
            if (!window.S3ClientSSE) {
                throw new Error('S3ClientSSE not loaded');
            }
            
            // File handling (no client-side encryption needed with SSE-C)
            if (!window.FileHandler) {
                throw new Error('FileHandler not loaded');
            }
            this.fileHandler = new FileHandler();
            
            // UI management
            if (!window.UIManager) {
                throw new Error('UIManager not loaded');
            }
            this.uiManager = new UIManager(this.configManager, this.fileHandler);
            
            console.log('All components loaded successfully');
        } catch (error) {
            throw new Error(`Component initialization failed: ${error.message}`);
        }
            
            // Set up global error handling
            this.setupErrorHandling();
            
            // Run self-tests
            await this.runSelfTests();
            
            // Initialize UI
            await this.components.uiManager.initialize();
            
            this.isInitialized = true;
            console.log('Application initialized successfully');
            
            // Dispatch ready event
            this.dispatchEvent('appReady');
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            this.showFatalError('Application failed to initialize', error.message);
        }
    }

    /**
     * Check browser compatibility
     */
    checkBrowserCompatibility() {
        // Check if we're in a secure context
        const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';
        
        const required = {
            webCrypto: !!(window.crypto && window.crypto.subtle && isSecureContext),
            fileAPI: !!(window.File && window.FileReader && window.FileList && window.Blob),
            canvas: !!document.createElement('canvas').getContext,
            localStorage: !!window.localStorage,
            fetch: !!window.fetch,
            promise: !!window.Promise,
            asyncAwait: true, // Assume modern browser if we got this far
            modules: !!window.URL
        };

        const missing = Object.entries(required)
            .filter(([key, supported]) => !supported)
            .map(([key]) => key);

        if (missing.length > 0) {
            let errorMessage = `Browser not supported. Missing features: ${missing.join(', ')}`;
            
            // Add specific help for crypto issues
            if (missing.includes('webCrypto')) {
                if (!isSecureContext) {
                    errorMessage += '\n\nWeb Crypto API requires HTTPS or localhost. Please serve the application over HTTPS or access it via localhost.';
                } else {
                    errorMessage += '\n\nWeb Crypto API is not available in this browser. Please use Chrome 60+, Firefox 57+, or Safari 11+.';
                }
            }
            
            throw new Error(errorMessage);
        }

        // Check for recommended features
        const recommended = {
            webp: this.supportsWebP(),
            indexedDB: !!window.indexedDB,
            serviceWorker: 'serviceWorker' in navigator,
            notifications: 'Notification' in window
        };

        const missingRecommended = Object.entries(recommended)
            .filter(([key, supported]) => !supported)
            .map(([key]) => key);

        if (missingRecommended.length > 0) {
            console.warn(`Some recommended features not available: ${missingRecommended.join(', ')}`);
        }

        console.log('Browser compatibility check passed');
        console.log('Secure context:', isSecureContext);
        console.log('Current protocol:', location.protocol);
    }

    /**
     * Initialize all application components
     */
    async initializeComponents() {
        try {
            // Components should already be instantiated globally
            this.components = {
                cryptoManager: window.cryptoManager,
                configManager: window.configManager,
                fileHandler: window.fileHandler,
                uiManager: window.uiManager
            };

            // Verify all components are available
            for (const [name, component] of Object.entries(this.components)) {
                if (!component) {
                    throw new Error(`Component ${name} not available`);
                }
            }

            console.log('All components loaded successfully');
        } catch (error) {
            throw new Error(`Component initialization failed: ${error.message}`);
        }
    }

    /**
     * Set up global error handling
     */
    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleError('Unexpected error occurred', event.error);
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError('Promise rejection', event.reason);
            event.preventDefault();
        });

        // Network error handler
        window.addEventListener('offline', () => {
            this.components.uiManager?.showStatusMessage('Network connection lost', 'warning');
        });

        window.addEventListener('online', () => {
            this.components.uiManager?.showStatusMessage('Network connection restored', 'success');
        });

        console.log('Error handling setup complete');
    }

    /**
     * Run self-tests to verify functionality
     */
    async runSelfTests() {
        try {
            console.log('Running self-tests...');

            // Test crypto functionality
            const cryptoTest = await this.components.cryptoManager.selfTest();
            if (!cryptoTest) {
                throw new Error('Crypto self-test failed');
            }

            // Test file handler
            const fileSupport = this.components.fileHandler.checkBrowserSupport();
            if (!fileSupport.canvas || !fileSupport.fileApi || !fileSupport.cryptoApi) {
                throw new Error('File handler requirements not met');
            }

            // Test configuration manager
            try {
                const sampleConfig = this.components.configManager.generateSampleConfig();
                this.components.configManager.validateConfig(sampleConfig);
            } catch (error) {
                console.warn('Config validation test failed:', error.message);
            }

            console.log('Self-tests passed');
        } catch (error) {
            throw new Error(`Self-test failed: ${error.message}`);
        }
    }

    /**
     * Handle application errors
     * @param {string} context - Error context
     * @param {Error} error - Error object
     */
    handleError(context, error) {
        const errorInfo = {
            context,
            message: error?.message || 'Unknown error',
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // Log error details
        console.error('Application error:', errorInfo);

        // Show user-friendly message
        if (this.components.uiManager) {
            this.components.uiManager.showStatusMessage(
                `Error in ${context}: ${errorInfo.message}`,
                'error'
            );
        }

        // In production, you might want to send error reports to a service
        this.reportError(errorInfo);
    }

    /**
     * Report error to monitoring service (placeholder)
     * @param {Object} errorInfo - Error information
     */
    reportError(errorInfo) {
        // In a real application, you would send this to an error reporting service
        console.log('Error report:', errorInfo);
    }

    /**
     * Show fatal error screen
     * @param {string} title - Error title
     * @param {string} message - Error message
     */
    showFatalError(title, message) {
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 2rem;
                text-align: center;
                background-color: #f8fafc;
                color: #374151;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
                <div style="
                    max-width: 600px;
                    padding: 2rem;
                    background: white;
                    border-radius: 0.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                ">
                    <h1 style="
                        font-size: 1.5rem;
                        font-weight: 600;
                        margin-bottom: 1rem;
                        color: #dc2626;
                    ">${title}</h1>
                    <p style="
                        margin-bottom: 1.5rem;
                        color: #6b7280;
                        white-space: pre-line;
                        line-height: 1.6;
                    ">${message}</p>
                    <div style="margin-bottom: 1rem;">
                        <strong>Quick fixes:</strong>
                        <ul style="text-align: left; margin: 0.5rem 0; color: #6b7280;">
                            <li>Access via HTTPS or localhost</li>
                            <li>Use a modern browser (Chrome 60+, Firefox 57+, Safari 11+)</li>
                            <li>Enable JavaScript if disabled</li>
                        </ul>
                    </div>
                    <button onclick="window.location.reload()" style="
                        background-color: #2563eb;
                        color: white;
                        padding: 0.5rem 1rem;
                        border: none;
                        border-radius: 0.25rem;
                        cursor: pointer;
                        font-size: 0.875rem;
                        margin-right: 0.5rem;
                    ">Reload Application</button>
                    <button onclick="console.log(navigator.userAgent)" style="
                        background-color: #6b7280;
                        color: white;
                        padding: 0.5rem 1rem;
                        border: none;
                        border-radius: 0.25rem;
                        cursor: pointer;
                        font-size: 0.875rem;
                    ">Show Browser Info</button>
                </div>
            </div>
        `;
    }

    /**
     * Check WebP support
     * @returns {boolean} True if WebP is supported
     */
    supportsWebP() {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
        } catch {
            return false;
        }
    }

    /**
     * Get application information
     * @returns {Object} Application info
     */
    getAppInfo() {
        return {
            version: this.version,
            isInitialized: this.isInitialized,
            components: Object.keys(this.components).reduce((acc, key) => {
                acc[key] = !!this.components[key];
                return acc;
            }, {}),
            browser: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            },
            features: {
                webCrypto: !!(window.crypto && window.crypto.subtle),
                fileAPI: !!(window.File && window.FileReader),
                canvas: !!document.createElement('canvas').getContext,
                webp: this.supportsWebP(),
                serviceWorker: 'serviceWorker' in navigator,
                secureContext: window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'
            }
        };
    }

    /**
     * Export application state for debugging
     * @returns {Object} Application state
     */
    exportState() {
        return {
            app: this.getAppInfo(),
            config: this.components.configManager?.getStatus(),
            uploadQueue: this.components.uiManager?.uploadQueue?.size || 0,
            gallery: this.components.uiManager?.photoGallery?.length || 0
        };
    }

    /**
     * Dispatch custom application event
     * @param {string} eventType - Event type
     * @param {Object} detail - Event detail
     */
    dispatchEvent(eventType, detail = null) {
        const event = new CustomEvent(eventType, {
            detail: detail || this.getAppInfo(),
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    /**
     * Clean up resources on page unload
     */
    cleanup() {
        try {
            // Clear sensitive data from memory
            if (this.components.cryptoManager) {
                // The crypto manager should handle its own cleanup
            }

            console.log('Application cleanup completed');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    /**
     * Add event listeners for application lifecycle
     */
    setupLifecycleListeners() {
        // Page unload cleanup
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Visibility change handler (for mobile/background apps)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Application hidden');
            } else {
                console.log('Application visible');
                // Refresh connection status or data if needed
            }
        });
    }

    /**
     * Start the application
     */
    static async start() {
        const app = new S3PhotoBackupApp();
        
        // Store global reference
        window.s3PhotoBackupApp = app;
        
        // Set up lifecycle listeners
        app.setupLifecycleListeners();
        
        // Initialize the application
        await app.initialize();
        
        return app;
    }
}

// Auto-start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        S3PhotoBackupApp.start().catch(error => {
            console.error('Failed to start application:', error);
        });
    });
} else {
    // DOM is already ready
    S3PhotoBackupApp.start().catch(error => {
        console.error('Failed to start application:', error);
    });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = S3PhotoBackupApp;
} 