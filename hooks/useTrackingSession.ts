import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface TrackingPosition {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

interface UseTrackingSessionResult {
  position: TrackingPosition | null;
  isActive: boolean;
  /** Heure de la derniere position recue : permet de distinguer le direct d'une position figee. */
  updatedAt: string | null;
}

export function useTrackingSession(referenceId: string): UseTrackingSessionResult {
  const [position, setPosition] = useState<TrackingPosition | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!referenceId) return;

    const loadSession = async () => {
      const { data } = await supabase
        .from('live_tracking_sessions')
        .select('id, current_lat, current_lng, heading, speed, is_active, updated_at')
        .eq('reference_id', referenceId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.current_lat && data.current_lng) {
        setPosition({
          lat: data.current_lat,
          lng: data.current_lng,
          heading: data.heading,
          speed: data.speed,
        });
        setIsActive(true);
        setUpdatedAt(data.updated_at ?? null);
      }
    };

    loadSession();

    const channel = supabase
      .channel(`tracking-${referenceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          // '*' et pas 'UPDATE' : sinon la création de session par le livreur
          // n'est jamais captée si le client a ouvert l'écran avant lui.
          event: '*',
          schema: 'public',
          table: 'live_tracking_sessions',
          filter: `reference_id=eq.${referenceId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row) return;
          if (row.is_active && row.current_lat && row.current_lng) {
            setPosition({
              lat: row.current_lat,
              lng: row.current_lng,
              heading: row.heading,
              speed: row.speed,
            });
            setIsActive(true);
            setUpdatedAt(row.updated_at ?? new Date().toISOString());
          } else {
            setIsActive(false);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [referenceId]);

  return { position, isActive, updatedAt };
}
