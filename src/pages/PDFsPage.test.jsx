import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PDFsPage from './PDFsPage';
import { useIncident } from '../context/IncidentContext';
import useResponderTeamAndAssignment from '../hooks/useResponderTeamAndAssignment';
import { PDFDocument } from 'pdf-lib';

vi.mock('../context/IncidentContext', () => ({
  useIncident: vi.fn(),
}));

vi.mock('../hooks/useResponderTeamAndAssignment', () => ({
  default: vi.fn(),
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: vi.fn(),
  },
}));

// Note: import.meta.glob is a Vite transform and cannot be easily mocked via vi.mock.
// The test will rely on the presence of PDF files in src/assets or the environment's 
// ability to resolve the glob naturally. The HTML dump confirms options are 
// populated in the test environment.

describe('PDFsPage Functional Tests', () => {
  const mockFields = [
    { getName: () => 'incident name', setText: vi.fn() },
    { getName: () => 'TAC Channel', setText: vi.fn() },
    { getName: () => 'Division', setText: vi.fn() },
    { getName: () => 'OP PERIOD', setText: vi.fn() },
    { getName: () => 'UnrelatedField', setText: vi.fn() }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock URL methods which are required for generating the PDF preview blob but missing in JSDOM
    global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mocking the PDF processing pipeline
    const mockForm = {
      getFields: () => mockFields,
      getTextField: (name) => mockFields.find(f => f.getName() === name)
    };
    const mockDoc = {
      getForm: () => mockForm,
      save: vi.fn().mockResolvedValue(new Uint8Array())
    };
    vi.mocked(PDFDocument.load).mockResolvedValue(mockDoc);
    
    // Global fetch mock for PDF assets
    global.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8))
    });

    vi.mocked(useIncident).mockReturnValue({
      incidentData: { name: 'Operation Silver Oak', opNumber: 1 },
      incidentId: 'INC-2024-001',
      responderName: 'Steve'
    });

    vi.mocked(useResponderTeamAndAssignment).mockReturnValue({
      team: { team_name_number: 'Team 1' },
      assignment: { title: 'Sector Alpha', segment: 'Alpha', frequency_primary: '155.125' }
    });
  });

  afterEach(cleanup);

  it('successfully extracts and displays fillable field names in the sidebar', async () => {
    render(<PDFsPage />);
    
    const selector = screen.getByLabelText(/Select Document:/i);
    
    // Dynamically identify and select the first valid PDF option from the dropdown
    const options = screen.getAllByRole('option');
    const validPdfPath = options.find(opt => opt.value !== '')?.value;
    
    if (!validPdfPath) throw new Error("No PDF options available in test environment. Ensure PDF files exist in src/assets.");
    fireEvent.change(selector, { target: { value: validPdfPath } });

    // Check that field names from our mock are rendered in the sidebar
    await waitFor(() => {
      expect(screen.getByText('incident name')).toBeInTheDocument();
      expect(screen.getByText('TAC Channel')).toBeInTheDocument();
    });

    // Verify auto-fill values were calculated and applied
    await waitFor(() => {
      expect(mockFields[0].setText).toHaveBeenCalledWith('Operation Silver Oak');
      expect(mockFields[1].setText).toHaveBeenCalledWith('155.125');
      expect(mockFields[2].setText).toHaveBeenCalledWith('Alpha');
      expect(mockFields[3].setText).toHaveBeenCalledWith('1');
    });
  });

  it('does not attempt to fill fields that do not match the operational mapping', async () => {
    render(<PDFsPage />);
    const selector = screen.getByLabelText(/Select Document:/i);
    const options = screen.getAllByRole('option');
    const validPdfPath = options.find(opt => opt.value !== '')?.value;
    
    if (!validPdfPath) throw new Error("No PDF options available in test environment.");
    fireEvent.change(selector, { target: { value: validPdfPath } });

    await waitFor(() => {
      expect(mockFields[4].setText).not.toHaveBeenCalled();
    });
  });

  it('renders an empty state when no document is selected', () => {
    render(<PDFsPage />);
    expect(screen.getByText(/No Document Selected/i)).toBeInTheDocument();
    expect(screen.queryByTitle('PDF Viewer')).not.toBeInTheDocument();
    expect(screen.queryByText('Fillable Fields')).not.toBeInTheDocument();
  });
});