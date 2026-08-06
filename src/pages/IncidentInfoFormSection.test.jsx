import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import IncidentInfoFormSection from './IncidentInfoFormSection';

describe('IncidentInfoFormSection', () => {
  const defaultProps = {
    incident: {
      name: 'Test Incident',
      number: '2024-001',
      sartopo_id: '',
      start_datetime: '2024-01-01T12:00',
      end_datetime: '',
      notes: 'Some notes.',
    },
    handleIncidentChange: vi.fn(),
    isCreatingMap: false,
    isSaving: false,
    handleCreateMap: vi.fn(),
    sartopoUrl: null,
    isSyncingSartopo: false,
    sartopoIdValidationMessage: null,
    sartopoSyncErrorMessage: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields with initial data', () => {
    render(<BrowserRouter><IncidentInfoFormSection {...defaultProps} /></BrowserRouter>);

    expect(screen.getByLabelText(/Incident Name/i)).toHaveValue('Test Incident');
    expect(screen.getByLabelText(/Incident Number/i)).toHaveValue('2024-001');
    expect(screen.getByLabelText(/SARTopo Map ID/i)).toHaveValue('');
    expect(screen.getByLabelText(/Start Date \/ Time/i)).toHaveValue('2024-01-01T12:00');
    expect(screen.getByLabelText(/Incident Narrative/i)).toHaveValue('Some notes.');
  });

  it('calls handleIncidentChange when a field is updated', () => {
    render(<BrowserRouter><IncidentInfoFormSection {...defaultProps} /></BrowserRouter>);

    const nameInput = screen.getByLabelText(/Incident Name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Incident Name' } });

    expect(defaultProps.handleIncidentChange).toHaveBeenCalledWith('name', 'Updated Incident Name');
  });

  it('displays SARTopo validation and sync error messages', () => {
    const propsWithErrors = {
      ...defaultProps,
      sartopoIdValidationMessage: 'Map ID is too short.',
      sartopoSyncErrorMessage: 'Sync failed.',
    };
    render(<BrowserRouter><IncidentInfoFormSection {...propsWithErrors} /></BrowserRouter>);

    expect(screen.getByText('Map ID is too short.')).toBeInTheDocument();
    expect(screen.getByText('Sync failed.')).toBeInTheDocument();
    expect(screen.getByLabelText(/SARTopo Map ID/i)).toHaveStyle('border-color: rgb(220, 38, 38)');
  });

  it('calls handleCreateMap when "Create Map" button is clicked', () => {
    render(<BrowserRouter><IncidentInfoFormSection {...defaultProps} /></BrowserRouter>);

    const createMapButton = screen.getByRole('button', { name: /Create Map/i });
    fireEvent.click(createMapButton);

    expect(defaultProps.handleCreateMap).toHaveBeenCalled();
  });

  it('disables "Create Map" button when a sartopo_id exists', () => {
    const propsWithId = {
      ...defaultProps,
      incident: { ...defaultProps.incident, sartopo_id: 'ABCD' },
    };
    render(<BrowserRouter><IncidentInfoFormSection {...propsWithId} /></BrowserRouter>);

    expect(screen.getByRole('button', { name: /Create Map/i })).toBeDisabled();
  });

  it('shows "Creating..." text when isCreatingMap is true', () => {
    render(<BrowserRouter><IncidentInfoFormSection {...defaultProps} isCreatingMap={true} /></BrowserRouter>);
    expect(screen.getByRole('button', { name: /Creating.../i })).toBeInTheDocument();
  });

  it('shows "Open Map" link when sartopoUrl is provided', () => {
    const propsWithUrl = { ...defaultProps, sartopoUrl: 'https://sartopo.com/m/TEST' };
    render(<BrowserRouter><IncidentInfoFormSection {...propsWithUrl} /></BrowserRouter>);

    const openMapLink = screen.getByRole('link', { name: /Open Map/i });
    expect(openMapLink).toBeInTheDocument();
    expect(openMapLink).toHaveAttribute('href', 'https://sartopo.com/m/TEST');
  });

  it('shows syncing indicator when isSyncingSartopo is true', () => {
    render(<BrowserRouter><IncidentInfoFormSection {...defaultProps} isSyncingSartopo={true} /></BrowserRouter>);
    expect(screen.getByText(/Syncing.../i)).toBeInTheDocument();
  });
});