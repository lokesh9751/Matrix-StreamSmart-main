/**
 * client/src/hooks/useABR.js
 *
 * Custom React Hook for Managing StreamSmart Adaptive Bitrate (ABR)
 *
 * RESPONSIBILITIES:
 *  1. Exposes the ABR decision loop state for UI diagnostics (read-only).
 *  2. Does NOT perform quality switching - that happens in dualPlayer.js
 *     to keep HLS.js instance manipulation in one place.
 *  3. Used by OptimizedPlayer for live ABR diagnostics banner.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  recommendQuality,
  calculateBufferOccupancy,
  calculateSafeBandwidth,
  ABR_INTERVAL_MS,
  mapHlsLevels
} from '../algorithms/abrEngine';
import { logQualitySwitchEvent } from '../services/telemetryService';

export default function useABR({
  videoEl,
  hlsInstance,
  networkConfig,
  isAutoMode = true,
  onQualitySwitch
}) {
  const [currentDecision, setCurrentDecision] = useState('STEADY_STATE_HOLD');
  const [decisionReason, setDecisionReason]   = useState('Initializing ABR engine…');
  const [bufferSec, setBufferSec]             = useState(0);
  const [simulatedBandwidthKbps, setSimulatedBandwidthKbps] = useState(4500);
  const [estimatedBandwidthKbps, setEstimatedBandwidthKbps] = useState(0);
  const [safeBandwidthKbps, setSafeBandwidthKbps]           = useState(3375);
  const [switchHistory, setSwitchHistory]     = useState([]);
  const [qualitySwitchesCount, setQualitySwitchesCount] = useState(0);
  const [lastSwitchTime, setLastSwitchTime]   = useState(null);

  const prevLevelRef = useRef(-1);
  const startTimeRef = useRef(Date.now());
  const intervalRef  = useRef(null);

  const networkConfigRef = useRef(networkConfig);
  networkConfigRef.current = networkConfig;
  const isAutoModeRef = useRef(isAutoMode);
  isAutoModeRef.current = isAutoMode;

  const executeABR = useCallback(() => {
    if (!hlsInstance || !hlsInstance.levels || hlsInstance.levels.length === 0) {
      return;
    }

    const video = videoEl instanceof HTMLMediaElement ? videoEl : videoEl?.current;
    if (!video) return;

    // 1. Calculate real buffer occupancy ahead of playback position
    const currentBuffer = calculateBufferOccupancy(video);
    setBufferSec(parseFloat(currentBuffer.toFixed(2)));

    // 2. Bandwidth measurement & calculation
    const hlsBwEstimate = hlsInstance.bandwidthEstimate
      ? Math.round(hlsInstance.bandwidthEstimate / 1000)
      : 0;
    setEstimatedBandwidthKbps(hlsBwEstimate);

    const cfgBw = networkConfigRef.current?.bandwidthKbps;
    const simBw = cfgBw ? Number(cfgBw) : (hlsBwEstimate || 4500);
    setSimulatedBandwidthKbps(simBw);

    const availableBw = simBw;
    const safeBw = calculateSafeBandwidth(availableBw);
    setSafeBandwidthKbps(Math.round(safeBw));

    // Current active level index in HLS.js
    const activeLevelIndex = hlsInstance.currentLevel >= 0
      ? hlsInstance.currentLevel
      : (hlsInstance.nextLevel >= 0 ? hlsInstance.nextLevel : 0);

    // If manual mode is active, do not execute algorithm switches
    if (!isAutoModeRef.current) {
      setCurrentDecision('MANUAL_OVERRIDE');
      setDecisionReason(`Manual resolution override active (Level ${activeLevelIndex})`);
      return;
    }

    // Ensure built-in HLS.js ABR is disabled so it doesn't conflict
    if (hlsInstance.autoLevelEnabled) {
      hlsInstance.autoLevelEnabled = false;
    }

    // 3. Run Custom ABR Decision Heuristic
    const recommendation = recommendQuality({
      currentLevel: activeLevelIndex,
      bufferSec: currentBuffer,
      bandwidthKbps: availableBw,
      hlsLevels: hlsInstance.levels
    });

    setCurrentDecision(recommendation.reason);
    setDecisionReason(recommendation.reasonDetail);

    // 4. Apply actual HLS.js quality change if recommendation differs from current target
    const currentTargetLevel = hlsInstance.nextLevel >= 0 ? hlsInstance.nextLevel : activeLevelIndex;

    if (recommendation.nextLevel !== currentTargetLevel) {
      const ladder = mapHlsLevels(hlsInstance.levels);
      const fromSpec = ladder[currentTargetLevel] || { label: `Level ${currentTargetLevel}` };
      const toSpec = ladder[recommendation.nextLevel] || { label: `Level ${recommendation.nextLevel}` };

      console.log(
        `[useABR] Switching: ${fromSpec.label} → ${toSpec.label} | Reason: ${recommendation.reason} | Buffer: ${currentBuffer.toFixed(1)}s | Safe BW: ${Math.round(safeBw)}Kbps`
      );

      // Instruct HLS.js to switch rendition at fragment boundary
      hlsInstance.nextLevel = recommendation.nextLevel;

      // In case of emergency downshift or bandwidth limit, immediately drop quality
      if (recommendation.reason === 'BUFFER_RISK_DOWNSHIFT' || recommendation.reason === 'BANDWIDTH_LIMIT') {
        hlsInstance.currentLevel = recommendation.nextLevel;
      }

      const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
      const nowStr = new Date().toLocaleTimeString();

      const switchRecord = {
        id: Date.now() + Math.random(),
        timestamp: nowStr,
        elapsedSec: parseFloat(elapsedSec.toFixed(1)),
        fromLevel: fromSpec.label,
        toLevel: toSpec.label,
        reason: recommendation.reason,
        reasonDetail: recommendation.reasonDetail,
        bufferSec: parseFloat(currentBuffer.toFixed(1)),
        bandwidthKbps: availableBw,
        safeBandwidthKbps: Math.round(safeBw)
      };

      setSwitchHistory(prev => [switchRecord, ...prev.slice(0, 19)]);
      setQualitySwitchesCount(c => c + 1);
      setLastSwitchTime(nowStr);
      prevLevelRef.current = recommendation.nextLevel;

      // Log to backend database
      logQualitySwitchEvent({
        sessionId: networkConfigRef.current?.sessionId,
        playerType: 'OPTIMIZED',
        elapsedSec,
        previousResolution: fromSpec.label,
        newResolution: toSpec.label,
        bufferLevelSec: currentBuffer,
        bandwidthKbps: availableBw,
        reason: recommendation.reason
      });

      if (onQualitySwitch) {
        onQualitySwitch(switchRecord);
      }
    }
  }, [videoEl, hlsInstance, onQualitySwitch]);

  // Start the 1500ms ABR execution loop
  useEffect(() => {
    if (!hlsInstance) return;

    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(executeABR, ABR_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hlsInstance, executeABR]);

  return {
    currentDecision,
    decisionReason,
    bufferSec,
    simulatedBandwidthKbps,
    estimatedBandwidthKbps,
    safeBandwidthKbps,
    switchHistory,
    qualitySwitchesCount,
    lastSwitchTime,
    executeABR
  };
}