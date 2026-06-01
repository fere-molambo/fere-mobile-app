import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MapPin, Navigation, Maximize2 } from 'lucide-react-native';
import { useTrackingSession } from '@/hooks/useTrackingSession';
import FullScreenMapModal from '@/components/tracking/FullScreenMapModal';

interface Props {
  referenceId: string;
  referenceType?: string;
  destination?: { lat: number; lng: number } | null;
  destinationLat?: number;
  destinationLng?: number;
  trackerLabel?: string;
  height?: number;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TrackingMap({ referenceId, referenceType, destination, destinationLat, destinationLng, trackerLabel, height = 250 }: Props) {
  const resolvedDestination = destination ?? (destinationLat !== undefined && destinationLng !== undefined ? { lat: destinationLat, lng: destinationLng } : null);
  const { position, isActive } = useTrackingSession(referenceId);
  const [fullscreen, setFullscreen] = useState(false);

  if (!isActive || !position) {
    return (
      <View style={[styles.container, { height: height * 0.6 }]}>
        <View style={styles.placeholderContent}>
          <MapPin color="#999" size={24} />
          <Text style={styles.placeholderText}>Suivi en temps reel non disponible pour le moment</Text>
        </View>
      </View>
    );
  }

  const dist = resolvedDestination ? calculateDistance(position.lat, position.lng, resolvedDestination.lat, resolvedDestination.lng) : null;
  const distText = dist !== null ? (dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`) : null;
  const etaMinutes = dist !== null && position.speed && position.speed > 1 ? Math.ceil((dist * 1000) / (position.speed * 60)) : null;
  const speedKmh = position.speed && position.speed > 0 ? Math.round(position.speed * 3.6) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.mapWrapper, { height }]}>
        <View style={styles.mapFallback}>
          <View style={styles.mapGrid}>
            <View style={styles.markerDot}>
              <Navigation size={16} color="#fff" style={position.heading ? { transform: [{ rotate: `${position.heading}deg` }] } : undefined} />
            </View>
            {resolvedDestination && (
              <View style={styles.destMarker}>
                <MapPin size={14} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.coordsOverlay}>
            <Text style={styles.coordsText}>{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.expandBtn} onPress={() => setFullscreen(true)}>
          <Maximize2 size={16} color="#003f2f" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{trackerLabel || 'Position'}</Text>
          <Text style={styles.infoValue}>En direct</Text>
        </View>
        {distText && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Distance</Text>
            <Text style={styles.infoValue}>{distText}</Text>
          </View>
        )}
        {etaMinutes && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>ETA</Text>
            <Text style={styles.infoValueGreen}>~{etaMinutes} min</Text>
          </View>
        )}
        {speedKmh && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Vitesse</Text>
            <Text style={styles.infoValue}>{speedKmh} km/h</Text>
          </View>
        )}
      </View>

      <FullScreenMapModal visible={fullscreen} onClose={() => setFullscreen(false)} position={position} destination={resolvedDestination} trackerLabel={trackerLabel} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e5e5', backgroundColor: '#fff' },
  mapWrapper: { position: 'relative', overflow: 'hidden' },
  mapFallback: { flex: 1, backgroundColor: '#e8ede8', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mapGrid: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  markerDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#003f2f', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  destMarker: { position: 'absolute', top: '25%', right: '25%', width: 28, height: 28, borderRadius: 14, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  coordsOverlay: { position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  coordsText: { color: '#fff', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  expandBtn: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  infoBar: { flexDirection: 'row', padding: 12, gap: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 11, color: '#999', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  infoValueGreen: { fontSize: 14, fontWeight: '700', color: '#003f2f' },
  placeholderContent: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 20 },
  placeholderText: { fontSize: 13, color: '#999', textAlign: 'center' },
});
