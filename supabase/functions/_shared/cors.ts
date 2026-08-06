// Define allowed origins for CORS. In a real production environment,
// the wildcard '*' should be replaced with the specific domain of your frontend application.
const allowedOrigins = [
  'http://localhost:5173', // Vite dev server
  // 'https://your-production-app-domain.com' // TODO: Add your production domain here
];

export const corsHeaders = {
  // For now, we will dynamically set the origin based on the request.
  // In a production setting, you might lock this down further.
  'Access-Control-Allow-Origin': allowedOrigins.join(', '),
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};