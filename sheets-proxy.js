const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Allow your Vite frontend to call this

const PORT = process.env.PORT || 3001;

app.post('/api/sheets/named-ranges', async (req, res) => {
  try {
    const { spreadsheetId } = req.body;
    
    // Get credentials from environment variables
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ error: 'Google credentials not configured on server.' });
    }

    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'namedRanges',
    });

    res.json(response.data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`SAROps Sheet Proxy running on port ${PORT}`);
});