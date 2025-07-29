/**
 * Cryptographic utilities for client-side encryption/decryption
 * Uses Web Crypto API with AES-256-GCM for file encryption
 * and PBKDF2 for key derivation from user passphrase
 */

class CryptoManager {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12; // 96 bits for GCM
        this.saltLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits
        this.iterations = 100000; // PBKDF2 iterations
    }

    /**
     * Generate a cryptographically secure random array
     * @param {number} length - Length in bytes
     * @returns {Uint8Array} Random bytes
     */
    generateRandomBytes(length) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    /**
     * Generate a random salt for key derivation
     * @returns {Uint8Array} Random salt
     */
    generateSalt() {
        return this.generateRandomBytes(this.saltLength);
    }

    /**
     * Generate a random IV for encryption
     * @returns {Uint8Array} Random IV
     */
    generateIV() {
        return this.generateRandomBytes(this.ivLength);
    }

    /**
     * Derive an encryption key from a passphrase using PBKDF2
     * @param {string} passphrase - User's encryption passphrase
     * @param {Uint8Array} salt - Salt for key derivation
     * @returns {Promise<CryptoKey>} Derived encryption key
     */
    async deriveKey(passphrase, salt) {
        try {
            // Import the passphrase as a key
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(passphrase),
                'PBKDF2',
                false,
                ['deriveBits', 'deriveKey']
            );

            // Derive the actual encryption key
            return await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: this.iterations,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: this.algorithm, length: this.keyLength },
                false,
                ['encrypt', 'decrypt']
            );
        } catch (error) {
            throw new Error(`Key derivation failed: ${error.message}`);
        }
    }

    /**
     * Encrypt a file using AES-256-GCM
     * @param {File|ArrayBuffer} file - File or data to encrypt
     * @param {string} passphrase - Encryption passphrase
     * @returns {Promise<{encryptedData: ArrayBuffer, salt: Uint8Array, iv: Uint8Array, metadata: Object}>}
     */
    async encryptFile(file, passphrase) {
        try {
            // Convert file to ArrayBuffer if it's a File object
            const data = file instanceof File ? await file.arrayBuffer() : file;
            
            // Generate salt and IV
            const salt = this.generateSalt();
            const iv = this.generateIV();
            
            // Derive encryption key
            const key = await this.deriveKey(passphrase, salt);
            
            // Encrypt the data
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8 // Convert bytes to bits
                },
                key,
                data
            );

            // Create metadata
            const metadata = {
                algorithm: this.algorithm,
                keyLength: this.keyLength,
                ivLength: this.ivLength,
                saltLength: this.saltLength,
                tagLength: this.tagLength,
                iterations: this.iterations,
                originalSize: data.byteLength,
                encryptedSize: encryptedData.byteLength,
                timestamp: Date.now(),
                ...(file instanceof File && {
                    originalName: file.name,
                    mimeType: file.type,
                    lastModified: file.lastModified
                })
            };

            return {
                encryptedData,
                salt,
                iv,
                metadata
            };
        } catch (error) {
            throw new Error(`File encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt a file using AES-256-GCM
     * @param {ArrayBuffer} encryptedData - Encrypted data
     * @param {Uint8Array} salt - Salt used for key derivation
     * @param {Uint8Array} iv - IV used for encryption
     * @param {string} passphrase - Decryption passphrase
     * @returns {Promise<ArrayBuffer>} Decrypted data
     */
    async decryptFile(encryptedData, salt, iv, passphrase) {
        try {
            // Derive the decryption key
            const key = await this.deriveKey(passphrase, salt);
            
            // Decrypt the data
            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8 // Convert bytes to bits
                },
                key,
                encryptedData
            );

            return decryptedData;
        } catch (error) {
            // Check if it's likely an incorrect password
            if (error.name === 'OperationError') {
                throw new Error('Decryption failed: Incorrect passphrase or corrupted data');
            }
            throw new Error(`File decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypt a string using AES-256-GCM
     * @param {string} text - Text to encrypt
     * @param {string} passphrase - Encryption passphrase
     * @returns {Promise<{encryptedData: string, salt: string, iv: string}>} Base64 encoded encrypted data
     */
    async encryptString(text, passphrase) {
        try {
            const data = new TextEncoder().encode(text);
            const salt = this.generateSalt();
            const iv = this.generateIV();
            
            const key = await this.deriveKey(passphrase, salt);
            
            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv,
                    tagLength: this.tagLength * 8
                },
                key,
                data
            );

            return {
                encryptedData: this.arrayBufferToBase64(encryptedData),
                salt: this.arrayBufferToBase64(salt),
                iv: this.arrayBufferToBase64(iv)
            };
        } catch (error) {
            throw new Error(`String encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt a string using AES-256-GCM
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} salt - Base64 encoded salt
     * @param {string} iv - Base64 encoded IV
     * @param {string} passphrase - Decryption passphrase
     * @returns {Promise<string>} Decrypted text
     */
    async decryptString(encryptedData, salt, iv, passphrase) {
        try {
            const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
            const saltBuffer = this.base64ToArrayBuffer(salt);
            const ivBuffer = this.base64ToArrayBuffer(iv);
            
            const key = await this.deriveKey(passphrase, new Uint8Array(saltBuffer));
            
            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: new Uint8Array(ivBuffer),
                    tagLength: this.tagLength * 8
                },
                key,
                encryptedBuffer
            );

            return new TextDecoder().decode(decryptedData);
        } catch (error) {
            if (error.name === 'OperationError') {
                throw new Error('Decryption failed: Incorrect passphrase or corrupted data');
            }
            throw new Error(`String decryption failed: ${error.message}`);
        }
    }

    /**
     * Generate a secure random passphrase
     * @param {number} length - Length of the passphrase (default: 32)
     * @returns {string} Random passphrase
     */
    generateSecurePassphrase(length = 32) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        const randomBytes = this.generateRandomBytes(length);
        let result = '';
        
        for (let i = 0; i < length; i++) {
            result += charset[randomBytes[i] % charset.length];
        }
        
        return result;
    }

    /**
     * Generate an obfuscated filename for storage
     * @param {string} originalFilename - Original filename
     * @param {string} passphrase - Passphrase for generating consistent hash
     * @returns {Promise<string>} Obfuscated filename
     */
    async generateObfuscatedFilename(originalFilename, passphrase) {
        try {
            const data = new TextEncoder().encode(originalFilename + passphrase);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = new Uint8Array(hashBuffer);
            
            // Convert to hex and take first 32 characters
            const hashHex = Array.from(hashArray)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substring(0, 32);
            
            // Get file extension if present
            const lastDot = originalFilename.lastIndexOf('.');
            const extension = lastDot > 0 ? originalFilename.substring(lastDot) : '';
            
            return `${hashHex}${extension}.enc`;
        } catch (error) {
            throw new Error(`Filename obfuscation failed: ${error.message}`);
        }
    }

    /**
     * Convert ArrayBuffer to Base64 string
     * @param {ArrayBuffer} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 string to ArrayBuffer
     * @param {string} base64 - Base64 string to convert
     * @returns {ArrayBuffer} ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Securely wipe sensitive data from memory
     * @param {Uint8Array|ArrayBuffer} data - Data to wipe
     */
    secureWipe(data) {
        if (data instanceof ArrayBuffer) {
            data = new Uint8Array(data);
        }
        if (data instanceof Uint8Array) {
            data.fill(0);
        }
    }

    /**
     * Validate passphrase strength
     * @param {string} passphrase - Passphrase to validate
     * @returns {Object} Validation result with score and feedback
     */
    validatePassphrase(passphrase) {
        const minLength = 12;
        const recommendedLength = 32;
        let score = 0;
        const feedback = [];

        if (passphrase.length < minLength) {
            feedback.push(`Passphrase should be at least ${minLength} characters long`);
        } else if (passphrase.length >= recommendedLength) {
            score += 2;
        } else {
            score += 1;
        }

        // Check for different character types
        if (/[a-z]/.test(passphrase)) score += 1;
        if (/[A-Z]/.test(passphrase)) score += 1;
        if (/[0-9]/.test(passphrase)) score += 1;
        if (/[^a-zA-Z0-9]/.test(passphrase)) score += 1;

        // Check for common patterns
        if (/(.)\1{2,}/.test(passphrase)) {
            feedback.push('Avoid repeating characters');
            score -= 1;
        }

        if (/123|abc|qwe/i.test(passphrase)) {
            feedback.push('Avoid common patterns');
            score -= 1;
        }

        const strength = score >= 5 ? 'strong' : score >= 3 ? 'medium' : 'weak';
        
        return {
            score: Math.max(0, score),
            strength,
            isValid: passphrase.length >= minLength && score >= 3,
            feedback
        };
    }

    /**
     * Test encryption/decryption functionality
     * @returns {Promise<boolean>} True if test passes
     */
    async selfTest() {
        try {
            const testData = 'Hello, World! This is a test message for encryption.';
            const testPassphrase = 'test-passphrase-for-crypto-validation-123';
            
            // Test string encryption/decryption
            const encrypted = await this.encryptString(testData, testPassphrase);
            const decrypted = await this.decryptString(
                encrypted.encryptedData,
                encrypted.salt,
                encrypted.iv,
                testPassphrase
            );
            
            if (decrypted !== testData) {
                throw new Error('String encryption/decryption test failed');
            }
            
            // Test file encryption/decryption
            const testFile = new TextEncoder().encode(testData);
            const fileEncrypted = await this.encryptFile(testFile, testPassphrase);
            const fileDecrypted = await this.decryptFile(
                fileEncrypted.encryptedData,
                fileEncrypted.salt,
                fileEncrypted.iv,
                testPassphrase
            );
            
            const fileDecryptedText = new TextDecoder().decode(fileDecrypted);
            if (fileDecryptedText !== testData) {
                throw new Error('File encryption/decryption test failed');
            }
            
            return true;
        } catch (error) {
            console.error('Crypto self-test failed:', error);
            return false;
        }
    }
}

// Create global instance
window.cryptoManager = new CryptoManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CryptoManager;
} 