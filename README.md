## 🚀 S3 Photo Backup

A secure, client-side web application for backing up photos to S3-compatible storage with **SSE-C encryption**. Share your configuration via QR code and access your photos from any device.

### ✨ Features

- 📱 **Pure Web App** - No backend required, runs entirely in your browser
- 🔐 **SSE-C Encryption** - Server-side encryption with customer-provided keys
- 🏗️ **S3 Compatible** - Works with AWS S3, MinIO, DigitalOcean Spaces, Hetzner Object Storage
- 📷 **Smart Photo Management** - Automatic thumbnails, EXIF data extraction, organized storage
- 📋 **QR Code Sharing** - Save/share configuration securely via QR codes
- 🎨 **Modern UI** - Responsive design with dark mode support
- 🔧 **Easy Setup** - Guided configuration with connection testing
- 🔑 **Key Generation** - Built-in strong encryption key generator

### 🔒 Security Features

- **SSE-C Encryption**: Photos are encrypted on S3 servers using your encryption key
- **Configuration Encryption**: S3 credentials encrypted locally before storage
- **No Data Transmission**: Your encryption key never leaves your device
- **Secure Key Generation**: Cryptographically secure random key generation
- **Auto-Hide Keys**: Generated keys automatically hidden after 10 seconds

## Features

- **🔐 Client-Side Encryption**: All photos are encrypted locally using AES-256-GCM before upload
- **📱 QR Code Configuration**: Share and import configuration via QR codes
- **☁️ S3 Compatible**: Works with AWS S3, MinIO, DigitalOcean Spaces, and other S3-compatible providers
- **🖼️ Photo Gallery**: Google Photos-like interface for browsing uploaded images
- **📱 Mobile Ready**: Responsive design ready for Android WebView integration
- **🚀 No Backend Required**: Pure client-side application - just serve static files

## Quick Start

1. **Open the Application**
   ```bash
   # Serve the files using any web server
   python3 -m http.server 8000
   # Or use Node.js
   npx serve .
   # Or any other static file server
   ```

2. **Access in Browser**
   Open `http://localhost:8000` in your web browser

3. **Configure S3 Settings**
   - Fill in your S3 endpoint, bucket, access keys
   - Set a strong encryption passphrase (minimum 32 characters)
   - Test the connection
   - Generate QR code to share configuration

4. **Upload Photos**
   - Switch to Upload screen
   - Drag & drop photos or click to select
   - Start batch upload

5. **Browse Gallery**
   - View uploaded photos in grid layout
   - Click photos to view full-size
   - Search and filter capabilities

## S3 Configuration Examples

### AWS S3
```json
{
  "s3_endpoint": "https://s3.amazonaws.com",
  "s3_region": "us-east-1",
  "s3_bucket": "my-photo-backup",
  "s3_access_key": "AKIAIOSFODNN7EXAMPLE",
  "s3_secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "encryption_key": "your-super-secure-32-character-passphrase-here",
  "path_prefix": "photos/"
}
```

### MinIO (Self-hosted)
```json
{
  "s3_endpoint": "https://minio.example.com",
  "s3_region": "us-east-1",
  "s3_bucket": "photos",
  "s3_access_key": "minioadmin",
  "s3_secret_key": "minioadmin",
  "encryption_key": "your-super-secure-32-character-passphrase-here",
  "path_prefix": "backup/"
}
```

### DigitalOcean Spaces
```json
{
  "s3_endpoint": "https://nyc3.digitaloceanspaces.com",
  "s3_region": "nyc3",
  "s3_bucket": "my-space",
  "s3_access_key": "DO00EXAMPLE",
  "s3_secret_key": "SECRET_KEY_EXAMPLE",
  "encryption_key": "your-super-secure-32-character-passphrase-here",
  "path_prefix": "photos/"
}
```

## Security Features

- **AES-256-GCM Encryption**: Military-grade encryption with authenticated encryption
- **PBKDF2 Key Derivation**: Secure key derivation from user passphrase
- **Zero-Knowledge Architecture**: Encryption keys never leave your device
- **Secure Configuration Storage**: Configuration encrypted in localStorage
- **Filename Obfuscation**: Original filenames are hashed for privacy

## Browser Requirements

- **Chrome 60+** / **Firefox 57+** / **Safari 11+**
- **Web Crypto API** support
- **File API** support
- **Canvas API** for thumbnail generation
- **Local Storage** for configuration

## File Structure

