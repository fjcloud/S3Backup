/**
 * File Handler for processing images, generating thumbnails, and extracting metadata
 * Handles image resizing, format conversion, and EXIF data extraction
 */

class FileHandler {
    constructor() {
        this.supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
        this.thumbnailSizes = {
            small: { width: 150, height: 150 },
            medium: { width: 300, height: 300 },
            large: { width: 600, height: 600 }
        };
    }

    /**
     * Validate if file is a supported image
     * @param {File} file - File to validate
     * @returns {boolean} True if file is supported
     */
    validateFile(file) {
        if (!file || !(file instanceof File)) {
            throw new Error('Invalid file object');
        }

        if (!this.supportedTypes.includes(file.type)) {
            throw new Error(`Unsupported file type: ${file.type}. Supported types: ${this.supportedTypes.join(', ')}`);
        }

        if (file.size > this.maxFileSize) {
            throw new Error(`File too large: ${this.formatFileSize(file.size)}. Maximum size: ${this.formatFileSize(this.maxFileSize)}`);
        }

        return true;
    }

    /**
     * Generate thumbnail for an image file
     * @param {File} file - Image file
     * @param {string} size - Thumbnail size (small, medium, large)
     * @param {string} format - Output format (jpeg, png, webp)
     * @param {number} quality - Quality for lossy formats (0-1)
     * @returns {Promise<{blob: Blob, dataUrl: string, width: number, height: number}>}
     */
    async generateThumbnail(file, size = 'medium', format = 'jpeg', quality = 0.8) {
        try {
            this.validateFile(file);

            const dimensions = this.thumbnailSizes[size];
            if (!dimensions) {
                throw new Error(`Invalid thumbnail size: ${size}`);
            }

            // Load image
            const img = await this.loadImage(file);
            
            // Calculate new dimensions maintaining aspect ratio
            const { width, height } = this.calculateThumbnailDimensions(
                img.naturalWidth, 
                img.naturalHeight, 
                dimensions.width, 
                dimensions.height
            );

            // Create canvas and draw resized image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;

            // Use better image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // Draw image with proper scaling
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            const mimeType = `image/${format}`;
            const blob = await this.canvasToBlob(canvas, mimeType, quality);
            const dataUrl = canvas.toDataURL(mimeType, quality);

            return {
                blob,
                dataUrl,
                width,
                height,
                size: blob.size,
                format
            };
        } catch (error) {
            throw new Error(`Thumbnail generation failed: ${error.message}`);
        }
    }

