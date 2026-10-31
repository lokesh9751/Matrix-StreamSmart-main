import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Activity, LineChart } from 'lucide-react';
import { buildTimelineChartData, getTimelineOptions } from '../../utils/chartController';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function BufferBitrateChart({ baselineSeries, optimizedSeries }) {
  const data    = useMemo(() => buildTimelineChartData(baselineSeries, optimizedSeries), [baselineSeries, optimizedSeries]);
  const options = useMemo(() => getTimelineOptions(), []);

  const hasData = baselineSeries?.length > 0 || optimizedSeries?.length > 0;

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="var(--primary)" />
          <div className="card-title-lg">Buffer & Bitrate Timeline</div>
        </div>
        <span className="badge badge-primary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
          Live Telemetry
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
        Dual-axis tracking: Buffer occupancy in seconds (solid lines) vs Bitrate in Kbps (dashed lines)
      </div>
      <div className="chart-container-lg">
        {hasData ? (
          <Line data={data} options={options} />
        ) : (
          <div className="empty-state">
            <LineChart size={36} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
            <div className="empty-state-text">No Telemetry Recorded</div>
            <div className="empty-state-sub">Start video playback to visualize real-time buffer stability and bitrate adaptation</div>
          </div>
        )}
      </div>
    </div>
  );
}