```
/
├── index.html              # Main application
├── css/
│   ├── main.css           # Core styles
│   └── components.css     # Component styles
├── js/
│   ├── app.js             # Application controller
│   ├── crypto.js          # Encryption utilities
│   ├── config.js          # Configuration management
│   ├── s3-client.js       # S3 operations
│   ├── file-handler.js    # File processing
│   └── ui-components.js   # UI management
├── lib/
│   ├── qrcode.min.js      # QR code generation
│   └── qr-scanner.min.js  # QR code scanning
└── assets/
    └── icons/             # UI icons
```

## S3 Bucket Setup

### Required Permissions
Your S3 user needs these permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

### CORS Configuration

1. **Set environment variables for AWS CLI:**
   ```bash
   export AWS_ACCESS_KEY_ID="your_access_key"
   export AWS_SECRET_ACCESS_KEY="your_secret_key"
   export AWS_ENDPOINT_URL="https://fsn1.your-objectstorage.com"
   ```

2. **Apply CORS policy:**
   ```bash
   aws s3api put-bucket-cors \
     --endpoint-url https://fsn1.your-objectstorage.com \
     --bucket s3backupfj \
     --cors-configuration file://cors-config.json
   ```

3. **Verify CORS was applied:**
   ```bash
   aws s3api get-bucket-cors \
     --endpoint-url https://fsn1.your-objectstorage.com \
     --bucket s3backupfj
   ```

### CORS Configuration (cors-config.json)
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://s3.msl.cloud"],
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "ExposeHeaders": ["ETag", "x-amz-meta-*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

## Development

### Architecture
- **Pure HTML5/CSS3/JavaScript** - No frameworks for maximum portability
- **Modular Design** - Each component is self-contained
- **Event-Driven** - Components communicate via custom events
- **Progressive Enhancement** - Graceful degradation for older browsers

### Key Components
1. **CryptoManager** - Handles all encryption/decryption operations
2. **ConfigManager** - Manages S3 and app configuration
3. **S3Client** - Handles S3 operations with presigned URLs
4. **FileHandler** - Processes images and generates thumbnails
5. **UIManager** - Manages user interface and interactions

### Testing Crypto Functions
Open browser console and run:
```javascript
// Test encryption
await window.cryptoManager.selfTest();

// Test configuration
const config = window.configManager.generateSampleConfig();
await window.configManager.setConfig(config);

// Check application state
window.s3PhotoBackupApp.exportState();
```

## Storage Structure

Photos are stored in S3 with this structure:
```
s3://bucket/photos/
├── 2024/01/15/
│   ├── abc123_1642234567890.jpg.enc    # Encrypted photo
│   └── def456_1642234567891.png.enc    # Another encrypted photo
├── thumbnails/
│   ├── 2024/01/15/
│   │   ├── abc123_1642234567890_thumb.enc
│   │   └── def456_1642234567891_thumb.enc
└── metadata/
    ├── 2024/01/15/
    │   ├── abc123_1642234567890.json.enc
    │   └── def456_1642234567891.json.enc
```

## Android Integration

This app is designed to be easily wrapped in an Android WebView:

```java
WebView webView = findViewById(R.id.webview);
WebSettings webSettings = webView.getSettings();
webSettings.setJavaScriptEnabled(true);
webSettings.setDomStorageEnabled(true);
webSettings.setAllowFileAccess(true);
webView.loadUrl("file:///android_asset/index.html");
```

## Troubleshooting

### Common Issues

1. **"Browser not supported"**
   - Update to a modern browser with Web Crypto API support

2. **"S3 connection failed"**
   - Check CORS configuration on your S3 bucket
   - Verify access key permissions
   - Ensure endpoint URL is correct

3. **"Encryption key too weak"**
   - Use a passphrase with at least 32 characters
   - Include uppercase, lowercase, numbers, and symbols

4. **"Upload failed"**
   - Check network connection
   - Verify S3 bucket permissions
   - Ensure file size is under 100MB

### Debug Mode
Open browser console for detailed logs and debugging information.

## Contributing

This is a skeleton implementation. Areas for enhancement:
- Full QR code scanner implementation
- More robust EXIF data extraction
- Advanced gallery features (tags, albums)
- Offline support with Service Workers
- File compression options
- Batch operations (download, delete)

## License

MIT License - See LICENSE file for details

## Security Note

This application handles sensitive data. Always:
- Use HTTPS in production
- Keep your encryption passphrase secure
- Regularly backup your configuration
- Use strong, unique S3 credentials
- Review code before deployment 