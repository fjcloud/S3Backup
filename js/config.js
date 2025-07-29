/**
 * Configuration Management System
 * Handles S3 credentials, encryption keys, and QR code generation/scanning
 * Stores configuration securely in localStorage with encryption
 */

class ConfigManager {
    constructor() {
        this.storageKey = 's3-photo-backup-config';
        this.configKey = 'config-encryption-key-v1'; // Separate key for config encryption
        this.defaultConfig = {
            s3_endpoint: '',
            s3_region: '',
            s3_bucket: '',
            s3_access_key: '',
            s3_secret_key: '',
            encryption_key: '',
            path_prefix: 'photos/',
            version: '1.0'
        };
        this.currentConfig = { ...this.defaultConfig };
        this.isConfigured = false;
    }

    /**
     * Initialize configuration manager
     * @returns {Promise<boolean>} True if existing config was loaded
     */
    async initialize() {
        try {
            const loaded = await this.loadConfig();
            this.validateCurrentConfig();
            return loaded;
        } catch (error) {
            console.warn('Failed to load configuration:', error.message);
            return false;
        }
    }

    /**
     * Set configuration from object
     * @param {Object} config - Configuration object
     * @returns {Promise<void>}
     */
    async setConfig(config) {
        try {
            // Validate configuration
            this.validateConfig(config);
            
            // Update current configuration
            this.currentConfig = { ...this.defaultConfig, ...config };
            this.isConfigured = true;
            
            // Save to localStorage
            await this.saveConfig();
            
            // Dispatch configuration change event
            this.dispatchConfigEvent('configurationChanged', this.currentConfig);
        } catch (error) {
            throw new Error(`Failed to set configuration: ${error.message}`);
        }
    }

    /**
     * Get current configuration
     * @param {boolean} includeSensitive - Include sensitive data (keys)
     * @returns {Object} Configuration object
     */
    getConfig(includeSensitive = false) {
        if (!includeSensitive) {
            const { s3_secret_key, encryption_key, ...safeConfig } = this.currentConfig;
            return safeConfig;
        }
        return { ...this.currentConfig };
    }

    /**
     * Update specific configuration field
     * @param {string} key - Configuration key
     * @param {string} value - Configuration value
     * @returns {Promise<void>}
     */
    async updateConfigField(key, value) {
        if (!(key in this.defaultConfig)) {
            throw new Error(`Invalid configuration key: ${key}`);
        }
        
        const updatedConfig = { ...this.currentConfig, [key]: value };
        await this.setConfig(updatedConfig);
    }

    /**
     * Clear all configuration
     * @returns {Promise<void>}
     */
    async clearConfig() {
        this.currentConfig = { ...this.defaultConfig };
        this.isConfigured = false;
        
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to remove config from localStorage:', error);
        }
        
