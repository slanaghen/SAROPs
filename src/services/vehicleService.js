// src/services/vehicleService.js

import { VEHICLE_STATUS } from '../utils/constants';

/**
 * Saves (creates or updates) a vehicle record.
 * @param {object} params - The parameters for saving the vehicle.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {object} params.formData - The form data for the vehicle.
 * @param {string} params.incidentId - The ID of the current incident.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const saveVehicle = async ({ supabase, formData, incidentId, addToast }) => {
  try {
    const payload = {
      designation: formData.designation,
      type: formData.type,
      status: formData.status,
      incident_id: formData.incident_id || incidentId
    };

    if (formData.vehicle_id) {
      const { error: updateError } = await supabase.from('vehicles').update(payload).eq('vehicle_id', formData.vehicle_id);
      if (updateError) throw updateError;
      addToast(`Vehicle ${formData.designation} updated.`, 'success');
    } else {
      if (!incidentId && !formData.incident_id) throw new Error("Select an incident context.");
      // Use upsert to handle cases where the designation already exists for this incident
      const { error: insertError } = await supabase
        .from('vehicles')
        .upsert({ ...payload, checkin_datetime: new Date().toISOString() }, { onConflict: 'incident_id, designation' });
      if (insertError) throw insertError;
      addToast(`Vehicle ${formData.designation} checked in.`, 'success');
    }
  } catch (err) {
    console.error('Failed to save vehicle:', err);
    addToast(err.message || 'Failed to save vehicle.', 'error');
    throw err;
  }
};

/**
 * Checks out a vehicle, updating its status and checkout timestamp.
 * @param {object} params - The parameters for checking out the vehicle.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.vehicleId - The ID of the vehicle to check out.
 * @param {Array<object>} params.allVehicles - List of all vehicles (for logging designation).
 * @param {function} [params.recordAction] - Function to record an action in the log.
 * @param {function} params.addToast - Function to display toast notifications.
 */
export const checkOutVehicle = async ({ supabase, vehicleId, allVehicles, recordAction, addToast }) => {
  if (!window.confirm('Mark this vehicle as checked out?')) return;
  try {
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('vehicles')
      .update({ status: VEHICLE_STATUS.CHECKED_OUT, checkout_datetime: now })
      .eq('vehicle_id', vehicleId);

    if (updateError) throw updateError;
    const vehicle = allVehicles.find(v => v.vehicle_id === vehicleId);
    await recordAction?.(`Admin checked out vehicle "${vehicle?.designation || 'Unknown'}" (ID: ${vehicleId}).`);
    addToast('Vehicle checked out.', 'success');
  } catch (err) {
    console.error('Failed to check out vehicle:', err);
    addToast('Failed to check out vehicle: ' + err.message, 'error');
    throw err;
  }
};

/**
 * Deletes a vehicle record.
 * @param {object} params - The parameters for deleting the vehicle.
 * @param {object} params.supabase - The Supabase client instance.
 * @param {string} params.vehicleId - The ID of the vehicle to delete.
 * @param {string} params.designation - The designation of the vehicle (for logging).
 * @param {function} [params.recordAction] - Function to record an action in the log.
 * @param {function} params.addToast - Function to display toast notifications.
 * @param {function} params.fetchTable - Function to refresh the vehicles table.
 */
export const deleteVehicle = async ({ supabase, vehicleId, designation, recordAction, addToast, fetchTable }) => {
  const { error: deleteError } = await supabase.from('vehicles').delete().eq('vehicle_id', vehicleId);
  if (deleteError) throw deleteError;
  await recordAction?.(`Admin deleted vehicle "${designation}" (ID: ${vehicleId}).`);
  addToast('Vehicle record deleted.', 'success');
  await fetchTable('vehicles');
};