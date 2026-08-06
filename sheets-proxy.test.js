import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { google } from 'googleapis';
import request from 'supertest'; // Using supertest for easier Express app testing

// Mock the entire googleapis module
vi.mock('googleapis', () => ({
  google: {
    auth: {
      JWT: vi.fn(() => ({
        authorize: vi.fn((cb) => cb(null)), // Mock successful authorization
      })),
    },
    sheets: vi.fn(() => ({
      spreadsheets: {
        get: vi.fn(),
        values: {
          batchUpdate: vi.fn(),
        },
      },
    })),
  },
}));

// Mock environment variables
const mockClientEmail = 'test@example.com';
const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\\nTEST_KEY\\n-----END PRIVATE KEY-----\\n';

describe('sheets-proxy.js', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('GOOGLE_CLIENT_EMAIL', mockClientEmail);
    vi.stubEnv('GOOGLE_PRIVATE_KEY', mockPrivateKey);

    // Dynamically import the app after setting env vars
    // This ensures the app uses the mocked env vars
    app = require('./sheets-proxy');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules(); // Reset modules to ensure fresh import of app for each test
  });

  describe('POST /api/sheets/named-ranges', () => {
    it('should return named ranges for a valid spreadsheet ID', async () => {
      const mockNamedRanges = {
        namedRanges: [{ name: 'IncidentName' }, { name: 'OpPeriod' }],
      };
      vi.mocked(google.sheets().spreadsheets.get).mockResolvedValue({ data: mockNamedRanges });

      const res = await request(app)
        .post('/api/sheets/named-ranges')
        .send({ spreadsheetId: 'test-spreadsheet-id' });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockNamedRanges);
      expect(google.sheets().spreadsheets.get).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        fields: 'namedRanges',
      });
      expect(google.auth.JWT).toHaveBeenCalledWith(
        mockClientEmail,
        null,
        mockPrivateKey.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets.readonly']
      );
    });

    it('should return 500 if Google credentials are not configured', async () => {
      vi.unstubAllEnv(); // Unset env vars for this test

      const res = await request(app)
        .post('/api/sheets/named-ranges')
        .send({ spreadsheetId: 'test-spreadsheet-id' });

      expect(res.statusCode).toEqual(500);
      expect(res.body.error).toContain('Google credentials not configured on server.');
    });

    it('should return 400 for API errors', async () => {
      vi.mocked(google.sheets().spreadsheets.get).mockRejectedValue(new Error('API Error'));

      const res = await request(app)
        .post('/api/sheets/named-ranges')
        .send({ spreadsheetId: 'test-spreadsheet-id' });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('API Error');
    });
  });

  describe('POST /api/sheets/update-values', () => {
    it('should update values for a valid spreadsheet ID and values object', async () => {
      const mockBatchUpdateResponse = {
        spreadsheetId: 'test-spreadsheet-id',
        responses: [{ updatedCells: 2 }],
      };
      vi.mocked(google.sheets().spreadsheets.values.batchUpdate).mockResolvedValue({ data: mockBatchUpdateResponse });

      const res = await request(app)
        .post('/api/sheets/update-values')
        .send({ spreadsheetId: 'test-spreadsheet-id', values: { Range1: 'Value1', Range2: 'Value2' } });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockBatchUpdateResponse);
      expect(google.sheets().spreadsheets.values.batchUpdate).toHaveBeenCalledWith({
        spreadsheetId: 'test-spreadsheet-id',
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: [{ range: 'Range1', values: [['Value1']] }, { range: 'Range2', values: [['Value2']] }],
        },
      });
      expect(google.auth.JWT).toHaveBeenCalledWith(
        mockClientEmail,
        null,
        mockPrivateKey.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/spreadsheets']
      );
    });

    it('should return 400 if spreadsheetId or values are missing', async () => {
      const res = await request(app).post('/api/sheets/update-values').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('spreadsheetId and a non-empty values object are required.');
    });
  });
});