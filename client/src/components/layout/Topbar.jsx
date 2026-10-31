import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  Bell,
  UserCheck,
  Play
} from 'lucide-react';

const PAGE_TITLES = {
  '/dashboard': 'Streaming Performance Dashboard',
  '/workbench': 'Streaming Workbench & Comparison',
  '/analytics': 'Live Streaming Analytics',
  '/history':   'Benchmark Test History',
  '/admin':     'Settings & Configuration',
};

export default function Topbar() {
  const location = useLocation();

  const title = location.pathname.startsWith('/report')
    ? 'Dual-Player Comparison Report'
    : (PAGE_TITLES[location.pathname] || 'StreamSmart Platform');

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-right">
        {/* Quick Benchmark Button */}
        <Link to="/workbench" className="btn btn-primary btn-sm">
          <Play size={13} fill="currentColor" />
          <span>New Benchmark</span>
        </Link>

        {/* Notifications Icon */}
        <button className="topbar-icon-btn" title="System Notifications">
          <Bell size={17} />
          <span className="topbar-badge-dot" />
        </button>

        {/* User Profile Badge */}
        <div className="user-chip" title="Active Tester Profile">
          <div className="user-avatar">
            <UserCheck size={16} />
          </div>
          <span style={{ fontWeight: 600 }}>nitish_tester</span>
          <span className="chip chip-blue" style={{ fontSize: '10px', padding: '1px 6px' }}>Tester</span>
        </div>
      </div>
    </header>
  );
}
