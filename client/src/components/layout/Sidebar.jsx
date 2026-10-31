import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  SlidersHorizontal,
  CloudUpload,
  BarChart3,
  History,
  FileText,
  Settings,
  Activity,
  Radio
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Core' },
  { to: '/workbench', label: 'Streaming Workbench', icon: SlidersHorizontal, section: 'Core' },
  { to: '/upload', label: 'Upload Video', icon: CloudUpload, section: 'Core' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, section: 'Insights' },
  { to: '/history', label: 'Test History', icon: History, section: 'Insights' },
  { to: '/report/demo', label: 'Reports', icon: FileText, section: 'Insights' },
  { to: '/admin', label: 'Settings', icon: Settings, section: 'System' },
];

export default function Sidebar() {
  const sections = ['Core', 'Insights', 'System'];

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Activity size={18} strokeWidth={2.5} />
        </div>
        <div className="sidebar-logo-text">
          Stream<span>Smart</span>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="sidebar-nav">
        {sections.map(section => {
          const items = navItems.filter(n => n.section === section);
          if (items.length === 0) return null;

          return (
            <div key={section}>
              <div className="nav-section-label">{section}</div>
              {items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    <span className="nav-item-icon">
                      <Icon size={18} />
                    </span>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer Status Card */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-card">
          <div className="sidebar-footer-version">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={13} color="var(--primary-purple)" />
              <span>StreamSmart SaaS</span>
            </span>
            <span className="chip chip-green" style={{ padding: '1px 6px', fontSize: '10px' }}>v1.2</span>
          </div>
          <div style={{ marginTop: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Dual-Player Benchmarking
          </div>
        </div>
      </div>
    </aside>
  );
}
