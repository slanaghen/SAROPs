const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');

const app = express();
app.use(express.json());

// Configure CORS to be more restrictive.
// In a production environment, you would replace 'http://localhost:5173'
// with your actual frontend application's domain.
app.use(cors({
  origin: 'http://localhost:5173'
}));

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

    const readOnlyAuth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );

    const sheets = google.sheets({ version: 'v4', auth: readOnlyAuth });
    
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

app.post('/api/sheets/update-values', async (req, res) => {
  try {
    const { spreadsheetId, values } = req.body;

    if (!spreadsheetId || !values || Object.keys(values).length === 0) {
      return res.status(400).json({ error: 'spreadsheetId and a non-empty values object are required.' });
    }

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ error: 'Google credentials not configured on server.' });
    }

    // Use a separate auth client with write permissions for this endpoint
    const writeAuth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey,
      ['https://www.googleapis.com/auth/spreadsheets'] // Full read/write scope
    );

    const sheets = google.sheets({ version: 'v4', auth: writeAuth });

    const data = Object.entries(values).map(([range, value]) => ({
      range,
      values: [[value]],
    }));

    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error('Proxy Write Error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`SAROps Sheet Proxy running on port ${PORT}`);
});

module.exports = app; // Export for testing