import { vi, describe, it, expect, beforeEach } from 'vitest';
import { sendMessage, sendBroadcastMessage } from './messageService';
import { TEAM_TYPE } from '../utils/constants';

describe('Message Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn(),
  };
  const mockAddToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendMessage', () => {
    it('should insert a message and return the new record', async () => {
      const newMessage = { team_id: 't-1', sender_name: 'Steve', message_text: 'Test message' };
      mockSupabase.single.mockResolvedValue({ data: newMessage, error: null });

      const result = await sendMessage({
        supabase: mockSupabase,
        messageText: '  Test message  ',
        messagingChannelId: 't-1',
        senderDisplay: 'Steve',
        addToast: mockAddToast,
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        team_id: 't-1',
        sender_name: 'Steve',
        message_text: 'Test message', // Verifies trimming
      });
      expect(mockAddToast).toHaveBeenCalledWith('Message sent successfully.', 'success');
      expect(result).toEqual(newMessage);
    });

    it('should return null and not call insert if message is empty', async () => {
      const result = await sendMessage({
        supabase: mockSupabase,
        messageText: '   ',
        messagingChannelId: 't-1',
        senderDisplay: 'Steve',
        addToast: mockAddToast,
      });

      expect(mockSupabase.insert).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should throw an error if the database call fails', async () => {
      const dbError = new Error('Permission denied');
      mockSupabase.single.mockResolvedValue({ data: null, error: dbError });

      await expect(sendMessage({
        supabase: mockSupabase,
        messageText: 'This will fail',
        messagingChannelId: 't-1',
        senderDisplay: 'Steve',
        addToast: mockAddToast,
      })).rejects.toThrow(dbError);

      expect(mockAddToast).toHaveBeenCalledWith('Failed to send message: Permission denied', 'error');
    });
  });

  describe('sendBroadcastMessage', () => {
    const mockRecordAction = vi.fn();
    const mockSetBroadcastMessage = vi.fn();
    const mockSetShowBroadcastModal = vi.fn();
    const teams = [
      { team_id: 't-staff', type: TEAM_TYPE.STAFF },
      { team_id: 't-ground', type: TEAM_TYPE.GROUND },
    ];

    it('should send a broadcast to the Staff team and perform cleanup', async () => {
      mockSupabase.insert.mockResolvedValue({ error: null });

      await sendBroadcastMessage({
        supabase: mockSupabase,
        broadcastMessage: '  Everyone meet at CP.  ',
        teams,
        responderName: 'IC',
        recordAction: mockRecordAction,
        addToast: mockAddToast,
        setBroadcastMessage: mockSetBroadcastMessage,
        setShowBroadcastModal: mockSetShowBroadcastModal,
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        team_id: 't-staff',
        sender_name: 'IC (Broadcast)',
        message_text: 'Everyone meet at CP.',
      });
      expect(mockRecordAction).toHaveBeenCalledWith(expect.stringContaining('Sent broadcast message to 2 teams.'));
      expect(mockAddToast).toHaveBeenCalledWith('Broadcast message sent.', 'success');
      expect(mockSetBroadcastMessage).toHaveBeenCalledWith('');
      expect(mockSetShowBroadcastModal).toHaveBeenCalledWith(false);
    });

    it('should throw an error if no Staff team is found', async () => {
      const noStaffTeams = [{ team_id: 't-ground', type: TEAM_TYPE.GROUND }];

      await expect(sendBroadcastMessage({
        supabase: mockSupabase,
        broadcastMessage: 'Test',
        teams: noStaffTeams,
        responderName: 'IC',
        recordAction: mockRecordAction,
        addToast: mockAddToast,
        setBroadcastMessage: mockSetBroadcastMessage,
        setShowBroadcastModal: mockSetShowBroadcastModal,
      })).rejects.toThrow('No Staff team found to receive broadcast.');

      expect(mockAddToast).toHaveBeenCalledWith('No Staff team found to receive broadcast.', 'error');
    });
  });
});