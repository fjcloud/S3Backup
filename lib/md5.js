/**
 * MD5 Hash Implementation
 * Required for SSE-C as Web Crypto API doesn't support MD5
 */

class MD5 {
    constructor() {
        this.h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
    }

    static hash(data) {
        const md5 = new MD5();
        return md5.update(data).digest();
    }

    static hashBytes(bytes) {
        const md5 = new MD5();
        return md5.updateBytes(bytes).digest();
    }

    update(data) {
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            return this.updateBytes(bytes);
        }
        return this.updateBytes(data);
    }

    updateBytes(bytes) {
        const msgLen = bytes.length;
        const chunks = [];
        
        // Pre-processing: adding a single 1 bit
        const paddedBytes = new Uint8Array(msgLen + 1);
        paddedBytes.set(bytes);
        paddedBytes[msgLen] = 0x80;
        
        // Pre-processing: padding with zeros
        const msgBitLen = msgLen * 8;
        const paddingLen = (56 - (msgLen + 1) % 64 + 64) % 64;
        const totalLen = msgLen + 1 + paddingLen + 8;
        
        const finalBytes = new Uint8Array(totalLen);
        finalBytes.set(paddedBytes);
        
        // Append original length in bits mod 2^64 to message
        const view = new DataView(finalBytes.buffer);
        view.setUint32(totalLen - 8, msgBitLen, true); // little endian
        view.setUint32(totalLen - 4, Math.floor(msgBitLen / 0x100000000), true);
        
        // Process the message in successive 512-bit chunks
        for (let i = 0; i < totalLen; i += 64) {
            this.processChunk(finalBytes.slice(i, i + 64));
        }
        
        return this;
    }

    processChunk(chunk) {
        const w = new Uint32Array(16);
        const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        
        for (let i = 0; i < 16; i++) {
            w[i] = view.getUint32(i * 4, true); // little endian
        }
        
        let [a, b, c, d] = this.h;
        
        // Main loop
        for (let i = 0; i < 64; i++) {
            let f, g;
            
            if (i < 16) {
                f = (b & c) | (~b & d);
                g = i;
            } else if (i < 32) {
                f = (d & b) | (~d & c);
                g = (5 * i + 1) % 16;
            } else if (i < 48) {
                f = b ^ c ^ d;
                g = (3 * i + 5) % 16;
            } else {
                f = c ^ (b | ~d);
                g = (7 * i) % 16;
            }
            
            const temp = d;
            d = c;
            c = b;
            b = this.addUint32(b, this.leftRotate(this.addUint32(this.addUint32(a, f), this.addUint32(this.getK(i), w[g])), this.getR(i)));
            a = temp;
        }
        
        this.h[0] = this.addUint32(this.h[0], a);
        this.h[1] = this.addUint32(this.h[1], b);
        this.h[2] = this.addUint32(this.h[2], c);
        this.h[3] = this.addUint32(this.h[3], d);
    }

    addUint32(a, b) {
        return (a + b) >>> 0;
    }

    leftRotate(value, amount) {
        return ((value << amount) | (value >>> (32 - amount))) >>> 0;
    }

    getK(i) {
        const k = [
            0xD76AA478, 0xE8C7B756, 0x242070DB, 0xC1BDCEEE, 0xF57C0FAF, 0x4787C62A, 0xA8304613, 0xFD469501,
            0x698098D8, 0x8B44F7AF, 0xFFFF5BB1, 0x895CD7BE, 0x6B901122, 0xFD987193, 0xA679438E, 0x49B40821,
            0xF61E2562, 0xC040B340, 0x265E5A51, 0xE9B6C7AA, 0xD62F105D, 0x02441453, 0xD8A1E681, 0xE7D3FBC8,
            0x21E1CDE6, 0xC33707D6, 0xF4D50D87, 0x455A14ED, 0xA9E3E905, 0xFCEFA3F8, 0x676F02D9, 0x8D2A4C8A,
            0xFFFA3942, 0x8771F681, 0x6D9D6122, 0xFDE5380C, 0xA4BEEA44, 0x4BDECFA9, 0xF6BB4B60, 0xBEBFBC70,
            0x289B7EC6, 0xEAA127FA, 0xD4EF3085, 0x04881D05, 0xD9D4D039, 0xE6DB99E5, 0x1FA27CF8, 0xC4AC5665,
            0xF4292244, 0x432AFF97, 0xAB9423A7, 0xFC93A039, 0x655B59C3, 0x8F0CCC92, 0xFFEFF47D, 0x85845DD1,
            0x6FA87E4F, 0xFE2CE6E0, 0xA3014314, 0x4E0811A1, 0xF7537E82, 0xBD3AF235, 0x2AD7D2BB, 0xEB86D391
        ];
        return k[i];
    }

    getR(i) {
        const r = [
            7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
            5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
            4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
            6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
        ];
        return r[i];
    }

    digest() {
        const result = new Uint8Array(16);
        const view = new DataView(result.buffer);
        
        for (let i = 0; i < 4; i++) {
            view.setUint32(i * 4, this.h[i], true); // little endian
        }
        
        return result;
    }

    hexDigest() {
        const bytes = this.digest();
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    base64Digest() {
        const bytes = this.digest();
        return btoa(String.fromCharCode(...bytes));
    }
}

// Global export
window.MD5 = MD5;

// Module export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MD5;
} 