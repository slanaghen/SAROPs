import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import OpPeriodFormSection from './OpPeriodFormSection';

describe('OpPeriodFormSection', () => {
  const defaultProps = {
    operationalPeriod: {
      op_number: '1',
      start_datetime: '2024-01-01T12:00',
      end_datetime: '',
      situation_narrative: 'Initial objective.',
      par_check_interval: 60,
      situational_awareness_narrative: 'Clear weather.',
      sarstream_enabled: false,
    },
    handleOperationalPeriodChange: vi.fn(),
    isStreamEnabled: false,
    isStreamLoading: false,
    handleToggleSarStream: vi.fn(),
    existingId: 'inc-123', // Assume incident exists for SARStream button visibility
    targetOpId: 'op-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all form fields with initial data', () => {
    render(<OpPeriodFormSection {...defaultProps} />);

    expect(screen.getByLabelText(/OP Number/i)).toHaveValue('1');
    expect(screen.getByLabelText(/OP Start Date \/ Time/i)).toHaveValue('2024-01-01T12:00');
    expect(screen.getByLabelText(/Operational Period Objective/i)).toHaveValue('Initial objective.');
    expect(screen.getByLabelText(/PAR Interval \(minutes\)/i)).toHaveValue(60);
    expect(screen.getByLabelText(/Situational Awareness Narrative/i)).toHaveValue('Clear weather.');
  });

  it('calls handleOperationalPeriodChange when a field is updated', () => {
    render(<OpPeriodFormSection {...defaultProps} />);

    const opNumberInput = screen.getByLabelText(/OP Number/i);
    fireEvent.change(opNumberInput, { target: { value: '2' } });

    expect(defaultProps.handleOperationalPeriodChange).toHaveBeenCalledWith('op_number', '2');
  });

  it('toggles PAR interval between 60 and 0', () => {
    const { rerender } = render(<OpPeriodFormSection {...defaultProps} />);

    // Disable PAR
    const disableParButton = screen.getByRole('button', { name: /Disable PAR/i });
    fireEvent.click(disableParButton);
    expect(defaultProps.handleOperationalPeriodChange).toHaveBeenCalledWith('par_check_interval', 0);

    // Re-enable PAR
    rerender(<OpPeriodFormSection {...defaultProps} operationalPeriod={{ ...defaultProps.operationalPeriod, par_check_interval: 0 }} />);
    const enableParButton = screen.getByRole('button', { name: /Enable PAR/i });
    fireEvent.click(enableParButton);
    expect(defaultProps.handleOperationalPeriodChange).toHaveBeenCalledWith('par_check_interval', 60);
  });

  it('shows "Enable SARStream" button when not enabled and incident exists', () => {
    render(<OpPeriodFormSection {...defaultProps} isStreamEnabled={false} existingId="inc-123" />);
    expect(screen.getByRole('button', { name: /Enable SARStream/i })).toBeInTheDocument();
  });

  it('shows "Disable SARStream" button when enabled and incident exists', () => {
    render(<OpPeriodFormSection {...defaultProps} isStreamEnabled={true} existingId="inc-123" />);
    expect(screen.getByRole('button', { name: /Disable SARStream/i })).toBeInTheDocument();
  });

  it('calls handleToggleSarStream when SARStream button is clicked', () => {
    render(<OpPeriodFormSection {...defaultProps} isStreamEnabled={false} existingId="inc-123" />);
    fireEvent.click(screen.getByRole('button', { name: /Enable SARStream/i }));
    expect(defaultProps.handleToggleSarStream).toHaveBeenCalled();
  });

  it('disables SARStream button when isStreamLoading is true', () => {
    render(<OpPeriodFormSection {...defaultProps} isStreamLoading={true} existingId="inc-123" />);
    expect(screen.getByRole('button', { name: /Updating.../i })).toBeDisabled();
  });

  it('does not show SARStream button if no existingId', () => {
    render(<OpPeriodFormSection {...defaultProps} existingId={null} />);
    expect(screen.queryByRole('button', { name: /SARStream/i })).not.toBeInTheDocument();
  });

  it('shows OP End Date / Time when existingId is true', () => {
    render(<OpPeriodFormSection {...defaultProps} existingId="inc-123" />);
    expect(screen.getByLabelText(/OP End Date \/ Time/i)).toBeInTheDocument();
  });

  it('does not show OP End Date / Time when existingId is null', () => {
    render(<OpPeriodFormSection {...defaultProps} existingId={null} />);
    expect(screen.queryByLabelText(/OP End Date \/ Time/i)).not.toBeInTheDocument();
  });

  it('updates OP End Date / Time when existingId is true', () => {
    render(<OpPeriodFormSection {...defaultProps} existingId="inc-123" />);
    const opEndDateInput = screen.getByLabelText(/OP End Date \/ Time/i);
    fireEvent.change(opEndDateInput, { target: { value: '2024-01-01T13:00' } });
    expect(defaultProps.handleOperationalPeriodChange).toHaveBeenCalledWith('end_datetime', '2024-01-01T13:00');
  });

  it('renders with sarstream_enabled true in initialData', () => {
    const propsWithStreamEnabled = {
      ...defaultProps,
      operationalPeriod: {
        ...defaultProps.operationalPeriod,
        sarstream_enabled: true,
      },
      isStreamEnabled: true,
    };
    render(<OpPeriodFormSection {...propsWithStreamEnabled} />);
    expect(screen.getByRole('button', { name: /Disable SARStream/i })).toBeInTheDocument();
  });
});