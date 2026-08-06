// This is a direct port of the client-side signing utility to TypeScript for use in Deno.

export async function signSartopoRequest(
  method: string,
  path: string,
  expires: number,
  payload: string | null,
  secretBase64: string
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const message = `${method.toUpperCase()} ${path}\n${expires}\n${payload || ''}`;
    
    // Decode Base64 secret. In Deno, atob is available globally.
    const keyData = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    
    // In Deno, btoa is available globally.
    return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  } catch (err) {
    console.error('[SARTopoAuth Edge] Signing failed:', err);
    throw new Error('Cryptographic signing failed in Edge Function.');
  }
}