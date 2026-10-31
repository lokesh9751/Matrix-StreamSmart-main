/**
 * client/src/utils/chartController.js
 *
 * Chart.js data adapters for StreamSmart – Purple & Pink Telemetry System
 *
 * Provides clean, professional dataset builders with high-contrast,
 * accessible typography, subtle grids, and calibrated purple/pink palettes.
 */

// ── StreamSmart Purple & Pink Chart Palette (DESIGN.md) ────────────────────
export const CHART_COLORS = {
  primary:        '#7060B5', // Primary Violet – dominant visual anchor
  primaryAlpha:   'rgba(112, 96, 181, 0.12)',
  primaryDark:    '#514398', // Deep Purple
  baseline:       '#918BA3', // Secondary Text (Fixed Baseline)
  baselineAlpha:  'rgba(145, 139, 163, 0.10)',
  optimized:      '#F47DA9', // Vibrant Pink (Optimized ABR / Peak Telemetry)
  optimizedAlpha: 'rgba(244, 125, 169, 0.14)',
  cacheHit:       '#16A34A', // Success Green
  cacheMiss:      '#DC2626', // Error Red
  gridLine:       '#E7DEFE', // Subtle Surface Variant grid
  axisTick:       '#918BA3', // Secondary Text
  tooltipBg:      '#1D182F', // On-Surface Dark Slate-Violet
};

// Common Chart.js options for Clean White SaaS theme
export const SAAS_CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: {
    legend: {
      labels: {
        color: '#484551',
        font: { size: 12, weight: '500', family: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" },
        boxWidth: 10,
        boxHeight: 10,
        padding: 14,
        usePointStyle: true,
      }
    },
    tooltip: {
      backgroundColor: '#1D182F',
      borderColor: '#C9C4D2',
      borderWidth: 1,
      titleColor: '#FFFFFF',
      bodyColor: '#FDF7FF',
      padding: 10,
      cornerRadius: 6,
      displayColors: true,
      titleFont: { size: 12, weight: '600', family: "'Plus Jakarta Sans', 'Inter', sans-serif" },
      bodyFont: { size: 11, family: "'Plus Jakarta Sans', 'Inter', sans-serif" },
    }
  },
  scales: {
    x: {
      ticks: {
        color: '#918BA3',
        font: { size: 10, family: "'Plus Jakarta Sans', 'Inter', sans-serif" }
      },
      grid: {
        color: '#E7DEFE',
        tickColor: 'transparent'
      },
      border: { color: '#C9C4D2' }
    },
    y: {
      ticks: {
        color: '#918BA3',
        font: { size: 10, family: "'Plus Jakarta Sans', 'Inter', sans-serif" }
      },
      grid: {
        color: '#E7DEFE',
        tickColor: 'transparent'
      },
      border: { color: '#C9C4D2' }
    }
  }
};

/**
 * Normalizes point data across varied schemas
 */
function normalizePoint(p) {
  if (!p) return null;
  const elapsed = Number(
    p.elapsed !== undefined
      ? p.elapsed
      : (p.elapsed_sec !== undefined
          ? p.elapsed_sec
          : (typeof p.timestamp === 'string' ? parseFloat(p.timestamp) : p.timestamp || 0))
  );

  const buffer = Number(
    p.buffer !== undefined
      ? p.buffer
      : (p.bufferSec !== undefined
          ? p.bufferSec
          : (p.buffer_level_sec !== undefined ? p.buffer_level_sec : 0))
  );

  const bitrate = Number(
    p.bitrate !== undefined
      ? p.bitrate
      : (p.bitrateKbps !== undefined
          ? p.bitrateKbps
          : (p.avg_bitrate_kbps !== undefined ? p.avg_bitrate_kbps : 0))
  );

  return { elapsed, buffer, bitrate };
}

/**
 * Build dataset arrays for the Buffer + Bitrate timeline chart.
 * Blue & Slate corporate styling.
 */
export function buildTimelineChartData(baselineSeries = [], optimizedSeries = []) {
  const normBase = (baselineSeries || []).map(normalizePoint).filter(Boolean);
  const normOpt  = (optimizedSeries || []).map(normalizePoint).filter(Boolean);

  const rawTimes = [
    ...normBase.map(p => p.elapsed),
    ...normOpt.map(p => p.elapsed)
  ].filter(t => !isNaN(t) && t >= 0);

  const uniqueTimes = [...new Set(rawTimes.map(t => Math.round(t)))].sort((a, b) => a - b);
  const labels = uniqueTimes.length > 0 ? uniqueTimes.map(t => `${t}s`) : ['0s'];

  const interpolate = (series, times, key) =>
    times.map(t => {
      if (!series || series.length === 0) return null;
      let best = null;
      let minDiff = 1.5;
      for (const p of series) {
        const diff = Math.abs(p.elapsed - t);
        if (diff <= minDiff) {
          minDiff = diff;
          best = p;
        }
      }
      return best ? best[key] : null;
    });

  return {
    labels,
    datasets: [
      {
        label: 'Baseline Buffer (Fixed)',
        data: interpolate(normBase, uniqueTimes, 'buffer'),
        borderColor: CHART_COLORS.baseline,
        backgroundColor: CHART_COLORS.baselineAlpha,
        borderWidth: 2,
        tension: 0.25,
        fill: true,
        yAxisID: 'yBuffer',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Optimized Buffer (ABR)',
        data: interpolate(normOpt, uniqueTimes, 'buffer'),
        borderColor: CHART_COLORS.optimized,
        backgroundColor: CHART_COLORS.optimizedAlpha,
        borderWidth: 2.2,
        tension: 0.25,
        fill: true,
        yAxisID: 'yBuffer',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Baseline Bitrate (1080p)',
        data: interpolate(normBase, uniqueTimes, 'bitrate'),
        borderColor: CHART_COLORS.baseline,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [4, 4],
        tension: 0.2,
        fill: false,
        yAxisID: 'yBitrate',
        spanGaps: true,
        pointRadius: 0,
      },
      {
        label: 'Optimized Bitrate (Dynamic)',
        data: interpolate(normOpt, uniqueTimes, 'bitrate'),
        borderColor: CHART_COLORS.optimized,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [3, 2],
        tension: 0.2,
        fill: false,
        yAxisID: 'yBitrate',
        spanGaps: true,
        pointRadius: 0,
      },
    ]
  };
}

