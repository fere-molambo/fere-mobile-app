import React, { useEffect, useRef, useState } from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Crosshair } from 'lucide-react-native';

export interface PickedPosition {
  lat: number;
  lng: number;
}

interface Props {
  value: PickedPosition | null;
  onChange: (pos: PickedPosition) => void;
  onUseCurrentPosition: () => void;
  locating?: boolean;
  height?: number;
}

// Bamako : point de depart quand aucune position n'est encore connue.
const DEFAULT_CENTER: PickedPosition = { lat: 12.6392, lng: -8.0029 };

/**
 * Carte OpenStreetMap ou l'utilisateur pose lui-meme son adresse : il touche la
 * carte ou fait glisser le repere. Sans cle API ni cout.
 *
 * La recherche d'un lieu par son nom (« derriere tel commerce ») demanderait
 * Google Places : non disponible pour l'instant.
 */
const buildHtml = (start: PickedPosition, hasValue: boolean) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8ede8}</style>
</head><body><div id="map"></div>
<script>
var map = L.map('map', { zoomControl: true, attributionControl: false })
  .setView([${start.lat}, ${start.lng}], ${hasValue ? 17 : 13});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map);

var pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:30px;height:30px;border-radius:15px 15px 15px 0;background:#003f2f;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 3px 8px rgba(0,0,0,.4);"></div>',
  iconSize: [30, 30], iconAnchor: [15, 28]
});

var marker = L.marker([${start.lat}, ${start.lng}], { icon: pinIcon, draggable: true }).addTo(map);

function send(latlng) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ lat: latlng.lat, lng: latlng.lng }));
}

marker.on('dragend', function () { send(marker.getLatLng()); });
map.on('click', function (e) { marker.setLatLng(e.latlng); send(e.latlng); });

// Recentrage depuis « Ma position actuelle ».
function moveTo(lat, lng) {
  marker.setLatLng([lat, lng]);
  map.setView([lat, lng], 17);
}
</script></body></html>`;

export default function LocationPickerMap({
  value,
  onChange,
  onUseCurrentPosition,
  locating,
  height = 240,
}: Props) {
  const webRef = useRef<WebView>(null);
  const [htmlStart] = useState<PickedPosition>(value || DEFAULT_CENTER);
  const [hadValue] = useState<boolean>(!!value);
  const lastSent = useRef<string>('');

  // La carte ne doit pas se recharger a chaque deplacement du repere : le HTML
  // est fige, les recentrages passent par injectJavaScript.
  const html = useRef(buildHtml(htmlStart, hadValue)).current;

  // Recentrage uniquement quand la position vient d'ailleurs que de la carte
  // elle-meme (bouton « Ma position »), sinon on lutterait contre le doigt de
  // l'utilisateur pendant qu'il fait glisser le repere.
  useEffect(() => {
    if (!value) return;
    const key = `${value.lat},${value.lng}`;
    if (key === lastSent.current) return;
    lastSent.current = key;
    webRef.current?.injectJavaScript(`try{moveTo(${value.lat},${value.lng});}catch(e){};true;`);
  }, [value]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fallback, { height }]}>
        <Text style={styles.fallbackText}>
          La carte de sélection est disponible dans l'application mobile.
        </Text>
      </View>
    );
  }


  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webRef}
        source={{ html }}
        originWhitelist={['*']}
        style={styles.web}
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const pos = JSON.parse(event.nativeEvent.data);
            if (typeof pos?.lat === 'number' && typeof pos?.lng === 'number') {
              lastSent.current = `${pos.lat},${pos.lng}`;
              onChange(pos);
            }
          } catch {
            // message illisible : on ignore plutot que de casser la saisie
          }
        }}
      />

      <TouchableOpacity style={styles.locateBtn} onPress={onUseCurrentPosition} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color="#003f2f" />
        ) : (
          <>
            <Crosshair size={14} color="#003f2f" />
            <Text style={styles.locateText}>Ma position</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Touchez la carte ou faites glisser le repère pour poser votre adresse exacte
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e8ede8',
    position: 'relative',
  },
  web: { flex: 1, backgroundColor: 'transparent' },
  fallback: {
    borderRadius: 12,
    backgroundColor: '#f1f5f4',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: { fontSize: 13, color: '#666', textAlign: 'center' },
  locateBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    minWidth: 96,
    justifyContent: 'center',
  },
  locateText: { fontSize: 12, fontWeight: '600', color: '#003f2f' },
  hint: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  hintText: { fontSize: 11.5, color: '#444', textAlign: 'center' },
});
