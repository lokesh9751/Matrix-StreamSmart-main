/**
 * client/src/services/sessionStore.js
 *
 * Client-Side Session Persistence & Application Event Bus for StreamSmart.
 *
 * Implements:
 * 1. Robust LocalStorage persistence for benchmark sessions ('streamsmart_sessions').
 * 2. Event bus for real application activities (video selection, playback, stalls, ABR shifts, benchmarks).
 * 3. Timeline event logging for optimization milestones.
 * 4. Safe JSON parsing with fallback to seeded realistic data.
 */

const STORAGE_KEY_SESSIONS = 'streamsmart_sessions';
const STORAGE_KEY_EVENTS   = 'streamsmart_recent_events';
const STORAGE_KEY_TIMELINE = 'streamsmart_timeline_events';
const STORAGE_KEY_SETTINGS = 'streamsmart_settings';

// ── Initial Seed Sessions (realistic benchmark data) ──────────────────────
const DEFAULT_SEEDED_SESSIONS = [
  {
    session_id: 'sess-101',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    video_title: 'Big Buck Bunny (Mux 1080p 60fps)',
    profile_name: '4G LTE Mobile (Moderate)',
    status: 'COMPLETED',
    duration_sec: 30,
    baseline_stalls: 3,
    baseline_rebuffer_sec: 8.4,
    baseline_startup_ms: 1240,
    baseline_resolution: '1080p',
    optimized_stalls: 0,
    optimized_rebuffer_sec: 0.0,
    optimized_startup_ms: 380,
    optimized_resolution: '720p',
    stalls_avoided: 3,
    rebuffer_saved_sec: 8.4,
    cache_hit_rate: 68.5,
    total_cache_hits: 48,
    total_cache_misses: 22,
    switches: 4
  },
  {
    session_id: 'sess-102',
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    video_title: 'Tears of Steel — Sci-Fi VFX',
    profile_name: 'Rural 3G (Congested)',
    status: 'COMPLETED',
    duration_sec: 30,
    baseline_stalls: 6,
    baseline_rebuffer_sec: 14.2,
    baseline_startup_ms: 2150,
    baseline_resolution: '1080p',
    optimized_stalls: 1,
    optimized_rebuffer_sec: 1.8,
    optimized_startup_ms: 540,
    optimized_resolution: '360p',
    stalls_avoided: 5,
    rebuffer_saved_sec: 12.4,
    cache_hit_rate: 42.0,
    total_cache_hits: 21,
    total_cache_misses: 29,
    switches: 5
  },
  {
    session_id: 'sess-103',
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    video_title: 'Star Trek Angel One (Sci-Fi)',
    profile_name: 'High-Speed Fiber + Edge CDN',
    status: 'COMPLETED',
    duration_sec: 30,
    baseline_stalls: 0,
    baseline_rebuffer_sec: 0.0,
    baseline_startup_ms: 410,
    baseline_resolution: '1080p',
    optimized_stalls: 0,
    optimized_rebuffer_sec: 0.0,
    optimized_startup_ms: 290,
    optimized_resolution: '1080p',
    stalls_avoided: 0,
    rebuffer_saved_sec: 0.0,
    cache_hit_rate: 94.2,
    total_cache_hits: 65,
    total_cache_misses: 4,
    switches: 2
  }
];

// ── Initial Seed Events ────────────────────────────────────────────────────
const DEFAULT_SEEDED_EVENTS = [
  {
    id: 'evt-init-1',
    title: 'StreamSmart Initialized',
    desc: 'HLS.js MSE dual-engine and simulation throttler ready',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: 'info'
  },
  {
    id: 'evt-init-2',
    title: 'Network Profile Loaded',
    desc: '4G LTE Mobile preset active (4,500 Kbps, 50ms latency)',
    timestamp: new Date(Date.now() - 120000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: 'info'
  },
  {
    id: 'evt-init-3',
    title: 'Video Stream Verified',
    desc: 'Big Buck Bunny (Mux 1080p) CORS verified with 5 quality tiers',
    timestamp: new Date(Date.now() - 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    type: 'success'
  }
];

// ── Initial Seed Timeline ──────────────────────────────────────────────────
const DEFAULT_SEEDED_TIMELINE = [
  {
    id: 'tl-1',
    title: 'Platform Initialized',
    description: 'MSE buffer controllers attached, local storage cache verified',
    timestamp: '00:00.0s',
    status: 'completed',
    type: 'init'
  },
  {
    id: 'tl-2',
    title: 'Stream Manifest Loaded',
    description: 'Master HLS manifest parsed successfully (5 variant renditions: 240p–1080p)',
    timestamp: '00:01.2s',
    status: 'completed',
    type: 'video'
  },
  {
    id: 'tl-3',
    title: 'ABR Engine Monitoring Active',
    description: '1,500ms continuous buffer & bandwidth evaluation loop running',
    timestamp: '00:02.5s',
    status: 'completed',
    type: 'abr'
  }
];

// ── LocalStorage Helpers ───────────────────────────────────────────────────

export function getStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(DEFAULT_SEEDED_SESSIONS));
      return DEFAULT_SEEDED_SESSIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SEEDED_SESSIONS;
  } catch (err) {
    console.warn('[SessionStore] Error reading sessions from LocalStorage, restoring defaults:', err);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(DEFAULT_SEEDED_SESSIONS));
    return DEFAULT_SEEDED_SESSIONS;
  }
}

