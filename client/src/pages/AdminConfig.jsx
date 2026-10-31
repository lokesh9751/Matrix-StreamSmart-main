import React, { useState, useEffect } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Server,
  Film,
  Sliders,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Database,
  HardDrive,
  Info
} from 'lucide-react';
import api from '../services/api';

// ── Generic Modal form ─────────────────────────────────────────────────────
function Modal({ title, icon: Icon, fields, values, onChange, onSave, onClose, saving }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {Icon && <Icon size={18} color="var(--primary)" />}
            <div className="modal-title">{title}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          {fields.map(f => (
            <div className="form-group" key={f.key}>
              <label className="form-label">{f.label}</label>
              <input
                className="form-control"
                type={f.type || 'text'}
                step={f.step}
                min={f.min}
                max={f.max}
                value={values[f.key] ?? ''}
                onChange={e => onChange(f.key, e.target.value)}
                placeholder={f.placeholder}
              />
              {f.hint && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {f.hint}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Field definitions ──────────────────────────────────────────────────────
const PROFILE_FIELDS = [
  { key: 'profileName',   label: 'Profile Name',           placeholder: 'e.g. Rural 3G' },
  { key: 'bandwidthKbps', label: 'Bandwidth (Kbps)',       type: 'number', min: 100, max: 100000 },
  { key: 'latencyMs',     label: 'Latency (ms)',           type: 'number', min: 0,   max: 5000 },
  { key: 'packetLossPct', label: 'Packet Loss (%)',        type: 'number', step: 0.1, min: 0, max: 100 },
  { key: 'cacheHitProb',  label: 'Cache Hit Probability',  type: 'number', step: 0.05, min: 0, max: 1, hint: '0.00 – 1.00 ratio' },
];

const VIDEO_FIELDS = [
  { key: 'title',          label: 'Video Title',            placeholder: 'e.g. My HLS Stream' },
  { key: 'streamUrl',      label: 'HLS Manifest URL (.m3u8)', placeholder: 'https://…/master.m3u8' },
  { key: 'availableTiers', label: 'Available Tiers',        placeholder: '240p,360p,480p,720p,1080p', hint: 'Comma-separated resolution labels' },
];

export default function AdminConfig() {
  const [profiles, setProfiles] = useState([]);
  const [videos,   setVideos]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null); // { type, mode, values }
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState(null);

  const showNotice = (msg, kind = 'success') => {
    setNotice({ msg, kind });
    setTimeout(() => setNotice(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([api.getAdminProfiles(), api.getAdminVideos()]);
      setProfiles(pRes.profiles || []);
      setVideos(vRes.videos || []);
    } catch {
      showNotice('Could not reach backend API – showing cached configuration', 'warning');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ── Open modal ────────────────────────────────────────────────────────
  const openProfileModal = (profile = null) => {
    setModal({
      type: 'profile',
      mode: profile ? 'edit' : 'add',
      id:   profile?.profile_id,
      values: profile ? {
        profileName:   profile.profile_name,
        bandwidthKbps: profile.bandwidth_kbps,
        latencyMs:     profile.latency_ms,
        packetLossPct: profile.packet_loss_pct,
        cacheHitProb:  profile.cache_hit_prob,
      } : { profileName:'', bandwidthKbps: 1000, latencyMs: 50, packetLossPct: 0, cacheHitProb: 0.5 },
    });
  };

  const openVideoModal = (video = null) => {
    setModal({
      type: 'video',
      mode: video ? 'edit' : 'add',
      id:   video?.video_id,
      values: video ? {
        title:          video.title,
        streamUrl:      video.stream_url,
        availableTiers: video.available_tiers,
      } : { title:'', streamUrl:'', availableTiers:'240p,360p,480p,720p,1080p' },
    });
  };

  const handleModalChange = (key, value) => {
    setModal(m => ({ ...m, values: { ...m.values, [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal.type === 'profile') {
        if (modal.mode === 'add') {
          await api.createProfile(modal.values);
          showNotice('Network profile created successfully');
        } else {
          await api.updateProfile(modal.id, modal.values);
          showNotice('Network profile updated successfully');
        }
      } else {
        if (modal.mode === 'add') {
          await api.createVideo(modal.values);
          showNotice('Video sample added successfully');
        } else {
          await api.updateVideo(modal.id, modal.values);
          showNotice('Video sample updated successfully');
        }
      }
      setModal(null);
      await load();
    } catch (err) {
      showNotice(`Save failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (id) => {
    if (!confirm('Are you sure you want to delete this network profile?')) return;
    try {
      await api.deleteProfile(id);
      showNotice('Profile deleted');
      load();
    } catch (err) {
      showNotice(`Delete failed: ${err.message}`, 'error');
    }
  };

  const deleteVideo = async (id) => {
    if (!confirm('Are you sure you want to deactivate this video stream sample?')) return;
    try {
      await api.deleteVideo(id);
      showNotice('Video deactivated');
      load();
    } catch (err) {
      showNotice(`Failed: ${err.message}`, 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Admin Configuration</div>
          <div className="page-subtitle">
            Manage simulation network presets, video stream inventory, and ABR heuristics
          </div>
        </div>
      </div>

      {notice && (
        <div className={`alert alert-${notice.kind}`} style={{ marginBottom: '16px' }}>
          {notice.kind === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{notice.msg}</span>
        </div>
      )}

      <div className="admin-grid">
        {/* ── Network Profiles ──────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Server size={18} color="var(--primary)" />
              <div className="card-title-lg">Network Profiles</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openProfileModal()}>
              <Plus size={14} />
              <span>Add Profile</span>
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <span className="spinner" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="empty-state">
              <Database size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
              <div>No profiles found. Add one above.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profiles.map(p => (
                <div className="admin-list-item" key={p.profile_id}>
                  <div className="admin-item-info">
                    <div className="admin-item-name">{p.profile_name}</div>
                    <div className="admin-item-detail">
                      <span className="badge badge-primary">{p.bandwidth_kbps} Kbps</span>
                      <span className="badge badge-secondary">{p.latency_ms} ms</span>
                      <span className="badge badge-secondary">{p.packet_loss_pct}% loss</span>
                      <span className="badge badge-success">{Math.round(p.cache_hit_prob * 100)}% cache</span>
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openProfileModal(p)}
                      title="Edit Profile"
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteProfile(p.profile_id)}
                      title="Delete Profile"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Video Samples ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Film size={18} color="var(--primary)" />
              <div className="card-title-lg">Video Stream Samples</div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => openVideoModal()}>
              <Plus size={14} />
              <span>Add Video</span>
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <span className="spinner" />
            </div>
          ) : videos.length === 0 ? (
            <div className="empty-state">
              <Film size={32} color="var(--text-muted)" style={{ margin: '0 auto 8px' }} />
              <div>No video samples. Add one above.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {videos.map(v => (
                <div className="admin-list-item" key={v.video_id}>
                  <div className="admin-item-info">
                    <div className="admin-item-name">{v.title}</div>
                    <div className="admin-item-detail" style={{ wordBreak: 'break-all' }}>
                      <span className="badge badge-primary">{v.available_tiers}</span>
                      <span className="badge badge-secondary">{v.duration_sec}s</span>
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '4px',
                        wordBreak: 'break-all',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {v.stream_url}
                    </div>
                  </div>
                  <div className="admin-item-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openVideoModal(v)}
                      title="Edit Video"
                    >
                      <Pencil size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => deleteVideo(v.video_id)}
                      title="Deactivate Video"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ABR Algorithm Heuristic Reference ─────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} color="var(--primary)" />
              <div className="card-title-lg">ABR Heuristic Reference</div>
            </div>
            <span className="badge badge-primary">Dynamic Rule-Based</span>
          </div>
          <table className="data-table" style={{ fontSize: '12px' }}>
            <thead>
              <tr>
                <th>Quality Tier</th>
                <th>Required Bitrate</th>
                <th>Heuristic Assignment</th>
              </tr>
            </thead>
            <tbody>
              {[
                { q: '240p',  b: '400 Kbps',  cond: 'Emergency Fallback (Buffer < 3.5s)' },
                { q: '360p',  b: '800 Kbps',  cond: 'Low Bandwidth Safe Tier' },
                { q: '480p',  b: '1,400 Kbps', cond: 'Standard Definition Default' },
                { q: '720p',  b: '2,800 Kbps', cond: 'High Definition (Requires BW > 3.7 Mbps)' },
                { q: '1080p', b: '5,000 Kbps', cond: 'Full HD Peak (Baseline is locked here)' },
              ].map(r => (
                <tr key={r.q}>
                  <td className="td-primary">
                    <span className="badge badge-primary">{r.q}</span>
                  </td>
                  <td className="td-mono">{r.b}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {r.cond}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div
            style={{
              marginTop: '16px',
              padding: '12px 14px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: '1.7',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
              <Sliders size={14} color="var(--primary)" />
              <span>Controller Constants</span>
            </div>
            <div><strong>Decision Interval:</strong> 1,500 ms continuous polling loop</div>
            <div><strong>Safety Headroom Margin:</strong> 75% max utilization of available bandwidth</div>
            <div><strong>Emergency Downshift:</strong> Buffer Occupancy &lt; 3.5 seconds</div>
            <div><strong>Safe Upshift Requirement:</strong> Buffer Occupancy &gt; 10.0 seconds AND target bitrate fits headroom</div>
          </div>
        </div>

        {/* ── Cache Simulator Reference ─────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HardDrive size={18} color="var(--primary)" />
              <div className="card-title-lg">Edge Cache Architecture</div>
            </div>
            <span className="simulated-tag">SIMULATED</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <span>Edge Cache Hit Delay</span>
              <strong className="text-mono text-green">12 ms (CDN POP)</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <span>Cache Miss Delay (Origin)</span>
              <strong className="text-mono text-red">260 ms (Origin Fetch)</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <span>LRU Cache Capacity</span>
              <strong className="text-mono">200 segments</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0'
              }}
            >
              <span>Network Jitter Range</span>
              <strong className="text-mono">0 – 25 ms</strong>
            </div>
          </div>
          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              background: 'var(--primary-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '11px',
              color: 'var(--primary-dark)',
              fontFamily: 'var(--font-mono)'
            }}
          >
            Transfer Time = (Segment Bits / Available BW) × 1000 ms<br />
            Total Delay = Transfer + Latency + Cache Delay + Jitter
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <Modal
          title={`${modal.mode === 'add' ? 'Add' : 'Edit'} ${
            modal.type === 'profile' ? 'Network Profile' : 'Video Sample'
          }`}
          icon={modal.type === 'profile' ? Server : Film}
          fields={modal.type === 'profile' ? PROFILE_FIELDS : VIDEO_FIELDS}
          values={modal.values}
          onChange={handleModalChange}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}
