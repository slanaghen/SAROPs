import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  checkInResponder,
  checkOutResponder,
  updateResponderStatus,
  getResponder,
  assignResponderToTeam,
  removeResponderFromTeam,
} from './responderService';
import { SupabaseClient } from '@supabase/supabase-js';
import { Responder } from '../types/sarops-types';

describe('responderService', () => {
  let mockSupabase: SupabaseClient;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockInsert: ReturnType<typeof vi.fn>;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;
  let mockEq: ReturnType<typeof vi.fn>;
  let mockSelect: ReturnType<typeof vi.fn>;
  let mockSingle: ReturnType<typeof vi.fn>;
  let mockMaybeSingle: ReturnType<typeof vi.fn>;
  let mockIn: ReturnType<typeof vi.fn>;
  let mockIs: ReturnType<typeof vi.fn>;
  let mockOrder: ReturnType<typeof vi.fn>;
  let mockOr: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();

    const queryMock: any = {};

    // Define all builder methods to return the queryMock object to ensure chainability
    mockEq = vi.fn().mockReturnValue(queryMock);
    mockIn = vi.fn().mockReturnValue(queryMock);
    mockIs = vi.fn().mockReturnValue(queryMock);
    mockSelect = vi.fn().mockReturnValue(queryMock);
    mockInsert = vi.fn().mockReturnValue(queryMock);
    mockUpdate = vi.fn().mockReturnValue(queryMock);
    mockDelete = vi.fn().mockReturnValue(queryMock);
    mockOrder = vi.fn().mockReturnValue(queryMock);
    mockOr = vi.fn().mockReturnValue(queryMock);
    mockSingle = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockMaybeSingle = vi.fn().mockResolvedValue({ data: {}, error: null });

    Object.assign(queryMock, {
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      eq: mockEq,
      in: mockIn,
      is: mockIs,
      select: mockSelect,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      order: mockOrder,
      or: mockOr,
      then: vi.fn().mockImplementation((onFulfilled, onRejected) =>
        Promise.resolve({ data: {}, error: null }).then(onFulfilled, onRejected)
      ),
    });

    mockFrom = vi.fn().mockReturnValue(queryMock);

    mockSupabase = {
      from: mockFrom,
    } as any;
  });

  it('checkInResponder should insert a new responder', async () => {
    const responder: Responder = {
      responder_id: '123',
      name: 'Test',
      email: 'test@test.com',
      agency: 'Agency',
      identifier: 'ID',
      cell_phone: '123-456-7890',
      device_id: 'device1',
      checkin_datetime: new Date().toISOString(),
      status: 'Staged',
      access_level: 'responder',
      incident_id: 'inc1',
    };
    mockSingle.mockResolvedValueOnce({ data: responder, error: null });

    await checkInResponder(mockSupabase, responder);

    expect(mockFrom).toHaveBeenCalledWith('responders');
    expect(mockInsert).toHaveBeenCalledWith([responder]);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockSingle).toHaveBeenCalled();
  });

  it('checkOutResponder should update responder status and checkout time', async () => {
    const responderId = '123';
    mockSingle.mockResolvedValueOnce({ data: {}, error: null });

    await checkOutResponder(mockSupabase, responderId);

    expect(mockFrom).toHaveBeenCalledWith('responders');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'CheckedOut' }));
    expect(mockEq).toHaveBeenCalledWith('responder_id', responderId);
  });

  it('updateResponderStatus should update responder status', async () => {
    const responderId = '123';
    const newStatus = 'Deployed';
    mockSingle.mockResolvedValueOnce({ data: {}, error: null });

    await updateResponderStatus(mockSupabase, responderId, newStatus);

    expect(mockFrom).toHaveBeenCalledWith('responders');
    expect(mockUpdate).toHaveBeenCalledWith({ status: newStatus });
    expect(mockEq).toHaveBeenCalledWith('responder_id', responderId);
  });

  it('getResponder should fetch a responder by ID', async () => {
    const responderId = '123';
    mockSingle.mockResolvedValueOnce({ data: { responder_id: responderId }, error: null });

    await getResponder(mockSupabase, responderId);

    expect(mockFrom).toHaveBeenCalledWith('responders');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEq).toHaveBeenCalledWith('responder_id', responderId);
    expect(mockSingle).toHaveBeenCalled();
  });

  it('assignResponderToTeam should insert into team_responders and update responder status', async () => {
    const responderId = 'res1';
    const teamId = 'team1';

    await assignResponderToTeam(mockSupabase, responderId, teamId);

    expect(mockFrom).toHaveBeenCalledWith('team_responders');
    expect(mockInsert).toHaveBeenCalledWith({ team_id: teamId, responder_id: responderId });
    expect(mockFrom).toHaveBeenCalledWith('responders');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'Attached' });
    expect(mockFrom).toHaveBeenCalledWith('responder_team_history');
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ responder_id: responderId, team_id: teamId }));
  });

  it('removeResponderFromTeam should delete from team_responders and update responder status', async () => {
    const responderId = 'res1';
    const teamId = 'team1';
    mockSingle.mockResolvedValueOnce({ data: { history_id: 'h1' }, error: null }); // history select

    await removeResponderFromTeam(mockSupabase, responderId, teamId);

    expect(mockFrom).toHaveBeenCalledWith('team_responders');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('team_id', teamId);
    expect(mockEq).toHaveBeenCalledWith('responder_id', responderId);
    expect(mockFrom).toHaveBeenCalledWith('responders');
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'Staged' });
    expect(mockFrom).toHaveBeenCalledWith('responder_team_history');
    expect(mockSelect).toHaveBeenCalled();
  });
});