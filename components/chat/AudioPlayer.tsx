import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Play, Pause } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { supabase } from '@/lib/supabase';

interface AudioPlayerProps {
  uri: string;
  messageId: string;
  isOwnMessage: boolean;
}

function generateWaveformHeights(messageId: string): number[] {
  const bars: number[] = [];
  for (let i = 0; i < 28; i++) {
    const charCode = messageId.charCodeAt(i % messageId.length);
    const height = 0.25 + ((charCode * (i + 1) * 7) % 100) / 133;
    bars.push(Math.min(1, height));
  }
  return bars;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ uri, messageId, isOwnMessage }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const listenReportedRef = useRef(false);
  const waveformHeights = generateWaveformHeights(messageId);

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const playedBars = Math.floor(progress * waveformHeights.length);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Premiere ecoute par le destinataire : demarre le compte a rebours de 72h
  // avant purge du fichier audio (la RPC ignore l'expediteur).
  const reportListened = useCallback(() => {
    if (isOwnMessage || listenReportedRef.current) return;
    listenReportedRef.current = true;
    supabase.rpc('mark_voice_note_listened', { p_message_id: messageId }).then(() => {});
  }, [isOwnMessage, messageId]);

  const loadAndPlay = useCallback(async () => {
    try {
      reportListened();
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      }

      if (!soundRef.current) {
        const { sound, status } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPositionMs(status.positionMillis || 0);
              setDurationMs(status.durationMillis || 0);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPositionMs(0);
                soundRef.current?.setPositionAsync(0);
              }
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }, [uri, reportListened]);

  const togglePlay = useCallback(async () => {
    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } else {
      await loadAndPlay();
    }
  }, [isPlaying, loadAndPlay]);

  const activeColor = isOwnMessage ? '#fff' : '#003f2f';
  const inactiveColor = isOwnMessage ? 'rgba(255,255,255,0.35)' : 'rgba(0,63,47,0.25)';
  const textColor = isOwnMessage ? 'rgba(255,255,255,0.8)' : '#888';

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { borderColor: activeColor }]}>
        {isPlaying ? (
          <Pause size={16} color={activeColor} />
        ) : (
          <Play size={16} color={activeColor} />
        )}
      </TouchableOpacity>
      <View style={styles.waveform}>
        {waveformHeights.map((h, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: h * 24,
                backgroundColor: i < playedBars ? activeColor : inactiveColor,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.duration, { color: textColor }]}>
        {isPlaying ? formatDuration(positionMs) : formatDuration(durationMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 200,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  duration: {
    fontSize: 11,
    fontWeight: '500',
    minWidth: 32,
    textAlign: 'right',
  },
});
