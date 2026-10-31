import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UploadCloud,
  Film,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Play
} from 'lucide-react';
import api from '../services/api';

export default function VideoUpload() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('video/') && !selectedFile.name.match(/\.(mp4|mkv|mov|webm)$/i)) {
      setError('Please select a valid video file (MP4, MKV, MOV, WEBM)');
      return;
    }
    setError(null);
    setFile(selectedFile);
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file to upload.');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a video title.');
      return;
    }

    setUploading(true);
    setProgress(15);
    setError(null);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title.trim());

    try {
      const progressTimer = setInterval(() => {
        setProgress(prev => (prev < 85 ? prev + 10 : prev));
      }, 500);

      const res = await api.uploadVideo(formData);
      clearInterval(progressTimer);
      setProgress(100);
      setUploadedVideo(res.video);
    } catch (err) {
      setError(err.message || 'Video upload failed. Check Cloudinary credentials in .env.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div style={{ maxWidth: '640px', margin: '40px auto', padding: '0 20px' }}>
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '52px',
          height: '52px',
          borderRadius: '16px',
          background: 'var(--primary-subtle)',
          color: 'var(--primary-purple)',
          marginBottom: '16px'
        }}>
          <UploadCloud size={28} />
        </div>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: '8px'
        }}>
          Upload Video Stream
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
          Direct MP4 upload with automated 6MB chunking and adaptive HLS manifest generation
        </p>
      </div>

      {/* ── Success State Card ──────────────────────────────────────── */}
      {uploadedVideo ? (
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)',
          textAlign: 'center'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--success-bg)',
            color: 'var(--success)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <CheckCircle2 size={24} />
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Video Uploaded Successfully!
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Transcoded to adaptive HLS manifest (.m3u8) on Cloudinary.
          </p>

          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: '10px',
            padding: '14px',
            textAlign: 'left',
            marginBottom: '24px',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)'
          }}>
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Title: </span>
              <strong>{uploadedVideo.title}</strong>
            </div>
            <div style={{ wordBreak: 'break-all', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)' }}>HLS Manifest: </span>
              <span style={{ color: 'var(--primary-purple)' }}>{uploadedVideo.hlsPlaylistUrl}</span>
            </div>
            {uploadedVideo.thumbnailUrl && (
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <img
                  src={uploadedVideo.thumbnailUrl}
                  alt="Thumbnail"
                  style={{ width: '180px', height: '100px', objectFit: 'cover', borderRadius: '8px' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setUploadedVideo(null);
                setFile(null);
                setTitle('');
              }}
            >
              Upload Another
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => navigate('/workbench')}
            >
              <Play size={15} />
              <span>Test in Workbench</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── Modern Upload Form ──────────────────────────────────────── */
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03)'
        }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '12px 14px',
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: '10px',
              color: 'var(--error)',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{error}</div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            action="/api/video/upload"
            method="POST"
            encType="multipart/form-data"
          >
            {/* 1. Video Title Input */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                Video Title
              </label>
              <input
                type="text"
                name="title"
                className="form-control"
                placeholder="e.g. 4K Nature Benchmark Stream"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={uploading}
                required
                style={{
                  height: '42px',
                  borderRadius: '10px',
                  fontSize: '14px',
                  padding: '0 14px'
                }}
              />
            </div>

            {/* 2. Custom Video File Dropzone */}
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', display: 'block' }}>
                Video File
              </label>

              <input
                type="file"
                name="video"
                ref={fileInputRef}
                accept="video/*"
                onChange={e => handleFileChange(e.target.files?.[0])}
                disabled={uploading}
                style={{ display: 'none' }}
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--primary-purple)' : file ? 'var(--success)' : 'var(--border)'}`,
                  background: isDragging ? 'var(--primary-subtle)' : file ? 'var(--success-bg)' : 'var(--bg-subtle)',
                  borderRadius: '12px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
              >
                {file ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(22, 163, 74, 0.1)',
                      color: 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Film size={22} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {file.name}
                    </div>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      background: '#FFFFFF',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)'
                    }}>
                      {formatFileSize(file.size)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--primary-purple)', marginTop: '4px' }}>
                      Click to choose another file
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'var(--primary-subtle)',
                      color: 'var(--primary-purple)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <UploadCloud size={22} />
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Drag and drop your video here, or <span style={{ color: 'var(--primary-purple)' }}>browse</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Supports MP4, MKV, MOV, or WEBM up to 500MB
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <span>Uploading & initiating adaptive HLS encoding…</span>
                  <span>{progress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary-purple)', transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {/* 3. Styled Upload Submit Button */}
            <button
              type="submit"
              disabled={uploading || !file}
              style={{
                width: '100%',
                height: '44px',
                borderRadius: '10px',
                border: 'none',
                background: uploading || !file ? 'var(--border)' : 'var(--primary-purple)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: uploading || !file ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: uploading || !file ? 'none' : '0 4px 12px rgba(112, 96, 181, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              {uploading ? (
                <>
                  <span className="spinner" style={{ width: '16px', height: '16px' }} />
                  <span>Uploading to Cloudinary…</span>
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  <span>Upload Video</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
