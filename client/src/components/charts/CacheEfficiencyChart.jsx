import React, { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { HardDrive, PieChart } from 'lucide-react';
import { buildCacheDoughnutData, getDoughnutOptions } from '../../utils/chartController';

ChartJS.register(ArcElement, Tooltip, Legend);

const CACHE_HIT_DELAY_MS  = 12;
const CACHE_MISS_DELAY_MS = 260;

export default function CacheEfficiencyChart({ hits = 0, misses = 0 }) {
  const data    = useMemo(() => buildCacheDoughnutData(hits, misses), [hits, misses]);
  const options = useMemo(() => getDoughnutOptions(), []);

  const total       = hits + misses;
  const hitPct      = total > 0 ? Math.round((hits / total) * 100) : 0;
  const savedMs     = hits * CACHE_MISS_DELAY_MS - hits * CACHE_HIT_DELAY_MS;

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <HardDrive size={18} color="var(--primary)" />
          <div className="card-title-lg">Edge Cache Efficiency</div>
        </div>
        <span className="simulated-tag">SIMULATED</span>
      </div>
      <div className="chart-container" style={{ height: '170px' }}>
        {total > 0 ? (
          <Doughnut data={data} options={options} />
        ) : (
          <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
            <PieChart size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
            <div className="empty-state-sub">Awaiting cache segment fetches...</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Cache Hit Ratio</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>{hitPct}%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Hits vs Origin Misses</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{hits} / {misses}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Latency Preserved</span>
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
            {savedMs > 0 ? `${savedMs.toLocaleString()} ms` : '0 ms'}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
          Simulated edge latency: 12ms POP hit / 260ms Origin miss
        </div>
      </div>
    </div>
  );
}
