import { useEffect, useRef, useState } from "react";

import {
  type InputDeviceInfo,
  type MonitorInfo,
  type PitchReading,
  centsFrom,
  startMonitoring,
  stopMonitoring,
  toDb,
} from "@/lib/audio";

/** Anything above this counts as "signal" (the noise floor is ~-100 dBFS). */
export const SIGNAL_THRESHOLD_DB = -60;
/** Peaks at or above this are treated as clipping. */
export const CLIP_THRESHOLD_DB = -0.5;

const RELEASE_DB_PER_SEC = 24; // meter fall-back speed
const PEAK_HOLD_MS = 1500;
const CLIP_HOLD_MS = 2000;
const SIGNAL_HOLD_MS = 400; // keeps the indicator from flickering
const NOTE_CONFIRM_READINGS = 2; // consecutive readings needed to switch note
const NOTE_HOLD_MS = 1200; // keep showing the last note after it stops
const FREQ_SMOOTHING = 0.35; // 0..1, weight of the newest reading

export type DisplayedNote = {
  name: string;
  octave: number;
  midi: number;
  /** Smoothed frequency in Hz. */
  frequency: number;
  /** Smoothed deviation from the exact note, -50..+50. */
  cents: number;
  /** 0-based input channel the note was detected on. */
  channel: number;
  /** False once the note has stopped sounding (shown dimmed). */
  active: boolean;
};

type NoteTracker = {
  candidateMidi: number | null;
  candidateCount: number;
  lastHeardAt: number;
};

/** Pick the loudest channel that has a pitch. */
function strongestPitch(peaks: number[], pitches: (PitchReading | null)[]) {
  let best: { reading: PitchReading; channel: number } | null = null;
  pitches.forEach((reading, channel) => {
    if (reading && (!best || peaks[channel] > peaks[best.channel])) {
      best = { reading, channel };
    }
  });
  return best as { reading: PitchReading; channel: number } | null;
}

export type ChannelLevel = {
  /** Smoothed level for the bar, in dBFS. */
  db: number;
  /** Recent maximum (peak-hold marker), in dBFS. */
  holdDb: number;
  hasSignal: boolean;
  clipping: boolean;
};

type ChannelTracker = {
  db: number;
  holdDb: number;
  holdUntil: number;
  clipUntil: number;
  signalUntil: number;
};

export type MonitorStatus = "idle" | "starting" | "running" | "reconnecting" | "error";

export function useInputMonitor(device: InputDeviceInfo | null) {
  const [status, setStatus] = useState<MonitorStatus>("idle");
  const [info, setInfo] = useState<MonitorInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<ChannelLevel[]>([]);
  const [note, setNote] = useState<DisplayedNote | null>(null);
  const trackers = useRef<ChannelTracker[]>([]);
  const noteTracker = useRef<NoteTracker>({
    candidateMidi: null,
    candidateCount: 0,
    lastHeardAt: 0,
  });
  const lastUpdate = useRef(0);

  const host = device?.host;
  const name = device?.name;

  useEffect(() => {
    if (!host || !name) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    trackers.current = [];
    lastUpdate.current = performance.now();
    setStatus("starting");
    setError(null);
    setInfo(null);
    setLevels([]);
    setNote(null);

    startMonitoring({ host, name }, (event) => {
      if (cancelled) return;
      if (event.type === "reconnecting") {
        setError(event.message);
        setStatus("reconnecting");
        setLevels([]);
        setNote(null);
        return;
      }
      if (event.type === "reconnected") {
        trackers.current = [];
        setInfo(event.info);
        setError(null);
        setStatus("running");
        return;
      }

      const now = performance.now();
      const dt = (now - lastUpdate.current) / 1000;
      lastUpdate.current = now;

      const next = event.peaks.map((peak, i): ChannelLevel => {
        const t = (trackers.current[i] ??= {
          db: -Infinity,
          holdDb: -Infinity,
          holdUntil: 0,
          clipUntil: 0,
          signalUntil: 0,
        });
        const db = toDb(peak);
        // Instant attack, linear release.
        t.db = Math.max(db, t.db - RELEASE_DB_PER_SEC * dt);
        if (db >= t.holdDb || now > t.holdUntil) {
          t.holdDb = db;
          t.holdUntil = now + PEAK_HOLD_MS;
        }
        if (db >= CLIP_THRESHOLD_DB) t.clipUntil = now + CLIP_HOLD_MS;
        if (db >= SIGNAL_THRESHOLD_DB) t.signalUntil = now + SIGNAL_HOLD_MS;
        return {
          db: t.db,
          holdDb: t.holdDb,
          hasSignal: now < t.signalUntil,
          clipping: now < t.clipUntil,
        };
      });
      setLevels(next);

      // Note display: require a couple of agreeing readings before switching
      // notes (avoids flicker on pick attacks), and smooth the frequency.
      const nt = noteTracker.current;
      const heard = strongestPitch(event.peaks, event.pitches);
      if (heard) {
        const { reading, channel } = heard;
        const midi = reading.note.midi;
        nt.candidateCount = nt.candidateMidi === midi ? nt.candidateCount + 1 : 1;
        nt.candidateMidi = midi;
        setNote((prev) => {
          const sameNote = prev !== null && prev.midi === midi;
          if (!sameNote && nt.candidateCount < NOTE_CONFIRM_READINGS) return prev;
          nt.lastHeardAt = now;
          const frequency =
            prev !== null && sameNote
              ? prev.frequency + (reading.frequency - prev.frequency) * FREQ_SMOOTHING
              : reading.frequency;
          return {
            name: reading.note.name,
            octave: reading.note.octave,
            midi,
            frequency,
            cents: centsFrom(frequency, midi),
            channel,
            active: true,
          };
        });
      } else {
        nt.candidateMidi = null;
        nt.candidateCount = 0;
        setNote((prev) =>
          prev?.active && now - nt.lastHeardAt > NOTE_HOLD_MS
            ? { ...prev, active: false }
            : prev,
        );
      }
    })
      .then((monitorInfo) => {
        if (cancelled) return;
        setInfo(monitorInfo);
        setStatus("running");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setStatus("error");
      });

    return () => {
      cancelled = true;
      stopMonitoring().catch(() => {});
    };
  }, [host, name]);

  return { status, info, error, levels, note };
}
