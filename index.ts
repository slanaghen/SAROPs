import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const { label } = await req.json();
    if (!label) {
      throw new Error('A "label" for the stream is required.');
    }

    const apiKey = Deno.env.get('SARSTREAM_API_KEY');
    if (!apiKey) {
      throw new Error('SARStream API key is not configured in the Edge Function environment.');
    }

    const payload = {
      requester: 'SAROPs',
      ttl_minutes: 480, // Default to 8 hours per specification
      label: label,
    };

    console.log(`[sarstream-proxy] Creating SARStream link with label: "${label}"`);

    const response = await fetch('https://sarstream.boulderrescue.app/api/links/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    console.log(`[sarstream-proxy] Received response from SARStream with status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SARStream API error: ${response.status} ${errorBody}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[sarstream-proxy] Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});