        this.dispatchConfigEvent('configurationCleared');
    }

    /**
     * Test S3 connection with current configuration
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async testConnection() {
        try {
            if (!this.isConfigured) {
                throw new Error('Configuration not set');
            }
            
            // Import S3Client if available
            if (typeof window.s3Client === 'undefined') {
                throw new Error('S3 client not available');
            }
            
            const s3Client = new window.S3Client(this.getConfig(true));
            const result = await s3Client.testConnection();
            
            return {
                success: true,
                message: 'Connection successful'
            };
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Generate QR code for current configuration
     * @returns {Promise<string>} QR code data URL
     */
    async generateQRCode() {
        try {
            if (!this.isConfigured) {
                throw new Error('No configuration to export');
            }
            
            // Check if QRCode library is available
            if (typeof QRCode === 'undefined') {
                throw new Error('QRCode library not available');
            }
            
            const configData = JSON.stringify(this.getConfig(true));
            
            // Generate QR code
            const qrCodeDataURL = await QRCode.toDataURL(configData, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'M'
            });
            
            return qrCodeDataURL;
        } catch (error) {
            throw new Error(`Failed to generate QR code: ${error.message}`);
        }
    }

    /**
     * Import configuration from QR code data
     * @param {string} qrData - Data from QR code
     * @returns {Promise<Object>} Imported configuration
     */
    async importFromQRCode(qrData) {
        try {
            const config = JSON.parse(qrData);
            this.validateConfig(config);
            
            await this.setConfig(config);
            
            this.dispatchConfigEvent('configurationImported', config);
            
            return this.getConfig();
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Invalid QR code data format');
            }
            throw new Error(`Failed to import configuration: ${error.message}`);
        }
    }

    /**
     * Save configuration to localStorage with encryption
     * @returns {Promise<void>}
     * @private
     */
    async saveConfig() {
        try {
            const configJson = JSON.stringify(this.currentConfig);
            
            // Encrypt configuration before storing
            const encrypted = await window.cryptoManager.encryptString(configJson, this.configKey);
            
            const storageData = {
                encrypted: encrypted,
                version: '1.0',
                timestamp: Date.now()
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(storageData));
        } catch (error) {
            throw new Error(`Failed to save configuration: ${error.message}`);
        }
    }

    /**
     * Load configuration from localStorage
     * @returns {Promise<boolean>} True if config was loaded
     * @private
     */
    async loadConfig() {
        try {
            const storedData = localStorage.getItem(this.storageKey);
            if (!storedData) {
                return false;
            }
            
            const storageData = JSON.parse(storedData);
            
            // Decrypt configuration
            const configJson = await window.cryptoManager.decryptString(
                storageData.encrypted.encryptedData,
                storageData.encrypted.salt,
                storageData.encrypted.iv,
                this.configKey
            );
            
            const config = JSON.parse(configJson);
            this.validateConfig(config);
            
            this.currentConfig = { ...this.defaultConfig, ...config };
            this.isConfigured = true;
            
            return true;
        } catch (error) {
            // If decryption fails or data is corrupted, clear storage
            localStorage.removeItem(this.storageKey);
            throw error;
        }
    }

    /**
     * Validate configuration object
     * @param {Object} config - Configuration to validate
     * @throws {Error} If configuration is invalid
     * @private
     */
    validateConfig(config) {
        const requiredFields = [
            's3_endpoint',
            's3_region', 
            's3_bucket',
            's3_access_key',
            's3_secret_key',
            'encryption_key'
        ];
        
        for (const field of requiredFields) {
            if (!config[field] || typeof config[field] !== 'string' || config[field].trim() === '') {
                throw new Error(`Missing or invalid required field: ${field}`);
            }
        }
        
        // Validate S3 endpoint URL
        try {
            new URL(config.s3_endpoint);
        } catch {
            throw new Error('Invalid S3 endpoint URL');
        }
        
        // Validate encryption key strength
        const keyValidation = window.cryptoManager.validatePassphrase(config.encryption_key);
        if (!keyValidation.isValid) {
            throw new Error(`Weak encryption key: ${keyValidation.feedback.join(', ')}`);
        }
        
        // Validate bucket name format (basic validation)
        if (!/^[a-z0-9.-]{3,63}$/i.test(config.s3_bucket)) {
            throw new Error('Invalid S3 bucket name format');
        }
        
        // Validate path prefix
        if (config.path_prefix && typeof config.path_prefix !== 'string') {
            throw new Error('Invalid path prefix');
        }
    }

    /**
     * Validate current configuration
     * @private
     */
    validateCurrentConfig() {
        try {
            this.validateConfig(this.currentConfig);
            this.isConfigured = true;
        } catch {
            this.isConfigured = false;
        }
    }

    /**
     * Get configuration status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            isConfigured: this.isConfigured,
            hasS3Config: !!(this.currentConfig.s3_endpoint && this.currentConfig.s3_bucket),
            hasEncryptionKey: !!this.currentConfig.encryption_key,
            configTimestamp: this.currentConfig.timestamp || null
        };
    }

    /**
     * Export configuration as JSON (without sensitive data by default)
     * @param {boolean} includeSensitive - Include sensitive data
     * @returns {string} JSON string
     */
    exportConfig(includeSensitive = false) {
        return JSON.stringify(this.getConfig(includeSensitive), null, 2);
    }

    /**
     * Import configuration from JSON string
     * @param {string} jsonString - JSON configuration string
     * @returns {Promise<Object>} Imported configuration
     */
    async importConfig(jsonString) {
        try {
            const config = JSON.parse(jsonString);
            await this.setConfig(config);
            return this.getConfig();
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error('Invalid JSON format');
            }
            throw error;
        }
    }

    /**
     * Generate a sample configuration template
     * @returns {Object} Sample configuration
     */
    generateSampleConfig() {
        return {
            s3_endpoint: 'https://s3.amazonaws.com',
            s3_region: 'us-east-1',
            s3_bucket: 'my-photo-backup',
            s3_access_key: 'AKIAIOSFODNN7EXAMPLE',
            s3_secret_key: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            encryption_key: 'your-secure-encryption-passphrase-here',
            path_prefix: 'photos/'
        };
    }

    /**
     * Dispatch configuration events
     * @param {string} eventType - Event type
     * @param {Object} data - Event data
     * @private
     */
    dispatchConfigEvent(eventType, data = null) {
        const event = new CustomEvent(eventType, {
            detail: data,
            bubbles: true
        });
        document.dispatchEvent(event);
    }

    /**
     * Add configuration change listener
     * @param {Function} callback - Callback function
     */
    onConfigurationChange(callback) {
        document.addEventListener('configurationChanged', (event) => {
            callback(event.detail);
        });
    }

    /**
     * Add configuration clear listener
     * @param {Function} callback - Callback function
     */
    onConfigurationClear(callback) {
        document.addEventListener('configurationCleared', callback);
    }

    /**
     * Add configuration import listener
     * @param {Function} callback - Callback function
     */
    onConfigurationImport(callback) {
        document.addEventListener('configurationImported', (event) => {
            callback(event.detail);
        });
    }
}

// Create global instance
window.configManager = new ConfigManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigManager;
} 