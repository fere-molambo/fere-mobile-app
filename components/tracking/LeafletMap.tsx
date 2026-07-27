import React, { useRef, useEffect } from 'react';
import { Platform, View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  position?: (LatLng & { heading?: number | null }) | null;
  destination?: LatLng | null;
  style?: StyleProp<ViewStyle>;
}

// Carte OpenStreetMap via Leaflet dans une WebView : gratuit, sans clé API.
const buildHtml = (position: Props['position'], destination: Props['destination']) => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8ede8}</style>
</head><body><div id="map"></div>
<script>
var map = L.map('map', { zoomControl: true, attributionControl: false });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
L.control.attribution({ prefix: false }).addAttribution('© OpenStreetMap').addTo(map);

var trackerIcon = L.divIcon({
  className: '',
  html: '<div style="width:34px;height:34px;border-radius:17px;background:#003f2f;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;">➤</div>',
  iconSize: [34, 34], iconAnchor: [17, 17]
});
var destIcon = L.divIcon({
  className: '',
  html: '<div style="width:28px;height:28px;border-radius:14px 14px 14px 0;background:#ef4444;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35);"></div>',
  iconSize: [28, 28], iconAnchor: [14, 26]
});

var trackerMarker = null, destMarker = null, line = null, didFit = false;

function update(pos, dest) {
  if (dest) {
    if (!destMarker) destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map);
    else destMarker.setLatLng([dest.lat, dest.lng]);
  }
  if (pos) {
    if (!trackerMarker) trackerMarker = L.marker([pos.lat, pos.lng], { icon: trackerIcon }).addTo(map);
    else trackerMarker.setLatLng([pos.lat, pos.lng]);
  }
  if (pos && dest) {
    var pts = [[pos.lat, pos.lng], [dest.lat, dest.lng]];
    if (!line) line = L.polyline(pts, { color: '#003f2f', weight: 3, dashArray: '8,8', opacity: 0.7 }).addTo(map);
    else line.setLatLngs(pts);
  }
  if (!didFit) {
    didFit = true;
    if (pos && dest) map.fitBounds([[pos.lat, pos.lng], [dest.lat, dest.lng]], { padding: [45, 45] });
    else if (pos) map.setView([pos.lat, pos.lng], 15);
    else if (dest) map.setView([dest.lat, dest.lng], 15);
    else map.setView([5.348, -4.027], 12);
  } else if (pos) {
    map.panTo([pos.lat, pos.lng], { animate: true });
  }
}
update(${position ? JSON.stringify({ lat: position.lat, lng: position.lng }) : 'null'}, ${destination ? JSON.stringify(destination) : 'null'});
</script></body></html>`;

export default function LeafletMap({ position, destination, style }: Props) {
  const webRef = useRef<WebView>(null);
  // HTML figé au premier rendu ; mises à jour ensuite par injection JS
  const initialHtml = useRef<string | null>(null);
  if (initialHtml.current === null) {
    initialHtml.current = buildHtml(position ?? null, destination ?? null);
  }

  useEffect(() => {
    if (!webRef.current) return;
    const pos = position ? JSON.stringify({ lat: position.lat, lng: position.lng }) : 'null';
    const dest = destination ? JSON.stringify(destination) : 'null';
    webRef.current.injectJavaScript(`try{update(${pos}, ${dest});}catch(e){};true;`);
  }, [position?.lat, position?.lng, destination?.lat, destination?.lng]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webFallback, style]}>
        <Text style={styles.webFallbackText}>Carte disponible sur l'application mobile</Text>
      </View>
    );
  }

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: initialHtml.current }}
      style={[styles.map, style]}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
      androidLayerType="hardware"
    />
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, backgroundColor: '#e8ede8' },
  webFallback: { flex: 1, backgroundColor: '#e8ede8', justifyContent: 'center', alignItems: 'center' },
  webFallbackText: { color: '#666', fontSize: 13 },
});
