import React, { useRef, useState } from 'react';
import { Film, Search, ChevronLeft, ChevronRight, Play, CheckCircle2 } from 'lucide-react';

/**
 * YouTubeVideoRail – SaaS Video Stream Carousel
 *
 * Displays benchmark video streams with 16:9 thumbnails, duration badges,
 * resolution tags, category filtering, and smooth horizontal scrolling navigation.
 */
export default function YouTubeVideoRail({
  videos = [],
  selectedVideo,
  onSelectVideo,
  disabled = false
}) {
  const trackRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique categories
  const categories = ['All', ...new Set(videos.map(v => v.category || 'General').filter(Boolean))];

  // Filter videos based on category and search query
  const filteredVideos = videos.filter(v => {
    const matchesCategory = activeCategory === 'All' || (v.category || 'General') === activeCategory;
    const matchesSearch = !searchQuery || (
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.category && v.category.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    return matchesCategory && matchesSearch;
  });

  const scroll = (direction) => {
    if (trackRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      trackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="yt-video-rail-container">
      {/* ── Header: Title, Category Chips & Search ─────────────────── */}
      <div className="yt-rail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="yt-rail-title">
            <Film size={18} color="var(--primary-purple)" />
            <span>Benchmark Video Catalog</span>
            <span className="yt-count-badge">{videos.length} Streams</span>
          </div>
          <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            Choose a multi-bitrate HLS stream to compare baseline vs. ABR performance
          </span>
        </div>

        {/* Scroll arrows and search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              className="yt-search-input"
              style={{ paddingLeft: '30px' }}
              placeholder="Search streams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="yt-scroll-arrow"
            onClick={() => scroll('left')}
            title="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            className="yt-scroll-arrow"
            onClick={() => scroll('right')}
            title="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Category Filter Chips ───────────────────────────────────── */}
      <div className="yt-category-chips">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`yt-chip ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── Horizontal Scroll Track ─────────────────────────────────── */}
      <div className="yt-rail-track" ref={trackRef}>
        {filteredVideos.map((video) => {
          const isSelected = selectedVideo?.video_id === video.video_id;

          return (
            <div
              key={video.video_id}
              className={`yt-video-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && onSelectVideo && onSelectVideo(video)}
              title={disabled ? 'Benchmark running — stream change disabled' : `Select ${video.title}`}
            >
              <div className="yt-card-thumb-wrap">
                <img
                  src={video.thumbnail_url || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=480&auto=format&fit=crop&q=80'}
                  alt={video.title}
                  className="yt-card-thumb"
                  loading="lazy"
                />

                {video.category && (
                  <span className="yt-card-badge-top-left">{video.category}</span>
                )}

                {video.badge && (
                  <span className="yt-card-badge-top-right">{video.badge}</span>
                )}

                <span className="yt-card-duration">
                  {video.duration_formatted || '10:00'}
                </span>

                <div className="yt-card-hover-overlay">
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--primary-purple)',
                    color: '#FFFFFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(112, 96, 181, 0.4)'
                  }}>
                    <Play size={16} fill="currentColor" />
                  </div>
                </div>

                {isSelected && (
                  <div className="yt-card-selected-ribbon">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={11} /> SELECTED BENCHMARK
                    </span>
                  </div>
                )}
              </div>

              <div className="yt-card-info">
                <div className="yt-card-title">{video.title}</div>
                <div className="yt-card-tiers">
                  {video.available_tiers || '240p,360p,480p,720p,1080p'}
                </div>
                <div className="yt-card-meta">
                  <span>HLS Stream #{video.video_id}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
