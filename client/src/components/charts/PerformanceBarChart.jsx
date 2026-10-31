import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js';
import { BarChart3 } from 'lucide-react';
import { buildComparisonBarData, getBarOptions } from '../../utils/chartController';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function PerformanceBarChart({ baselineMetrics, optimizedMetrics }) {
  const data    = useMemo(() => buildComparisonBarData(baselineMetrics, optimizedMetrics), [baselineMetrics, optimizedMetrics]);
  const options = useMemo(() => getBarOptions(), []);

  const hasData = baselineMetrics || optimizedMetrics;

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={18} color="var(--primary)" />
          <div className="card-title-lg">Comparative Benchmark</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Side-by-side QoS comparison: Startup Delay (ms) · Rebuffer Duration (s) · Stalls
      </div>
      <div className="chart-container">
        {hasData ? (
          <Bar data={data} options={options} />
        ) : (
          <div className="empty-state">
            <BarChart3 size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
            <div className="empty-state-text">No Benchmark Run Recorded</div>
            <div className="empty-state-sub">Launch playback across both players to capture comparative QoS deltas</div>
          </div>
        )}
      </div>
    </div>
  );
}
