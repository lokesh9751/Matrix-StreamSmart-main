/**
 * client/src/services/telemetryService.js
 *
 * StreamSmart Telemetry and Playback Event Logging Service
 *
 * Dispatches real-time playback events (QUALITY_SWITCH, BUFFER_STALL,
 * BUFFER_RESUME, SEGMENT_FETCH) and player metrics to the Express API for MySQL storage.
 */

import api from './api';

/**
 * Log a quality switch event to the database.
 *
 * @param {object} params
 * @param {number|string} params.sessionId
 * @param {string} params.playerType - 'BASELINE' | 'OPTIMIZED'
 * @param {number} params.elapsedSec
 * @param {string} params.previousResolution
 * @param {string} params.newResolution
 * @param {number} params.bufferLevelSec
 * @param {number} params.bandwidthKbps
 * @param {string} params.reason
 */
export async function logQualitySwitchEvent({
  sessionId,
  playerType = 'OPTIMIZED',
  elapsedSec = 0,
  previousResolution = 'unknown',
  newResolution = 'unknown',
  bufferLevelSec = 0,
  bandwidthKbps = 0,
  reason = 'ABR_SWITCH'
}) {
  if (!sessionId) return null;

  try {
    const payload = {
      playerType,
      eventType: 'QUALITY_SWITCH',
      elapsedSec: parseFloat(Number(elapsedSec || 0).toFixed(2)),
      resolutionLabel: newResolution,
      bufferLevelSec: parseFloat(Number(bufferLevelSec || 0).toFixed(2)),
      simulatedDelayMs: Math.round(bandwidthKbps || 0),
      isCacheHit: false,
      metadata: {
        previousResolution,
        reason
      }
    };

    return await api.logEvent(sessionId, payload);
  } catch (err) {
    console.warn('[TelemetryService] Failed to log quality switch event:', err.message);
    return null;
  }
}

/**
 * Log a buffer stall or resume event to the database.
 *
 * @param {object} params
 * @param {number|string} params.sessionId
 * @param {string} params.playerType
 * @param {'BUFFER_STALL'|'BUFFER_RESUME'} params.eventType
 * @param {number} params.elapsedSec
 * @param {number} params.bufferLevelSec
 * @param {string} params.resolutionLabel
 */
export async function logBufferStallEvent({
  sessionId,
  playerType,
  eventType,
  elapsedSec = 0,
  bufferLevelSec = 0,
  resolutionLabel = 'unknown'
}) {
  if (!sessionId) return null;

  try {
    return await api.logEvent(sessionId, {
      playerType,
      eventType,
      elapsedSec: parseFloat(Number(elapsedSec || 0).toFixed(2)),
      resolutionLabel,
      bufferLevelSec: parseFloat(Number(bufferLevelSec || 0).toFixed(2)),
      simulatedDelayMs: 0,
      isCacheHit: false
    });
  } catch (err) {
    console.warn('[TelemetryService] Failed to log stall event:', err.message);
    return null;
  }
}

/**
 * Log a segment fetch and cache simulation result.
 *
 * @param {object} params
 * @param {number|string} params.sessionId
 * @param {string} params.playerType
 * @param {number} params.elapsedSec
 * @param {string} params.resolutionLabel
 * @param {number} params.simulatedDelayMs
 * @param {boolean} params.isCacheHit
 */
export async function logSegmentFetchEvent({
  sessionId,
  playerType,
  elapsedSec = 0,
  resolutionLabel = 'unknown',
  simulatedDelayMs = 0,
  isCacheHit = false
}) {
  if (!sessionId) return null;

  try {
    return await api.logEvent(sessionId, {
      playerType,
      eventType: 'SEGMENT_FETCH',
      elapsedSec: parseFloat(Number(elapsedSec || 0).toFixed(2)),
      resolutionLabel,
      bufferLevelSec: 0,
      simulatedDelayMs: Math.round(simulatedDelayMs || 0),
      isCacheHit: Boolean(isCacheHit)
    });
  } catch (err) {
    console.warn('[TelemetryService] Failed to log segment fetch:', err.message);
    return null;
  }
}

export default {
  logQualitySwitchEvent,
  logBufferStallEvent,
  logSegmentFetchEvent
};

