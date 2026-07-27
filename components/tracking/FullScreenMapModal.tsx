import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { X, Navigation, MapPin, Gauge } from 'lucide-react-native';
import LeafletMap from '@/components/tracking/LeafletMap';

interface Position {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  position: Position | null;
  destination?: { lat: number; lng: number } | null;
  trackerLabel?: string;
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

export default function FullScreenMapModal({ visible, onClose, position, destination, trackerLabel }: Props) {
  const dist = position && destination ? calculateDistance(position.lat, position.lng, destination.lat, destination.lng) : null;
  const distText = dist !== null ? (dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`) : null;
  const etaMinutes = dist !== null && position?.speed && position.speed > 1 ? Math.ceil((dist * 1000) / (position.speed * 60)) : null;
  const speedKmh = position?.speed && position.speed > 0 ? Math.round(position.speed * 3.6) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{trackerLabel || 'Suivi en direct'}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color="#1a1a1a" />
          </TouchableOpacity>
        </View>

        <View style={styles.mapArea}>
          <LeafletMap position={position} destination={destination} />
          {position && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN DIRECT</Text>
            </View>
          )}
        </View>

        <View style={styles.statsBar}>
          {speedKmh !== null && (
            <View style={styles.statItem}>
              <Gauge size={18} color="#003f2f" />
              <Text style={styles.statValue}>{speedKmh} km/h</Text>
              <Text style={styles.statLabel}>Vitesse</Text>
            </View>
          )}
          {distText && (
            <View style={styles.statItem}>
              <MapPin size={18} color="#003f2f" />
              <Text style={styles.statValue}>{distText}</Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          )}
          {etaMinutes && (
            <View style={styles.statItem}>
              <Navigation size={18} color="#003f2f" />
              <Text style={styles.statValue}>~{etaMinutes} min</Text>
              <Text style={styles.statLabel}>ETA</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapArea: {
    flex: 1,
    backgroundColor: '#e8ede8',
    position: 'relative',
  },
  mapContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  markerDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#003f2f',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  destMarker: {
    position: 'absolute',
    top: '30%',
    right: '30%',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordsOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coordsText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  liveIndicator: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    gap: 12,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  statLabel: { fontSize: 11, color: '#999' },
});
