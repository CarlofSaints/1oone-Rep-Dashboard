'use client';

import { useState, useRef } from 'react';

interface UploadZoneProps {
  accept?: string;
  onFile: (file: File) => void;
  loading?: boolean;
  label?: string;
}

export default function UploadZone({ accept = '.xlsx,.xls,.csv', onFile, loading, label = 'Drop Excel file here or click to browse' }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      style={{
        border: `2px dashed ${dragOver ? '#E04E2A' : '#D1D5DB'}`,
        borderRadius: 12,
        padding: '2rem',
        textAlign: 'center',
        cursor: loading ? 'wait' : 'pointer',
        background: dragOver ? 'rgba(224,78,42,0.05)' : 'white',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange} style={{ display: 'none' }} />
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#E04E2A' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
        </svg>
      </div>
      <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
        {loading ? 'Uploading...' : label}
      </div>
    </div>
  );
}
