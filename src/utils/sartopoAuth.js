/**
 * SARTopo/Caltopo Request Signing Utility
 * 
 * Translates the HMAC-SHA256 signing logic required for secure API interactions.
 */

/**
 * Generates a Base64 encoded HMAC-SHA256 signature for a SARTopo API request.
 * 
 * @param {string} method - HTTP Method (GET, POST, etc.)
 * @param {string} path - The API path (e.g., /api/v1/map/ABCD/features)
 * @param {number} expires - Epoch timestamp in milliseconds
 * @param {string|null} payload - The raw string body for POST/PUT requests
 * @param {string} secretBase64 - The Base64 encoded credential secret
 * @returns {Promise<string>} Base64 encoded signature
 */
export async function signSartopoRequest(method, path, expires, payload, secretBase64) {
  try {
    const encoder = new TextEncoder();
    
    // 1. Construct the message following SARTopo spec: METHOD PATH\nEXPIRES\nPAYLOAD
    const message = `${method.toUpperCase()} ${path}\n${expires}\n${payload || ''}`;

    // 2. Decode the Base64 secret into a byte array
    const keyData = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));

    // 3. Import the key for HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // 4. Generate the signature
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    
    // 5. Convert ArrayBuffer result back to Base64
    return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  } catch (err) {
    console.error('[SARTopoAuth] Signing failed:', err);
    throw new Error('Cryptographic signing failed. Ensure your credential secret is valid Base64.');
  }
}