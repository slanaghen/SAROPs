import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { signSartopoRequest } from './sartopoAuth.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  
  try {
    const { method, path, payload, sartopoConfig } = await req.json();
    console.log(`[sartopo-proxy] Received request: ${method} ${path}`);
    
    const credId = Deno.env.get('SARTOPO_API_CREDENTIAL_ID');
    const secret = Deno.env.get('SARTOPO_API_CREDENTIAL_SECRET');
    
    if (!credId || !secret) {
      throw new Error('SARTopo API credentials are not configured in the Edge Function environment.');
    }
    
    const expires = Date.now() + (2 * 60 * 1000); // 2 minute expiry
    const signature = await signSartopoRequest(method, path, expires, payload, secret);
    
    const authParams = new URLSearchParams();
    authParams.set('id', credId);
    authParams.set('expires', String(expires));
    authParams.set('signature', signature);
    
    let finalUrl = `https://sartopo.com${path}`;
    let body: BodyInit | null = payload;
    const headers: HeadersInit = { 'Accept': 'application/json' };
    
    if (method.toUpperCase() === 'POST') {
      const form = new URLSearchParams(authParams);
      if (payload) {
        form.set('json', payload);
      }
      body = form;
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else { // GET
      const queryBase = new URLSearchParams(sartopoConfig?.params || '');
      authParams.forEach((v, k) => queryBase.set(k, v));
      const queryString = queryBase.toString() ? `?${queryBase.toString()}` : '';
      finalUrl += queryString;
      body = null; // No body for GET
    }
    
    console.log(`[sartopo-proxy] Forwarding request to SARTopo: ${finalUrl}`);
    
    const sartopoResponse = await fetch(finalUrl, {
      method: method,
      headers: headers,
      body: body,
    });
    
    console.log(`[sartopo-proxy] Received response from SARTopo with status: ${sartopoResponse.status}`);
    
    const contentType = sartopoResponse.headers.get('content-type');
    if (!sartopoResponse.ok || !contentType || !contentType.includes('application/json')) {
      const errorText = await sartopoResponse.text();
      throw new Error(`SARTopo API Error (HTTP ${sartopoResponse.status}). Expected JSON but got ${contentType || 'none'}. Response: ${errorText.substring(0, 300)}...`);
    }
    
    const responseData = await sartopoResponse.json();
    
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: sartopoResponse.status,
    });
  } catch (error) {
    console.error('[sartopo-proxy] Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});