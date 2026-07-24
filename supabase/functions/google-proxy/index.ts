import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { JWT } from "https://esm.sh/google-auth-library@9"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { spreadsheetId } = await req.json()
    
    const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL')
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

    if (!clientEmail || !privateKey) {
      throw new Error('Google credentials not configured in Edge Function secrets.')
    }

    // 1. Initialize Auth
    const client = new JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    // 2. Fetch Spreadsheet Metadata (Named Ranges)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=namedRanges`
    const res = await client.request({ url })

    return new Response(
      JSON.stringify(res.data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})