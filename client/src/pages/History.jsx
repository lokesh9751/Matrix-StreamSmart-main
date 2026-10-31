import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getStoredSessions } from '../services/sessionStore';
import {
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  ClipboardList
} from 'lucide-react';

function getProfileChipClass(name) {
  if (name?.includes('Rural 3G')) return 'chip-red';
  if (name?.includes('Train')) return 'chip-amber';
  if (name?.includes('Fiber')) return 'chip-green';
  return 'chip-blue';
}

export default function History() {
  const [sessions,      setSessions]      = useState([]);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [profileFilter, setProfileFilter] = useState('');
  const [profiles,      setProfiles]      = useState([]);
  const [page,          setPage]          = useState(0);
  const limit = 10;
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const [histRes, profRes] = await Promise.all([
        api.getHistory({ limit, offset: page * limit, search, profileId: profileFilter || undefined }).catch(() => ({ sessions: [], total: 0 })),
        api.getProfiles().catch(() => ({ profiles: [] }))
      ]);
      const apiSessions = histRes?.sessions || [];
      if (apiSessions.length > 0) {
        setSessions(apiSessions);
        setTotal(histRes.total || apiSessions.length);
      } else {
        const local = getStoredSessions();
        const filtered = search
          ? local.filter(s => (s.video_title || '').toLowerCase().includes(search.toLowerCase()) || (s.profile_name || '').toLowerCase().includes(search.toLowerCase()))
          : local;
        setSessions(filtered);
        setTotal(filtered.length);
      }
      setProfiles(profRes?.profiles || []);
    } catch {
      const local = getStoredSessions();
      setSessions(local);
      setTotal(local.length);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => { load(); }, [page, search, profileFilter]);

  const formatDate = (dt) => dt ? new Date(dt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Benchmark Test History</h2>
          <div className="page-subtitle">
            Auditable repository of all recorded dual-player streaming trials, network simulations, and comparative outcomes.
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="form-control"
              style={{ paddingLeft: '36px' }}
              placeholder="Search by video title, network profile, session ID…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          <div style={{ minWidth: '220px' }}>
            <select
              className="form-control"
              value={profileFilter}
              onChange={e => { setProfileFilter(e.target.value); setPage(0); }}
            >
              <option value="">All Network Profiles</option>
              {profiles.map(p => (
                <option key={p.profile_id} value={p.profile_id}>{p.profile_name}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary" onClick={() => { setSearch(''); setProfileFilter(''); setPage(0); }}>
            <RotateCcw size={14} />
            <span>Clear</span>
          </button>

          <button className="btn btn-primary" onClick={load}>
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div className="card-title">Recorded Sessions</div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{total} total records</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Video Stream</th>
                <th>Network Profile</th>
                <th>Bandwidth</th>
                <th>RTT Latency</th>
                <th>Duration</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Recorded At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                    Loading benchmark sessions from MySQL…
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <ClipboardList size={32} color="var(--primary-purple)" style={{ margin: '0 auto 10px auto' }} />
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>No sessions found</div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Try clearing your search query or run a new benchmark on the Workbench.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : sessions.map(s => (
                <tr key={s.session_id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary-purple)' }}>
                    #{s.session_id}
                  </td>
                  <td style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.video_title || '—'}
                  </td>
                  <td>
                    {s.profile_name
                      ? <span className={`chip ${getProfileChipClass(s.profile_name)}`}>{s.profile_name}</span>
                      : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{s.sim_bandwidth_kbps || s.bandwidth_kbps || 4500} Kbps</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{s.sim_latency_ms || s.latency_ms || 50} ms</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{s.test_duration_sec || s.duration_sec || 30}s</td>
                  <td>
                    <span className="chip chip-gray">{s.measurement_mode || 'DUAL_PLAYER'}</span>
                  </td>
                  <td>
                    <span className={`chip ${String(s.status || '').toLowerCase() === 'completed' ? 'chip-green' : String(s.status || '').toLowerCase() === 'running' ? 'chip-blue' : 'chip-amber'}`}>
                      ● {s.status || 'completed'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {formatDate(s.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-outline-blue btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11.5px' }}
                      onClick={() => navigate(`/report/${s.session_id}`)}
                    >
                      <span>View Report</span>
                      <ArrowRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>
            <span style={{ padding: '4px 12px', color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 500 }}>
              Page {page + 1} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