    /**
     * Extract metadata from image file
     * @param {File} file - Image file
     * @returns {Promise<Object>} Metadata object
     */
    async extractMetadata(file) {
        try {
            this.validateFile(file);

            const basicInfo = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: new Date(file.lastModified),
                extension: this.getFileExtension(file.name)
            };

            // Load image to get dimensions
            const img = await this.loadImage(file);
            const imageInfo = {
                width: img.naturalWidth,
                height: img.naturalHeight,
                aspectRatio: img.naturalWidth / img.naturalHeight
            };

            // Try to extract EXIF data for JPEG files
            let exifData = {};
            if (file.type === 'image/jpeg') {
                exifData = await this.extractExifData(file);
            }

            // Calculate image hash for deduplication
            const imageHash = await this.calculateImageHash(file);

            return {
                ...basicInfo,
                ...imageInfo,
                exif: exifData,
                hash: imageHash,
                extractedAt: new Date()
            };
        } catch (error) {
            throw new Error(`Metadata extraction failed: ${error.message}`);
        }
    }

    /**
     * Resize image to specific dimensions
     * @param {File} file - Image file
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @param {string} format - Output format
     * @param {number} quality - Quality for lossy formats
     * @returns {Promise<Blob>} Resized image blob
     */
    async resizeImage(file, maxWidth, maxHeight, format = 'jpeg', quality = 0.8) {
        try {
            this.validateFile(file);

            const img = await this.loadImage(file);
            const { width, height } = this.calculateThumbnailDimensions(
                img.naturalWidth,
                img.naturalHeight,
                maxWidth,
                maxHeight
            );

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width;
            canvas.height = height;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            const mimeType = `image/${format}`;
            return await this.canvasToBlob(canvas, mimeType, quality);
        } catch (error) {
            throw new Error(`Image resize failed: ${error.message}`);
        }
    }

    /**
     * Convert image to different format
     * @param {File} file - Image file
     * @param {string} format - Target format (jpeg, png, webp)
     * @param {number} quality - Quality for lossy formats
     * @returns {Promise<Blob>} Converted image blob
     */
    async convertFormat(file, format, quality = 0.8) {
        try {
            this.validateFile(file);

            const img = await this.loadImage(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            // Handle transparency for PNG/WebP to JPEG conversion
            if (format === 'jpeg' && (file.type === 'image/png' || file.type === 'image/webp')) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0);

            const mimeType = `image/${format}`;
            return await this.canvasToBlob(canvas, mimeType, quality);
        } catch (error) {
            throw new Error(`Format conversion failed: ${error.message}`);
        }
    }

    /**
     * Generate unique filename based on content hash
     * @param {string} originalName - Original filename
     * @param {ArrayBuffer} fileData - File data for hashing
     * @returns {Promise<string>} Unique filename
     */
    async generateUniqueFilename(originalName, fileData) {
        try {
            // Create hash of file content
            const hashBuffer = await crypto.subtle.digest('SHA-256', fileData);
            const hashArray = new Uint8Array(hashBuffer);
            const hashHex = Array.from(hashArray)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substring(0, 16); // Use first 16 characters

            // Get file extension
            const extension = this.getFileExtension(originalName);
            const timestamp = Date.now();

            return `${hashHex}_${timestamp}${extension}`;
        } catch (error) {
            throw new Error(`Filename generation failed: ${error.message}`);
        }
    }

    /**
     * Load image from file
     * @param {File} file - Image file
     * @returns {Promise<HTMLImageElement>} Loaded image
     * @private
     */
    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };

            img.src = url;
        });
    }

    /**
     * Calculate thumbnail dimensions maintaining aspect ratio
     * @param {number} originalWidth - Original width
     * @param {number} originalHeight - Original height
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @returns {Object} New dimensions
     * @private
     */
    calculateThumbnailDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        const aspectRatio = originalWidth / originalHeight;

        let width = maxWidth;
        let height = maxHeight;

        if (originalWidth > originalHeight) {
            height = Math.round(width / aspectRatio);
            if (height > maxHeight) {
                height = maxHeight;
                width = Math.round(height * aspectRatio);
            }
        } else {
            width = Math.round(height * aspectRatio);
            if (width > maxWidth) {
                width = maxWidth;
                height = Math.round(width / aspectRatio);
            }
        }

        return { width, height };
    }

    /**
     * Convert canvas to blob
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} mimeType - MIME type
     * @param {number} quality - Quality
     * @returns {Promise<Blob>} Canvas blob
     * @private
     */
    canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas to blob conversion failed'));
                    }
                },
                mimeType,
                quality
            );
        });
    }

    /**
     * Extract EXIF data from JPEG file (basic implementation)
     * @param {File} file - JPEG file
     * @returns {Promise<Object>} EXIF data
     * @private
     */
    async extractExifData(file) {
        try {
            // This is a simplified EXIF reader
            // For production, consider using a library like exif-js or piexifjs
            const arrayBuffer = await file.arrayBuffer();
            const dataView = new DataView(arrayBuffer);

            // Check for JPEG markers
            if (dataView.getUint16(0) !== 0xFFD8) {
                return {}; // Not a JPEG
            }

            // Look for EXIF data in APP1 segment
            let offset = 2;
            while (offset < dataView.byteLength) {
                const marker = dataView.getUint16(offset);
                
                if (marker === 0xFFE1) { // APP1 marker
                    const segmentLength = dataView.getUint16(offset + 2);
                    const segmentData = arrayBuffer.slice(offset + 4, offset + 2 + segmentLength);
                    
                    // Check for EXIF header
                    const exifHeader = new TextDecoder().decode(segmentData.slice(0, 4));
                    if (exifHeader === 'Exif') {
                        return this.parseBasicExifData(segmentData);
                    }
                    break;
                }
                
                if ((marker & 0xFF00) !== 0xFF00) break;
                offset += 2 + dataView.getUint16(offset + 2);
            }

            return {};
        } catch (error) {
            console.warn('EXIF extraction failed:', error);
            return {};
        }
    }

    /**
     * Parse basic EXIF data (simplified)
     * @param {ArrayBuffer} exifData - EXIF data
     * @returns {Object} Parsed EXIF data
     * @private
     */
    parseBasicExifData(exifData) {
        // This is a very basic EXIF parser
        // For full EXIF support, use a dedicated library
        return {
            hasExif: true,
            extractedAt: new Date(),
            // Add more EXIF parsing logic here if needed
        };
    }

    /**
     * Calculate image hash for deduplication
     * @param {File} file - Image file
     * @returns {Promise<string>} Image hash
     * @private
     */
    async calculateImageHash(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
            const hashArray = new Uint8Array(hashBuffer);
            
            return Array.from(hashArray)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        } catch (error) {
            console.warn('Hash calculation failed:', error);
            return '';
        }
    }

    /**
     * Get file extension from filename
     * @param {string} filename - Filename
     * @returns {string} File extension with dot
     * @private
     */
    getFileExtension(filename) {
        const lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(lastDot) : '';
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Create a preview data URL for file
     * @param {File} file - Image file
     * @param {number} maxSize - Maximum size for preview
     * @returns {Promise<string>} Data URL
     */
    async createPreview(file, maxSize = 200) {
        try {
            const thumbnail = await this.generateThumbnail(file, 'small');
            return thumbnail.dataUrl;
        } catch (error) {
            console.warn('Preview creation failed:', error);
            return '';
        }
    }

    /**
     * Batch process multiple files
     * @param {FileList|Array} files - Files to process
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Array>} Processed file information
     */
    async batchProcess(files, progressCallback = null) {
        const results = [];
        const fileArray = Array.from(files);

        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            
            try {
                if (progressCallback) {
                    progressCallback({
                        current: i + 1,
                        total: fileArray.length,
                        filename: file.name,
                        status: 'processing'
                    });
                }

                const metadata = await this.extractMetadata(file);
                const thumbnail = await this.generateThumbnail(file, 'medium');
                
                results.push({
                    file,
                    metadata,
                    thumbnail,
                    status: 'success'
                });
            } catch (error) {
                results.push({
                    file,
                    error: error.message,
                    status: 'error'
                });
            }
        }

        if (progressCallback) {
            progressCallback({
                current: fileArray.length,
                total: fileArray.length,
                status: 'completed'
            });
        }

        return results;
    }

    /**
     * Check if browser supports required features
     * @returns {Object} Support status
     */
    checkBrowserSupport() {
        return {
            canvas: !!document.createElement('canvas').getContext,
            webgl: !!document.createElement('canvas').getContext('webgl'),
            fileApi: !!(window.File && window.FileReader && window.FileList && window.Blob),
            cryptoApi: !!(window.crypto && window.crypto.subtle),
            imageFormats: {
                jpeg: true,
                png: true,
                webp: this.supportsWebP(),
                gif: true
            }
        };
    }

    /**
     * Check WebP support
     * @returns {boolean} True if WebP is supported
     * @private
     */
    supportsWebP() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
    }
}

// Create global instance
window.fileHandler = new FileHandler();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
} 