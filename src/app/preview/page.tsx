'use client';

export default function PreviewPage() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'monospace',
        color: '#e0e0e0',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '3rem',
          border: '1px solid rgba(0, 255, 136, 0.2)',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            letterSpacing: '0.3em',
            marginBottom: '0.5rem',
            color: '#00ff88',
            textShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
          }}
        >
          POWERFIST PREVIEW
        </h1>
        <p
          style={{
            fontSize: '0.875rem',
            letterSpacing: '0.2em',
            marginBottom: '3rem',
            color: '#888',
          }}
        >
          One screen at a time
        </p>
        <div
          style={{
            padding: '2rem 3rem',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            background: 'rgba(0, 255, 136, 0.05)',
          }}
        >
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '1rem', color: '#666' }}>
            ACTIVE VIEW
          </p>
          <p style={{ fontSize: '1.25rem', letterSpacing: '0.1em', color: '#00ff88' }}>STANDBY</p>
        </div>
        <p
          style={{
            marginTop: '2rem',
            fontSize: '0.75rem',
            letterSpacing: '0.1em',
            color: '#555',
          }}
        >
          Awaiting cadre signal...
        </p>
      </div>
    </div>
  );
}