/**
 * Build grouped bar chart data for startup / stall comparison.
 */
export function buildComparisonBarData(baselineMetrics, optimizedMetrics) {
  const bStartup = parseFloat(((baselineMetrics?.startup_delay_ms  || baselineMetrics?.startupDelayMs  || 0) / 1000).toFixed(2));
  const bStallDur = parseFloat(Number(baselineMetrics?.total_stall_duration_sec  || baselineMetrics?.totalStallDurationSec  || 0).toFixed(2));
  const bStalls = parseInt(baselineMetrics?.stall_count  || baselineMetrics?.stallCount  || 0, 10);

  const oStartup = parseFloat(((optimizedMetrics?.startup_delay_ms || optimizedMetrics?.startupDelayMs || 0) / 1000).toFixed(2));
  const oStallDur = parseFloat(Number(optimizedMetrics?.total_stall_duration_sec || optimizedMetrics?.totalStallDurationSec || 0).toFixed(2));
  const oStalls = parseInt(optimizedMetrics?.stall_count || optimizedMetrics?.stallCount || 0, 10);

  return {
    labels: ['Startup Delay (s)', 'Total Rebuffering (s)', 'Stall Count'],
    datasets: [
      {
        label: 'Baseline (Fixed 1080p)',
        data: [bStartup, bStallDur, bStalls],
        backgroundColor: CHART_COLORS.baseline,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: 'Optimized (Adaptive ABR)',
        data: [oStartup, oStallDur, oStalls],
        backgroundColor: CHART_COLORS.optimized,
        borderRadius: 4,
        borderSkipped: false,
      },
    ]
  };
}

/**
 * Build doughnut chart data for cache efficiency.
 */
export function buildCacheDoughnutData(hits = 0, misses = 0) {
  const h = Math.max(0, parseInt(hits, 10) || 0);
  const m = Math.max(0, parseInt(misses, 10) || 0);

  if (h === 0 && m === 0) {
    return {
      labels: ['No Cache Requests'],
      datasets: [{
        data: [1],
        backgroundColor: [CHART_COLORS.gridLine],
        borderColor: ['#FFFFFF'],
        borderWidth: 2,
      }]
    };
  }

  return {
    labels: ['Cache Hits (12ms)', 'Cache Misses (260ms)'],
    datasets: [{
      data: [h, m],
      backgroundColor: [CHART_COLORS.cacheHit, CHART_COLORS.gridLine],
      borderColor: ['#FFFFFF', '#FFFFFF'],
      borderWidth: 2,
      hoverOffset: 4,
    }]
  };
}

export function getTimelineOptions() {
  return {
    ...SAAS_CHART_DEFAULTS,
    scales: {
      x: { ...SAAS_CHART_DEFAULTS.scales.x },
      yBuffer: {
        type:     'linear',
        position: 'left',
        title:    { display: true, text: 'Buffer (s)', color: '#918BA3', font: { size: 10, weight: '600' } },
        ticks:    { color: '#918BA3', font: { size: 10 } },
        grid:     { color: '#E7DEFE' },
        min: 0,
      },
      yBitrate: {
        type:     'linear',
        position: 'right',
        title:    { display: true, text: 'Bitrate (Kbps)', color: '#918BA3', font: { size: 10, weight: '600' } },
        ticks:    { color: '#918BA3', font: { size: 10 } },
        grid:     { drawOnChartArea: false },
        min: 0,
      }
    }
  };
}

export function getBarOptions() {
  return {
    ...SAAS_CHART_DEFAULTS,
    plugins: {
      ...SAAS_CHART_DEFAULTS.plugins,
      legend: { ...SAAS_CHART_DEFAULTS.plugins.legend, position: 'top' }
    },
    scales: { ...SAAS_CHART_DEFAULTS.scales }
  };
}

export function getDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { duration: 300 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#484551',
          font: { size: 11, family: "'Plus Jakarta Sans', 'Inter', sans-serif" },
          boxWidth: 10,
          boxHeight: 10,
          padding: 12,
          usePointStyle: true,
        }
      },
      tooltip: SAAS_CHART_DEFAULTS.plugins.tooltip,
    }
  };
}

export default {
  CHART_COLORS,
  SAAS_CHART_DEFAULTS,
  buildTimelineChartData,
  buildComparisonBarData,
  buildCacheDoughnutData,
  getTimelineOptions,
  getBarOptions,
  getDoughnutOptions
};
