/**
 * S3 Client for handling uploads, downloads, and S3 operations
 * Supports multiple S3-compatible providers (AWS S3, MinIO, DigitalOcean Spaces, etc.)
 * Uses presigned URLs for secure browser-to-S3 uploads
 */

class S3Client {
    constructor(config) {
        this.config = {
            s3_endpoint: config.s3_endpoint,
            s3_region: config.s3_region,
            s3_bucket: config.s3_bucket,
            s3_access_key: config.s3_access_key,
            s3_secret_key: config.s3_secret_key,
            path_prefix: config.path_prefix || 'photos/'
        };
        
        // Ensure path prefix ends with /
        if (this.config.path_prefix && !this.config.path_prefix.endsWith('/')) {
            this.config.path_prefix += '/';
        }
        
        this.serviceName = 's3';
        this.algorithm = 'AWS4-HMAC-SHA256';
    }

    /**
     * Test S3 connection by attempting to list bucket contents
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        try {
            // Try to list objects with a limit of 1 to test connection
            await this.listObjects('', 1);
            return true;
        } catch (error) {
            throw new Error(`S3 connection test failed: ${error.message}`);
        }
    }

    /**
     * Upload a file to S3
     * @param {File|ArrayBuffer} file - File to upload
     * @param {string} key - S3 object key
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} Upload URL
     */
    async uploadFile(file, key, progressCallback = null) {
        try {
            const fullKey = this.config.path_prefix + key;
            const presignedUrl = await this.generatePresignedUrl(fullKey, 'PUT');
            
            // Prepare the upload
            const data = file instanceof File ? file : new Blob([file]);
            
            // Create XMLHttpRequest for progress tracking
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                
                // Track progress
                if (progressCallback) {
                    xhr.upload.addEventListener('progress', (event) => {
                        if (event.lengthComputable) {
                            const progress = (event.loaded / event.total) * 100;
                            progressCallback(progress);
                        }
                    });
                }
                
                // Handle completion
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(this.getObjectUrl(fullKey));
                    } else {
                        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
                    }
                });
                
                // Handle errors
                xhr.addEventListener('error', () => {
                    reject(new Error('Upload failed due to network error'));
                });
                
                xhr.addEventListener('timeout', () => {
                    reject(new Error('Upload timed out'));
                });
                
                // Configure and send request
                xhr.open('PUT', presignedUrl);
                xhr.timeout = 300000; // 5 minutes
                
                // Set content type if available
                if (file instanceof File) {
                    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
                }
                
                xhr.send(data);
            });
        } catch (error) {
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Download a file from S3
     * @param {string} key - S3 object key
     * @returns {Promise<ArrayBuffer>} File data
     */
    async downloadFile(key) {
        try {
            const fullKey = this.config.path_prefix + key;
            const presignedUrl = await this.generatePresignedUrl(fullKey, 'GET');
            
            const response = await fetch(presignedUrl);
            if (!response.ok) {
                throw new Error(`Download failed with status ${response.status}: ${response.statusText}`);
            }
            
            return await response.arrayBuffer();
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * List objects in S3 bucket
     * @param {string} prefix - Object prefix filter
     * @param {number} maxKeys - Maximum number of objects to return
     * @returns {Promise<Array>} Array of object information
     */
    async listObjects(prefix = '', maxKeys = 1000) {
        try {
            const fullPrefix = this.config.path_prefix + prefix;
            const params = new URLSearchParams({
                'list-type': '2',
                'prefix': fullPrefix,
                'max-keys': maxKeys.toString()
            });
            
            const url = `${this.config.s3_endpoint}/${this.config.s3_bucket}?${params}`;
            const headers = await this.generateAuthHeaders('GET', `/${this.config.s3_bucket}`, params);
            
            const response = await fetch(url, { headers });
            if (!response.ok) {
                throw new Error(`List objects failed with status ${response.status}: ${response.statusText}`);
            }
            
            const xmlText = await response.text();
            return this.parseListObjectsResponse(xmlText);
        } catch (error) {
            throw new Error(`List objects failed: ${error.message}`);
        }
    }

    /**
     * Delete an object from S3
     * @param {string} key - S3 object key
     * @returns {Promise<void>}
     */
    async deleteObject(key) {
        try {
            const fullKey = this.config.path_prefix + key;
            const presignedUrl = await this.generatePresignedUrl(fullKey, 'DELETE');
            
            const response = await fetch(presignedUrl, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error(`Delete failed with status ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            throw new Error(`Delete failed: ${error.message}`);
        }
    }

    /**
     * Generate a presigned URL for S3 operations
     * @param {string} key - S3 object key
     * @param {string} method - HTTP method (GET, PUT, DELETE)
     * @param {number} expiresIn - URL expiration time in seconds
     * @returns {Promise<string>} Presigned URL
     */
    async generatePresignedUrl(key, method = 'GET', expiresIn = 3600) {
        try {
            const now = new Date();
            const dateString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
            const dateStamp = dateString.slice(0, 8);
            
            // Create canonical request
            const canonicalUri = `/${this.config.s3_bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
            const canonicalQueryString = new URLSearchParams({
                'X-Amz-Algorithm': this.algorithm,
                'X-Amz-Credential': `${this.config.s3_access_key}/${dateStamp}/${this.config.s3_region}/${this.serviceName}/aws4_request`,
                'X-Amz-Date': dateString,
                'X-Amz-Expires': expiresIn.toString(),
                'X-Amz-SignedHeaders': 'host'
            }).toString();
            
            const canonicalHeaders = `host:${new URL(this.config.s3_endpoint).host}\n`;
            const signedHeaders = 'host';
            const payloadHash = 'UNSIGNED-PAYLOAD';
            
            const canonicalRequest = [
                method,
                canonicalUri,
                canonicalQueryString,
                canonicalHeaders,
                signedHeaders,
                payloadHash
            ].join('\n');
            
            // Create string to sign
            const credentialScope = `${dateStamp}/${this.config.s3_region}/${this.serviceName}/aws4_request`;
            const stringToSign = [
                this.algorithm,
                dateString,
                credentialScope,
                await this.sha256(canonicalRequest)
            ].join('\n');
            
            // Calculate signature
            const signature = await this.calculateSignature(stringToSign, dateStamp);
            
            // Build presigned URL
            const finalQueryString = canonicalQueryString + `&X-Amz-Signature=${signature}`;
            return `${this.config.s3_endpoint}${canonicalUri}?${finalQueryString}`;
        } catch (error) {
            throw new Error(`Failed to generate presigned URL: ${error.message}`);
        }
    }

    /**
     * Generate authentication headers for S3 requests
     * @param {string} method - HTTP method
     * @param {string} path - Request path
     * @param {URLSearchParams} queryParams - Query parameters
     * @returns {Promise<Object>} Authentication headers
     */
    async generateAuthHeaders(method, path, queryParams = new URLSearchParams()) {
        try {
            const now = new Date();
            const dateString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
            const dateStamp = dateString.slice(0, 8);
            
            const canonicalQueryString = queryParams.toString();
            const canonicalHeaders = `host:${new URL(this.config.s3_endpoint).host}\nx-amz-date:${dateString}\n`;
            const signedHeaders = 'host;x-amz-date';
            const payloadHash = 'UNSIGNED-PAYLOAD';
            
            const canonicalRequest = [
                method,
                path,
                canonicalQueryString,
                canonicalHeaders,
                signedHeaders,
                payloadHash
            ].join('\n');
            
            const credentialScope = `${dateStamp}/${this.config.s3_region}/${this.serviceName}/aws4_request`;
            const stringToSign = [
                this.algorithm,
                dateString,
                credentialScope,
                await this.sha256(canonicalRequest)
            ].join('\n');
            
            const signature = await this.calculateSignature(stringToSign, dateStamp);
            const authorization = `${this.algorithm} Credential=${this.config.s3_access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
            
            return {
                'Authorization': authorization,
                'X-Amz-Date': dateString,
                'Host': new URL(this.config.s3_endpoint).host
            };
        } catch (error) {
            throw new Error(`Failed to generate auth headers: ${error.message}`);
        }
    }

    /**
     * Calculate AWS v4 signature
     * @param {string} stringToSign - String to sign
     * @param {string} dateStamp - Date stamp
     * @returns {Promise<string>} Signature
     */
    async calculateSignature(stringToSign, dateStamp) {
        const kDate = await this.hmacSha256(`AWS4${this.config.s3_secret_key}`, dateStamp);
        const kRegion = await this.hmacSha256(kDate, this.config.s3_region);
        const kService = await this.hmacSha256(kRegion, this.serviceName);
        const kSigning = await this.hmacSha256(kService, 'aws4_request');
        const signature = await this.hmacSha256(kSigning, stringToSign);
        
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Calculate SHA256 hash
     * @param {string} data - Data to hash
     * @returns {Promise<string>} Hash
     */
    async sha256(data) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Calculate HMAC-SHA256
     * @param {string|ArrayBuffer} key - Key
     * @param {string} data - Data
     * @returns {Promise<ArrayBuffer>} HMAC
     */
    async hmacSha256(key, data) {
        const encoder = new TextEncoder();
        const keyBuffer = typeof key === 'string' ? encoder.encode(key) : key;
        const dataBuffer = encoder.encode(data);
        
        const importedKey = await crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        return await crypto.subtle.sign('HMAC', importedKey, dataBuffer);
    }

    /**
     * Parse XML response from ListObjects
     * @param {string} xmlText - XML response
     * @returns {Array} Parsed objects
     */
    parseListObjectsResponse(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        
        const objects = [];
        const contents = doc.getElementsByTagName('Contents');
        
        for (let i = 0; i < contents.length; i++) {
            const content = contents[i];
            const key = content.getElementsByTagName('Key')[0]?.textContent;
            const lastModified = content.getElementsByTagName('LastModified')[0]?.textContent;
            const etag = content.getElementsByTagName('ETag')[0]?.textContent;
            const size = content.getElementsByTagName('Size')[0]?.textContent;
            
            if (key) {
                // Remove path prefix from key for display
                const displayKey = key.startsWith(this.config.path_prefix) 
                    ? key.substring(this.config.path_prefix.length)
                    : key;
                
                objects.push({
                    key: displayKey,
                    fullKey: key,
                    lastModified: lastModified ? new Date(lastModified) : null,
                    etag: etag ? etag.replace(/"/g, '') : null,
                    size: size ? parseInt(size, 10) : 0
                });
            }
        }
        
        return objects;
    }

    /**
     * Get object URL for direct access
     * @param {string} key - S3 object key
     * @returns {string} Object URL
     */
    getObjectUrl(key) {
        const fullKey = key.startsWith(this.config.path_prefix) ? key : this.config.path_prefix + key;
        return `${this.config.s3_endpoint}/${this.config.s3_bucket}/${fullKey}`;
    }

    /**
     * Get bucket information
     * @returns {Object} Bucket information
     */
    getBucketInfo() {
        return {
            endpoint: this.config.s3_endpoint,
            bucket: this.config.s3_bucket,
            region: this.config.s3_region,
            pathPrefix: this.config.path_prefix
        };
    }

    /**
     * Validate S3 configuration
     * @returns {boolean} True if configuration is valid
     */
    validateConfig() {
        const required = ['s3_endpoint', 's3_region', 's3_bucket', 's3_access_key', 's3_secret_key'];
        return required.every(field => this.config[field] && this.config[field].trim() !== '');
    }

    /**
     * Generate a unique object key for a file
     * @param {string} filename - Original filename
     * @param {Date} date - Upload date
     * @returns {string} Unique object key
     */
    generateObjectKey(filename, date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        // Create date-based path
        const datePath = `${year}/${month}/${day}`;
        
        // Generate unique suffix
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const uniqueSuffix = `${timestamp}_${random}`;
        
        // Get file extension
        const lastDot = filename.lastIndexOf('.');
        const extension = lastDot > 0 ? filename.substring(lastDot) : '';
        
        return `${datePath}/${uniqueSuffix}${extension}`;
    }

    /**
     * Estimate upload time
     * @param {number} fileSize - File size in bytes
     * @param {number} bandwidth - Estimated bandwidth in bytes/second
     * @returns {number} Estimated time in seconds
     */
    estimateUploadTime(fileSize, bandwidth = 1000000) { // Default 1MB/s
        return Math.ceil(fileSize / bandwidth);
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Create global S3Client class
window.S3Client = S3Client;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = S3Client;
} 