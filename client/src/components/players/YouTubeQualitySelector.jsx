import React, { useState, useRef, useEffect } from 'react';
import { Settings, ChevronDown, Check, Sparkles } from 'lucide-react';

/**
 * YouTubeQualitySelector – Clean SaaS Quality Settings Menu
 *
 * Provides a gear settings button with a popover menu showing
 * all available video quality renditions parsed from the HLS stream,
 * complete with checkmark indicators and HD badges.
 */
export default function YouTubeQualitySelector({
  levels = [],
  currentLevelIndex = -1,
  activeResolution = '--',
  isAuto = true,
  allowAuto = false,
  onSelectQuality,
  playerType = 'BASELINE'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Format label for button
  const buttonLabel = allowAuto
    ? (isAuto ? `Auto (${activeResolution !== '--' ? activeResolution : 'ABR'})` : activeResolution)
    : (activeResolution !== '--' ? activeResolution : '1080p HD');

  // Parse and sort levels from highest to lowest
  const parsedLevels = (levels && levels.length > 0)
    ? levels.map((lvl, idx) => {
        const height = lvl.height || (lvl.attrs?.RESOLUTION ? parseInt(lvl.attrs.RESOLUTION.split('x')[1]) : 0);
        const bitrateKbps = Math.round((lvl.bitrate || 0) / 1000);
        return {
          index: idx,
          height: height || (idx === 0 ? 240 : idx === 1 ? 360 : idx === 2 ? 480 : idx === 3 ? 720 : 1080),
          bitrateKbps,
          label: height ? `${height}p` : `Level ${idx + 1}`,
          isHD: height >= 720
        };
      }).sort((a, b) => b.height - a.height)
    : [
        { index: 4, height: 1080, label: '1080p', isHD: true, bitrateKbps: 5000 },
        { index: 3, height: 720,  label: '720p',  isHD: true, bitrateKbps: 2800 },
        { index: 2, height: 480,  label: '480p',  isHD: false, bitrateKbps: 1400 },
        { index: 1, height: 360,  label: '360p',  isHD: false, bitrateKbps: 800 },
        { index: 0, height: 240,  label: '240p',  isHD: false, bitrateKbps: 400 },
      ];

  const handleSelect = (idx) => {
    onSelectQuality && onSelectQuality(idx);
    setIsOpen(false);
  };

  return (
    <div className="yt-quality-selector-wrap" ref={popoverRef}>
      <button
        type="button"
        className={`yt-quality-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Select stream rendition quality"
      >
        <Settings size={13} />
        <span>{buttonLabel}</span>
        <ChevronDown size={12} />
      </button>

      {isOpen && (
        <div className="yt-quality-popover">
          <div className="yt-popover-header">
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={13} />
              <span>Quality Settings</span>
            </span>
            <span className="chip chip-blue" style={{ fontSize: '10px', padding: '1px 5px' }}>{playerType}</span>
          </div>

          <div className="yt-popover-list">
            {allowAuto && (
              <div
                className={`yt-quality-item ${isAuto ? 'active' : ''}`}
                onClick={() => handleSelect(-1)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                    {isAuto && <Check size={14} color="var(--primary-purple)" strokeWidth={2.5} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: isAuto ? 700 : 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Auto</span>
                      <span className="chip chip-green" style={{ fontSize: '9px', padding: '0 4px' }}>Recommended</span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                      Adaptive Bitrate heuristic
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ padding: '6px 14px 4px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Fixed Renditions
            </div>

            {parsedLevels.map((lvl) => {
              const isSelected = !isAuto && (
                currentLevelIndex === lvl.index ||
                activeResolution.includes(`${lvl.height}p`)
              );

              return (
                <div
                  key={lvl.index}
                  className={`yt-quality-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(lvl.index)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', display: 'flex', justifyContent: 'center' }}>
                      {isSelected && <Check size={14} color="var(--primary-purple)" strokeWidth={2.5} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: isSelected ? 700 : 500 }}>{lvl.label}</span>
                      {lvl.isHD && (
                        <span className="chip chip-blue" style={{ fontSize: '9px', padding: '0 4px', fontWeight: 700 }}>
                          HD
                        </span>
                      )}
                    </div>
                  </div>

                  {lvl.bitrateKbps > 0 && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      ~{lvl.bitrateKbps}k
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="yt-popover-footer">
            {allowAuto
              ? 'ABR dynamically adjusts quality to eliminate buffering.'
              : 'Fixed quality demonstrates stall risks under throttling.'}
          </div>
        </div>
      )}
    </div>
  );
}
