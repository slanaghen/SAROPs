import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { label } = await req.json();
    if (!label) {
      throw new Error('Incident label is required.');
    }

    const sarstreamApiKey = Deno.env.get('SARSTREAM_API_KEY');
    if (!sarstreamApiKey) {
      throw new Error('SARStream API key is not configured in secrets.');
    }

    const response = await fetch('https://sarstream.boulderrescue.app/api/links/view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': sarstreamApiKey,
      },
      body: JSON.stringify({ requester: 'SAROps', ttl_minutes: 480, label: label }),
    });

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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});