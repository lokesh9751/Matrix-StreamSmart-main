/**
 * api.js – Centralized API client service for StreamSmart
 *
 * Normalizes base URLs and paths to prevent duplicate /api or trailing slash issues.
 * Default in development routes via Vite proxy to the Express backend (http://127.0.0.1:5001).
 */

const RAW_BASE = import.meta.env?.VITE_API_URL || '/api';
const BASE = RAW_BASE.replace(/\/+$/, ''); // Strip any trailing slashes

async function request(method, path, body) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${BASE}${cleanPath}`;

  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': '1'
    }
  };

  if (body !== undefined && body !== null) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg =
        data.error ||
        data.message ||
        (data.path ? `Endpoint '${data.path}' not found` : `HTTP ${res.status}: ${res.statusText}`);
      throw new Error(errorMsg);
    }

    return data;
  } catch (err) {
    console.warn(`[StreamSmart API] ${method} ${url} failed:`, err.message);
    throw err;
  }
}

const api = {
  // Auth
  getUsers:   ()     => request('GET',  '/auth/users'),
  login:      (body) => request('POST', '/auth/login', body),
  me:         ()     => request('GET',  '/auth/me'),

  // Workbench
  getVideos:       ()      => request('GET',  '/workbench/videos'),
  getProfiles:     ()      => request('GET',  '/workbench/profiles'),
  createSession:   (body)  => request('POST', '/workbench/sessions', body),
  stopSession:     (id, s) => request('PATCH', `/workbench/sessions/${id}/stop`, { status: s }),
  saveMetrics:     (id, t, m) => request('POST', `/workbench/sessions/${id}/metrics`, { playerType: t, metrics: m }),
  logEvent:        (id, evt) => request('POST', `/workbench/sessions/${id}/events`, evt),
  getSession:      (id)    => request('GET',  `/workbench/sessions/${id}`),

  // Simulator
  getABRRecommendation: (body) => request('POST', '/simulator/abr', body),
  simulateSegment:      (body) => request('POST', '/simulator/segment', body),
  getCacheStats:        (id)   => request('GET',  `/simulator/cache-stats/${id}`),
  getQualityLadder:     ()     => request('GET',  '/simulator/quality-ladder'),

  // Analytics
  getHistory: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/analytics/history${qs ? `?${qs}` : ''}`);
  },
  getReport:  (id)     => request('GET', `/analytics/sessions/${id}/report`),
  getEvents:  (id, pt) => request('GET', `/analytics/sessions/${id}/events${pt ? `?playerType=${pt}` : ''}`),
  getSummary: ()       => request('GET', '/analytics/summary'),

  // Admin
  getAdminProfiles:  ()      => request('GET',    '/admin/profiles'),
  createProfile:     (body)  => request('POST',   '/admin/profiles', body),
  updateProfile:     (id, b) => request('PUT',    `/admin/profiles/${id}`, b),
  deleteProfile:     (id)    => request('DELETE', `/admin/profiles/${id}`),
  getAdminVideos:    ()      => request('GET',    '/admin/videos'),
  createVideo:       (body)  => request('POST',   '/admin/videos', body),
  updateVideo:       (id, b) => request('PUT',    `/admin/videos/${id}`, b),
  deleteVideo:       (id)    => request('DELETE', `/admin/videos/${id}`),

  // Health
  health: () => request('GET', '/health'),
};

export default api;
