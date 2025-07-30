/**
 * S3 Client with SSE-C Encryption
 * Server-side encryption with customer-provided keys
 */

class S3ClientSSE {
    constructor(config) {
        // Debug: Log the configuration being passed
        console.log('S3ClientSSE config:', {
            endpoint: config.s3_endpoint,
            region: config.s3_region,
            bucket: config.s3_bucket,
            hasAccessKey: !!config.s3_access_key,
            hasSecretKey: !!config.s3_secret_key,
            hasEncryptionKey: !!config.encryption_key
        });
        
        this.config = {
            s3_endpoint: config.s3_endpoint || 'https://s3.amazonaws.com',
            s3_region: config.s3_region || 'us-east-1',
            s3_bucket: config.s3_bucket,
            s3_access_key: config.s3_access_key,
            s3_secret_key: config.s3_secret_key,
            encryption_key: config.encryption_key
        };
        
        this.serviceName = 's3';
        this.algorithm = 'AWS4-HMAC-SHA256';
        
        // Generate 32-byte key for SSE-C from user's encryption key
        this.sseKey = this.generateSSEKey(config.encryption_key);
    }

    /**
     * Generate 32-byte SSE-C key from user's passphrase
     * @param {string} passphrase - User's encryption passphrase
     * @returns {Promise<Uint8Array>} 32-byte key for SSE-C
     */
    async generateSSEKey(passphrase) {
        const encoder = new TextEncoder();
        const data = encoder.encode(passphrase);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hash);
    }

    /**
     * Get SSE-C headers for S3 operations
     * @returns {Promise<Object>} Headers for SSE-C
     */
    async getSSEHeaders() {
        const key = await this.sseKey;
        const keyBase64 = btoa(String.fromCharCode(...key));
        const keyMD5 = await this.calculateMD5(key);
        
        return {
            'x-amz-server-side-encryption-customer-algorithm': 'AES256',
            'x-amz-server-side-encryption-customer-key': keyBase64,
            'x-amz-server-side-encryption-customer-key-MD5': keyMD5
        };
    }

    /**
     * Calculate MD5 hash for SSE-C key
     * @param {Uint8Array} key - SSE-C key
     * @returns {Promise<string>} Base64-encoded MD5 hash
     */
    async calculateMD5(key) {
        if (!window.MD5) {
            throw new Error('MD5 library not loaded');
        }
        const hash = MD5.hashBytes(key);
        return btoa(String.fromCharCode(...hash));
    }

    /**
     * Upload a file to S3 with SSE-C encryption
     * @param {File} file - File to upload
     * @param {string} key - S3 object key
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<string>} Upload URL
     */
    async uploadFile(file, key, progressCallback = null) {
        try {
            // Generate presigned URL for PUT
            const presignedUrl = await this.generatePresignedUrl(key, 'PUT', 3600);
            
            // Get SSE-C headers
            const sseHeaders = await this.getSSEHeaders();
            
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
                        resolve(this.getObjectUrl(key));
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
                
                // Add SSE-C headers
                Object.entries(sseHeaders).forEach(([header, value]) => {
                    xhr.setRequestHeader(header, value);
                });
                
                // Set content type
                xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
                
                xhr.send(file); // Send original file - S3 will encrypt it
            });
        } catch (error) {
            throw new Error(`Upload failed: ${error.message}`);
        }
    }

    /**
     * Download a file from S3 with SSE-C decryption
     * @param {string} key - S3 object key
     * @returns {Promise<ArrayBuffer>} File data
     */
    async downloadFile(key) {
        try {
            const presignedUrl = await this.generatePresignedUrl(key, 'GET', 3600);
            const sseHeaders = await this.getSSEHeaders();
            
            const response = await fetch(presignedUrl, {
                headers: sseHeaders
            });
            
            if (!response.ok) {
                throw new Error(`Download failed with status ${response.status}: ${response.statusText}`);
            }
            
            return await response.arrayBuffer();
        } catch (error) {
            throw new Error(`Download failed: ${error.message}`);
        }
    }

    /**
     * Test S3 connection using simple GET request
     * @returns {Promise<boolean>} True if connection successful
     */
    async testConnection() {
        try {
            // Debug: Check if bucket is configured
            if (!this.config.s3_bucket) {
                throw new Error('S3 bucket is not configured');
            }
            
            // First, test basic connectivity without auth headers
            const testUrl = `${this.config.s3_endpoint}/${this.config.s3_bucket}`;
            
            console.log('Testing basic connectivity to:', testUrl);
            
            const basicResponse = await fetch(testUrl, { 
                method: 'GET',
                mode: 'cors',
                credentials: 'omit'
            });
            
            console.log('Basic connectivity test result:', {
                status: basicResponse.status,
                statusText: basicResponse.statusText,
                cors: basicResponse.headers.get('access-control-allow-origin')
            });
            
            // Now test with authentication
            const headers = await this.generateAuthHeaders('GET', `/${this.config.s3_bucket}`);
            
            console.log('S3 authenticated request:', {
                url: testUrl,
                method: 'GET',
                headers: headers,
                region: this.config.s3_region,
                bucket: this.config.s3_bucket
            });
            
            const response = await fetch(testUrl, { 
                method: 'GET',
                headers,
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                let errorMessage = `Authenticated request failed with status ${response.status}: ${response.statusText}`;
                
                if (response.status === 403) {
                    errorMessage += `\n\nPossible causes:
                    1. Wrong region (current: ${this.config.s3_region}) - should match endpoint region
                    2. Access key doesn't have s3:ListBucket permission
                    3. Bucket policy restricts access
                    4. Wrong endpoint format`;
                }
                
                throw new Error(errorMessage);
            }
            
            console.log('S3 authenticated response:', {
                status: response.status,
                statusText: response.statusText,
                cors: response.headers.get('access-control-allow-origin'),
                contentType: response.headers.get('content-type')
            });
            
            return true;
        } catch (error) {
            throw new Error(`S3 connection test failed: ${error.message}`);
        }
    }

    /**
     * List objects in S3 bucket (SSE-C encrypted objects appear normally in listings)
     * @param {string} prefix - Object prefix filter
     * @param {number} maxKeys - Maximum number of objects to return
     * @returns {Promise<Array>} Array of object information
     */
    async listObjects(prefix = '', maxKeys = 1000) {
        try {
            const params = new URLSearchParams({
                'list-type': '2',
                'prefix': prefix,
                'max-keys': maxKeys.toString()
            });
            
            // Debug: Check if bucket is configured
            if (!this.config.s3_bucket) {
                throw new Error('S3 bucket is not configured');
            }
            
            const url = `${this.config.s3_endpoint}/${this.config.s3_bucket}?${params}`;
            const headers = await this.generateAuthHeaders('GET', `/${this.config.s3_bucket}`, params);
            
            // Debug: Log the request details
            console.log('S3 Request:', {
                url: url,
                method: 'GET',
                headers: headers,
                region: this.config.s3_region,
                bucket: this.config.s3_bucket,
                endpoint: this.config.s3_endpoint,
                hasAccessKey: !!this.config.s3_access_key,
                hasSecretKey: !!this.config.s3_secret_key
            });
            
            const response = await fetch(url, { 
                headers,
                mode: 'cors',
                credentials: 'omit'
            });
            if (!response.ok) {
                let errorMessage = `List objects failed with status ${response.status}: ${response.statusText}`;
                
                if (response.status === 403) {
                    const responseText = await response.text();
                    errorMessage += `\n\nPossible causes:
                    1. Wrong region (current: ${this.config.s3_region}) - should match endpoint region
                    2. Access key doesn't have s3:ListBucket permission
                    3. Bucket policy restricts access
                    4. Wrong endpoint format
                    
                    Response: ${responseText}`;
                }
                
                throw new Error(errorMessage);
            }
            
            // Debug: Log response headers
            console.log('S3 Response Headers:', {
                status: response.status,
                statusText: response.statusText,
                cors: response.headers.get('access-control-allow-origin'),
                contentType: response.headers.get('content-type')
            });
            
            const xmlText = await response.text();
            return this.parseListObjectsResponse(xmlText);
        } catch (error) {
            throw new Error(`List objects failed: ${error.message}`);
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
            
            const queryParams = new URLSearchParams({
                'X-Amz-Algorithm': this.algorithm,
                'X-Amz-Credential': `${this.config.s3_access_key}/${dateStamp}/${this.config.s3_region}/${this.serviceName}/aws4_request`,
                'X-Amz-Date': dateString,
                'X-Amz-Expires': expiresIn.toString(),
                'X-Amz-SignedHeaders': 'host'
            });

            const canonicalQueryString = queryParams.toString();
            // For AWS S3, use the endpoint directly
            const host = new URL(this.config.s3_endpoint).host;
            const canonicalHeaders = `host:${host}\n`;
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
     * Calculate AWS v4 signature
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
                objects.push({
                    key: key,
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
     * Generate authentication headers for S3 requests
     */
    async generateAuthHeaders(method, path, queryParams = new URLSearchParams()) {
        try {
            const now = new Date();
            const dateString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
            const dateStamp = dateString.slice(0, 8);
            
            const canonicalQueryString = queryParams.toString();
            
            // Debug: Check if endpoint is defined
            if (!this.config.s3_endpoint) {
                throw new Error('S3 endpoint is not configured');
            }
            
            // For AWS S3, use the endpoint directly
            const host = new URL(this.config.s3_endpoint).host;
            
            const canonicalHeaders = `host:${host}\nx-amz-date:${dateString}\n`;
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
                'Host': host
            };
        } catch (error) {
            throw new Error(`Failed to generate auth headers: ${error.message}`);
        }
    }

    /**
     * Get object URL for direct access (Note: SSE-C objects can't be accessed directly without headers)
     */
    getObjectUrl(key) {
        return `${this.config.s3_endpoint}/${this.config.s3_bucket}/${key}`;
    }

    /**
     * Generate a unique object key for a file
     */
    generateObjectKey(filename, date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        const datePath = `${year}/${month}/${day}`;
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const uniqueSuffix = `${timestamp}_${random}`;
        
        const lastDot = filename.lastIndexOf('.');
        const extension = lastDot > 0 ? filename.substring(lastDot) : '';
        
        return `${datePath}/${uniqueSuffix}${extension}`;
    }
}

// Create global S3ClientSSE class
window.S3ClientSSE = S3ClientSSE;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = S3ClientSSE;
} 