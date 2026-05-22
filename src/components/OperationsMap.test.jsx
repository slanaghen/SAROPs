import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OperationsMap from './OperationsMap';

describe('OperationsMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup env mock for the key
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'valid-test-key');
  });

  it('renders the map container when an API key is present', () => {
    const { container } = render(<OperationsMap loading={false} />);
    // Should find the map container div
    expect(container.querySelector('.map-container')).toBeInTheDocument();
  });

  it('renders fallback UI when the Google Maps API key is missing', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');

    render(<OperationsMap loading={false} />);
    
    expect(await screen.findByText(/Interactive Map Unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Configure a valid/i)).toBeInTheDocument();
    expect(screen.getByText(/Google Maps API Key/i)).toBeInTheDocument();
  });

  it('renders fallback UI when the API key is the placeholder', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'YOUR_GOOGLE_MAPS_API_KEY');

    render(<OperationsMap loading={false} />);
    
    expect(await screen.findByText(/Interactive Map Unavailable/i)).toBeInTheDocument();
  });
});