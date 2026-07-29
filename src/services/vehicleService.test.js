import { vi, describe, it, expect, beforeEach } from 'vitest';
import { saveVehicle, checkOutVehicle, deleteVehicle } from './vehicleService';
import { VEHICLE_STATUS } from '../utils/constants';

describe('Vehicle Service', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
  };
  const mockAddToast = vi.fn();
  const mockRecordAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  describe('saveVehicle', () => {
    it('should call upsert for a new vehicle', async () => {
      const formData = { designation: 'SAR-1', type: 'Truck', status: 'Staged' };
      mockSupabase.upsert.mockResolvedValue({ error: null });

      await saveVehicle({
        supabase: mockSupabase,
        formData,
        incidentId: 'inc-1',
        addToast: mockAddToast,
      });

      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ...formData,
          incident_id: 'inc-1',
          checkin_datetime: expect.any(String),
        }),
        { onConflict: 'incident_id, designation' }
      );
      expect(mockAddToast).toHaveBeenCalledWith('Vehicle SAR-1 checked in.', 'success');
    });

    it('should call update for an existing vehicle', async () => {
      const formData = { vehicle_id: 'v-1', designation: 'SAR-1', type: 'Truck', status: 'Staged', incident_id: 'inc-1' };
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockReturnValue({ update: mockUpdate });

      await saveVehicle({
        supabase: mockSupabase,
        formData,
        incidentId: 'inc-1',
        addToast: mockAddToast,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        designation: 'SAR-1',
        type: 'Truck',
        status: 'Staged',
        incident_id: 'inc-1',
      });
      expect(mockEq).toHaveBeenCalledWith('vehicle_id', 'v-1');
      expect(mockAddToast).toHaveBeenCalledWith('Vehicle SAR-1 updated.', 'success');
    });

    it('should throw an error if incidentId is missing for a new vehicle', async () => {
      const formData = { designation: 'SAR-1' };
      await expect(saveVehicle({
        supabase: mockSupabase,
        formData,
        incidentId: null,
        addToast: mockAddToast,
      })).rejects.toThrow('Select an incident context.');
    });
  });

  describe('checkOutVehicle', () => {
    it('should update status and timestamp on checkout', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockReturnValue({ update: mockUpdate });
      const allVehicles = [{ vehicle_id: 'v-1', designation: 'SAR-1' }];

      await checkOutVehicle({
        supabase: mockSupabase,
        vehicleId: 'v-1',
        allVehicles,
        recordAction: mockRecordAction,
        addToast: mockAddToast,
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledWith({
        status: VEHICLE_STATUS.CHECKED_OUT,
        checkout_datetime: expect.any(String),
      });
      expect(mockEq).toHaveBeenCalledWith('vehicle_id', 'v-1');
      expect(mockRecordAction).toHaveBeenCalledWith('Admin checked out vehicle "SAR-1" (ID: v-1).');
      expect(mockAddToast).toHaveBeenCalledWith('Vehicle checked out.', 'success');
    });
  });

  describe('deleteVehicle', () => {
    it('should call delete and refresh the table', async () => {
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn(() => ({ eq: mockEq }));
      mockSupabase.from.mockReturnValue({ delete: mockDelete });
      const mockFetchTable = vi.fn();

      await deleteVehicle({
        supabase: mockSupabase,
        vehicleId: 'v-1',
        designation: 'SAR-1',
        recordAction: mockRecordAction,
        addToast: mockAddToast,
        fetchTable: mockFetchTable,
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('vehicles');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('vehicle_id', 'v-1');
      expect(mockRecordAction).toHaveBeenCalledWith('Admin deleted vehicle "SAR-1" (ID: v-1).');
      expect(mockAddToast).toHaveBeenCalledWith('Vehicle record deleted.', 'success');
      expect(mockFetchTable).toHaveBeenCalledWith('vehicles');
    });
  });
});