export function saveStoredSession(session) {
  try {
    const existing = getStoredSessions();
    // Prevent accidental duplicates
    const filtered = existing.filter(s => s.session_id !== session.session_id);
    const updated = [session, ...filtered].slice(0, 50); // Keep latest 50
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));

    // Dispatch custom window event
    window.dispatchEvent(new CustomEvent('streamsmart:session_saved', { detail: session }));
    return updated;
  } catch (err) {
    console.error('[SessionStore] Failed to save session:', err);
    return [];
  }
}

export function clearStoredSessions() {
  try {
    localStorage.removeItem(STORAGE_KEY_SESSIONS);
    window.dispatchEvent(new CustomEvent('streamsmart:sessions_cleared'));
    return [];
  } catch (err) {
    console.error('[SessionStore] Failed to clear sessions:', err);
    return [];
  }
}

// ── Application Event Bus (Activities & Alerts) ────────────────────────────

export function getStoredEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(DEFAULT_SEEDED_EVENTS));
      return DEFAULT_SEEDED_EVENTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SEEDED_EVENTS;
  } catch {
    return DEFAULT_SEEDED_EVENTS;
  }
}

export function logAppEvent({ title, desc, type = 'info' }) {
  try {
    const newEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      desc,
      type, // 'info' | 'success' | 'warning' | 'error'
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    const current = getStoredEvents();
    const updated = [newEvent, ...current.slice(0, 19)]; // Keep latest 20 events
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent('streamsmart:app_event', { detail: newEvent }));
    return newEvent;
  } catch (err) {
    console.warn('[SessionStore] Could not log app event:', err);
    return null;
  }
}

// ── Optimization Timeline ──────────────────────────────────────────────────

export function getStoredTimeline() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TIMELINE);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(DEFAULT_SEEDED_TIMELINE));
      return DEFAULT_SEEDED_TIMELINE;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SEEDED_TIMELINE;
  } catch {
    return DEFAULT_SEEDED_TIMELINE;
  }
}

export function logTimelineEvent({ title, description, timestamp, status = 'completed', type = 'info' }) {
  try {
    const newEntry = {
      id: `tl-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title,
      description,
      timestamp: timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      status, // 'completed' | 'active' | 'warning' | 'error'
      type
    };

    const current = getStoredTimeline();
    const updated = [newEntry, ...current.slice(0, 24)]; // Keep latest 25 timeline items
    localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(updated));

    window.dispatchEvent(new CustomEvent('streamsmart:timeline_event', { detail: newEntry }));
    return newEntry;
  } catch (err) {
    console.warn('[SessionStore] Could not log timeline event:', err);
    return null;
  }
}

export function clearTimeline() {
  localStorage.setItem(STORAGE_KEY_TIMELINE, JSON.stringify(DEFAULT_SEEDED_TIMELINE));
  window.dispatchEvent(new CustomEvent('streamsmart:timeline_cleared'));
}

// ── Application Settings ───────────────────────────────────────────────────

export function getAppSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return { autoSave: true, defaultDurationSec: 30, theme: 'blue-white' };
    return JSON.parse(raw);
  } catch {
    return { autoSave: true, defaultDurationSec: 30, theme: 'blue-white' };
  }
}

export function saveAppSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('streamsmart:settings_changed', { detail: settings }));
  } catch (err) {
    console.warn('[SessionStore] Could not save settings:', err);
  }
}

