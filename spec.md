# S3 Photo Backup Web App - Technical Specification

## Overview
A client-side web application that enables users to securely backup and browse their photos on S3-compatible storage with local encryption. The entire configuration can be shared via a single QR code.

## Core Features

### 1. Photo Upload & Backup
- **Drag & drop interface** for photo uploads
- **Batch upload support** for multiple photos
- **Progress tracking** with upload status indicators
- **Automatic retry mechanism** for failed uploads
- **Thumbnail generation** for efficient browsing
- **Metadata preservation** (EXIF data, creation date, etc.)

### 2. Local Encryption
- **Client-side encryption** using AES-256-GCM before upload
- **User-provided encryption key** (minimum 32 characters)
- **No plaintext data** sent to S3 - everything encrypted locally
- **Secure key derivation** using PBKDF2 or similar
- **Encrypted filename obfuscation** to hide original filenames

### 3. S3 Integration
- **S3-compatible storage support** (AWS S3, MinIO, DigitalOcean Spaces, etc.)
- **Configurable endpoint URLs** for different S3 providers
- **Custom bucket and path configuration**
- **Presigned URL generation** for secure uploads
- **Direct browser-to-S3 uploads** (no server proxy needed)

### 4. QR Code Configuration
- **Single QR code** containing all configuration:
  ```json
  {
    "s3_endpoint": "https://s3.amazonaws.com",
    "bucket": "my-photo-backup",
    "access_key": "AKIAIOSFODNN7EXAMPLE",
    "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    "encryption_key": "my-super-secret-encryption-key-32chars",
    "region": "us-east-1",
    "path_prefix": "photos/"
  }
  ```
- **QR code scanning** for easy configuration import
- **QR code generation** for sharing configurations
- **Configuration validation** before saving

### 5. Photo Browser Interface
- **Google Photos-like grid layout** with responsive design
- **Infinite scroll** for large photo collections
- **Thumbnail lazy loading** for performance
- **Search and filter capabilities**:
  - By date range
  - By filename
  - By metadata tags
- **Full-size image viewer** with zoom and navigation
- **Download functionality** for individual photos
- **Bulk selection** for batch operations

## Technical Architecture

### Frontend Stack
- **Pure HTML5/CSS3/JavaScript** (no frameworks for maximum portability)
- **Web Crypto API** for encryption operations
- **File API** for local file handling
- **Canvas API** for thumbnail generation
- **QR code library** (qrcode.js or similar)
- **Progressive Web App (PWA)** capabilities

### Security Features
- **Client-side only operation** - no backend server required
- **Zero-knowledge architecture** - encryption keys never leave the client
- **Secure random key generation** option
- **Memory-safe encryption** with automatic cleanup
- **Content Security Policy (CSP)** headers

### Storage Structure
```
s3://bucket/path_prefix/
├── thumbnails/
│   ├── YYYY/MM/DD/
│   │   └── encrypted_filename_thumb.enc
├── photos/
│   ├── YYYY/MM/DD/
│   │   └── encrypted_filename.enc
└── metadata/
    ├── YYYY/MM/DD/
    │   └── encrypted_filename.json.enc
```

### Data Flow
1. **Photo Selection** → Local thumbnail generation
2. **Encryption** → AES-256-GCM with user key
3. **S3 Upload** → Direct browser upload using presigned URLs
4. **Index Update** → Local storage index for browsing
5. **Browse/Download** → Decrypt on-the-fly for viewing

## User Interface

### Main Screens
1. **Configuration Screen**
   - QR code scanner
   - Manual configuration form
   - Configuration sharing (QR generation)
   - Connection testing

2. **Upload Screen**
   - Drag & drop zone
   - File selector
   - Upload progress dashboard
   - Upload history

3. **Gallery Screen**
   - Photo grid with thumbnails
   - Search and filter bar
   - Date-based organization
   - Infinite scroll

4. **Viewer Screen**
   - Full-size image display
   - Zoom and pan controls
   - Navigation arrows
   - Download button
   - Photo metadata display

### Mobile Considerations
- **Responsive design** for mobile browsers
- **Touch-friendly interfaces**
- **Camera integration** for direct photo capture
- **Offline capability** with service workers
- **Easy Android WebView integration** for future mobile app

## Security Considerations

### Encryption
- **AES-256-GCM** for authenticated encryption
- **PBKDF2** for key derivation from user passphrase
- **Cryptographically secure random** IV generation
- **Memory zeroing** after encryption operations

### S3 Security
- **Principle of least privilege** for S3 credentials
- **Bucket policies** to restrict access
- **CORS configuration** for browser uploads
- **Presigned URL expiration** for time-limited access

### Client Security
- **No credential storage** in localStorage without encryption
- **Secure configuration import/export**
- **Input validation** and sanitization
- **XSS protection** measures

## Performance Optimization

### Upload Performance
- **Parallel uploads** for multiple files
- **Chunked uploads** for large files
- **Upload resumption** for interrupted transfers
- **Bandwidth throttling** options

### Browsing Performance
- **Thumbnail caching** in browser storage
- **Lazy loading** for images
- **Virtual scrolling** for large collections
- **Image compression** options

### Storage Optimization
- **Multiple thumbnail sizes** (small, medium, large)
- **WebP format** support for modern browsers
- **Progressive JPEG** for better loading experience

## Future Android App Considerations

### WebView Integration
- **Cordova/PhoneGap compatibility**
- **File system access** through plugins
- **Camera integration** through device APIs
- **Background upload** capabilities

### Native Features
- **Auto-backup** functionality
- **Gallery integration**
- **Notification system**
- **Offline queue management**

## Development Phases

### Phase 1: Core Functionality
- Basic S3 upload/download
- Local encryption/decryption
- QR code configuration
- Simple photo grid

### Phase 2: Enhanced UI
- Advanced photo browser
- Search and filtering
- Thumbnail optimization
- Progress tracking

### Phase 3: Advanced Features
- PWA capabilities
- Offline support
- Performance optimizations
- Android WebView preparation

### Phase 4: Mobile Transition
- Cordova/PhoneGap wrapper
- Native mobile features
- App store deployment

## Technical Requirements

### Browser Support
- **Modern browsers** with Web Crypto API support
- **Chrome 60+, Firefox 57+, Safari 11+**
- **Mobile browser** compatibility

### Storage Requirements
- **S3-compatible storage** with CORS support
- **Sufficient bucket permissions** for upload/download
- **Optional CDN** for faster thumbnail delivery

### Performance Targets
- **Upload speed**: Limited by network bandwidth
- **Browsing**: < 2s initial load, < 500ms thumbnail load
- **Encryption**: < 100ms per MB on modern devices
- **Memory usage**: < 500MB for large photo collections 