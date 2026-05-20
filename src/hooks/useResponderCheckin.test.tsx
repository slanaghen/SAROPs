import React, { useEffect } from 'react';
import { render, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useResponderCheckin } from '../hooks/useResponderCheckin';
import { Responder } from '../types/sarops-types';

const HookTest = ({ onReady }: { onReady: (hook: ReturnType<typeof useResponderCheckin>) => void }) => {
  const hook = useResponderCheckin();

  useEffect(() => {
    onReady(hook);
  }, [hook, onReady]);

  return null;
};

describe('useResponderCheckin hook', () => {
  it('checks in 20 dummy responders with two dog handlers, two UAS pilots, and the rest without special capabilities', async () => {
    let hook: ReturnType<typeof useResponderCheckin> | null = null;

    render(<HookTest onReady={h => { hook = h; }} />);

    await act(async () => Promise.resolve());

    if (!hook) {
      throw new Error('Hook did not initialize');
    }

    const responders: Responder[] = [
      { responder_id: 'dog-1', name: 'Dog Handler 1', agency: 'K9 Unit', identifier: 'K9101', cell_phone: '555-000-0001', special_skills: 'Dog Handler', device_id: 'device-1', checkin_datetime: new Date().toISOString(), checkout_datetime: null, status: 'Staged' },
      { responder_id: 'dog-2', name: 'Dog Handler 2', agency: 'K9 Unit', identifier: 'K9102', cell_phone: '555-000-0002', special_skills: 'Dog Handler', device_id: 'device-2', checkin_datetime: new Date().toISOString(), checkout_datetime: null, status: 'Staged' },
      { responder_id: 'uas-1', name: 'UAS Pilot 1', agency: 'UAS Team', identifier: 'UAS101', cell_phone: '555-000-0011', special_skills: 'UAS Pilot', device_id: 'device-3', checkin_datetime: new Date().toISOString(), checkout_datetime: null, status: 'Staged' },
      { responder_id: 'uas-2', name: 'UAS Pilot 2', agency: 'UAS Team', identifier: 'UAS102', cell_phone: '555-000-0012', special_skills: 'UAS Pilot', device_id: 'device-4', checkin_datetime: new Date().toISOString(), checkout_datetime: null, status: 'Staged' },
      ...Array.from({ length: 16 }, (_, index) => ({
        responder_id: `responder-${index + 1}`,
        name: `Responder ${index + 1}`,
        agency: 'SAR Division',
        identifier: `RS${100 + index}`,
        cell_phone: `555-001-${String(index + 1).padStart(4, '0')}`,
        special_skills: undefined,
        device_id: `device-${index + 5}`,
        checkin_datetime: new Date().toISOString(),
        checkout_datetime: null,
        status: 'Staged' as const,
      })),
    ];

    for (const responder of responders) {
      await act(async () => {
        await hook!.checkIn(responder);
      });

      expect(hook!.checkedInResponder).toEqual(responder);
      expect(hook!.isCheckedIn).toBe(true);
      expect(hook!.error).toBeNull();
      expect(hook!.loading).toBe(false);
    }

    const dogHandlers = responders.filter(r => r.special_skills === 'Dog Handler');
    const uasPilots = responders.filter(r => r.special_skills === 'UAS Pilot');
    const noSpecialSkills = responders.filter(r => !r.special_skills);

    expect(dogHandlers).toHaveLength(2);
    expect(uasPilots).toHaveLength(2);
    expect(noSpecialSkills).toHaveLength(16);
    expect(responders).toHaveLength(20);
  });
});
