import { useState, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * useTelemetry – React hook for managing live benchmark telemetry.
 *
 * Provides:
 *  - baselineMetrics / optimizedMetrics: live metric snapshots
 *  - baselineSeries / optimizedSeries: time-series for charts
 *  - handlers for metric updates from player trackers
 *  - session persistence helpers
 */
export default function useTelemetry(sessionId) {
  const [baselineMetrics,  setBaselineMetrics]  = useState(null);
  const [optimizedMetrics, setOptimizedMetrics] = useState(null);
  const [baselineSeries,   setBaselineSeries]   = useState([]);
  const [optimizedSeries,  setOptimizedSeries]  = useState([]);

  const baselineTrackerRef  = useRef(null);
  const optimizedTrackerRef = useRef(null);

  const handleBaselineMetrics = useCallback((metrics) => {
    setBaselineMetrics({ ...metrics });
  }, []);

  const handleOptimizedMetrics = useCallback((metrics) => {
    setOptimizedMetrics({ ...metrics });
  }, []);

  // Called every few seconds to sync time series from trackers
  const syncTimeSeries = useCallback(() => {
    if (baselineTrackerRef.current) {
      setBaselineSeries(baselineTrackerRef.current.getTimeSeries());
    }
    if (optimizedTrackerRef.current) {
      setOptimizedSeries(optimizedTrackerRef.current.getTimeSeries());
    }
  }, []);

  // Persist final metrics to backend after benchmark completes
  const persistMetrics = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      if (baselineTrackerRef.current) {
        const m = baselineTrackerRef.current.getMetrics();
        await api.saveMetrics(sessionId, 'BASELINE', {
          startupDelayMs:       m.startupDelayMs,
          stallCount:           m.stallCount,
          totalStallDurationSec:m.totalStallDurationSec,
          avgBitrateKbps:       m.avgBitrateKbps,
          qualitySwitches:      m.qualitySwitches,
          cacheHits:            m.cacheHits,
          cacheMisses:          m.cacheMisses,
        });
      }
      if (optimizedTrackerRef.current) {
        const m = optimizedTrackerRef.current.getMetrics();
        await api.saveMetrics(sessionId, 'OPTIMIZED', {
          startupDelayMs:       m.startupDelayMs,
          stallCount:           m.stallCount,
          totalStallDurationSec:m.totalStallDurationSec,
          avgBitrateKbps:       m.avgBitrateKbps,
          qualitySwitches:      m.qualitySwitches,
          cacheHits:            m.cacheHits,
          cacheMisses:          m.cacheMisses,
        });
      }
    } catch (err) {
      console.error('[useTelemetry] Failed to persist metrics:', err.message);
    }
  }, []);

  return {
    baselineMetrics,
    optimizedMetrics,
    baselineSeries,
    optimizedSeries,
    handleBaselineMetrics,
    handleOptimizedMetrics,
    syncTimeSeries,
    persistMetrics,
    baselineTrackerRef,
    optimizedTrackerRef,
  };
}

