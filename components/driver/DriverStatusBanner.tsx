import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, CircleAlert as AlertCircle, Ban } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface DriverStatusBannerProps {
  userId: string;
}

type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

const MESSAGES: Record<Exclude<DriverStatus, 'approved'>, {
  Icon: typeof Clock;
  color: string;
  bg: string;
  title: string;
  body: string;
}> = {
  pending: {
    Icon: Clock,
    color: '#92400e',
    bg: '#fef3c7',
    title: 'Compte en attente de validation',
    body: "Un administrateur FERE doit valider votre compte avant que vous puissiez recevoir des courses.",
  },
  rejected: {
    Icon: AlertCircle,
    color: '#991b1b',
    bg: '#fee2e2',
    title: 'Compte refusé',
    body: "Votre inscription comme livreur n'a pas été retenue. Contactez FERE pour en connaître la raison.",
  },
  suspended: {
    Icon: Ban,
    color: '#991b1b',
    bg: '#fee2e2',
    title: 'Compte suspendu',
    body: "Vous ne pouvez plus accepter de nouvelles courses. Vos courses en cours restent accessibles.",
  },
};

/**
 * Un livreur non valide ne voit aucune course : les policies les lui masquent.
 * Sans explication a l'ecran, il croit a une panne.
 */
export default function DriverStatusBanner({ userId }: DriverStatusBannerProps) {
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('driver_status, driver_status_reason')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setStatus((data as any).driver_status ?? null);
        setReason((data as any).driver_status_reason ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!status || status === 'approved') return null;

  const config = MESSAGES[status];
  if (!config) return null;

  const { Icon } = config;

  return (
    <View style={[styles.banner, { backgroundColor: config.bg }]}>
      <Icon size={18} color={config.color} />
      <View style={styles.texts}>
        <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
        <Text style={[styles.body, { color: config.color }]}>{config.body}</Text>
        {reason ? (
          <Text style={[styles.reason, { color: config.color }]}>Motif : {reason}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  texts: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  body: { fontSize: 12.5, lineHeight: 18, opacity: 0.9 },
  reason: { fontSize: 12.5, lineHeight: 18, marginTop: 4, fontStyle: 'italic' },
});
