import { useState, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { Responder } from '../types/sarops-types';

/**
 * useResponderCheckin Hook
 * 
 * Manages responder checkin state and operations
 * Handles:
 * - Saving responder to database
 * - Tracking checkin status
 * - Error handling
 */

export interface UseResponderCheckinReturn {
  // State
  checkedInResponder: Responder | null;
  isCheckedIn: boolean;
  loading: boolean;
  error: string | null;

  // Methods
  checkIn: (responder: Responder) => Promise<Responder>;
  checkOut: (responderId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

/**
 * Hook for managing responder checkin
 */
export const useResponderCheckin = (
  supabaseClient?: SupabaseClient
): UseResponderCheckinReturn => {
  const [checkedInResponder, setCheckedInResponder] = useState<Responder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check in a responder
   */
  const checkIn = useCallback(
    async (responder: Responder): Promise<Responder> => {
      setLoading(true);
      setError(null);

      try {
        // If Supabase client provided, save to database
        if (supabaseClient) {
          const { data, error: dbError } = await supabaseClient
            .from('responders')
            .insert([responder])
            .select()
            .single();

          if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
          }

          if (!data) {
            throw new Error('Failed to create responder record');
          }

          setCheckedInResponder(data);
          return data;
        } else {
          // If no Supabase client, just store locally
          setCheckedInResponder(responder);
          return responder;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Check-in failed';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabaseClient]
  );

  /**
   * Check out a responder
   */
  const checkOut = useCallback(
    async (responderId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const checkoutTime = new Date().toISOString();

        if (supabaseClient) {
          const { error: dbError } = await supabaseClient
            .from('responders')
            .update({
              checkout_datetime: checkoutTime,
              status: 'CheckedOut',
            })
            .eq('responder_id', responderId);

          if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
          }
        }

        // Clear local state
        if (checkedInResponder?.responder_id === responderId) {
          setCheckedInResponder(null);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Check-out failed';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supabaseClient, checkedInResponder]
  );

  /**
   * Clear error message
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setCheckedInResponder(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    checkedInResponder,
    isCheckedIn: checkedInResponder !== null,
    loading,
    error,
    checkIn,
    checkOut,
    clearError,
    reset,
  };
};

export default useResponderCheckin;
