"use client";

import React, { useState } from "react";

export function IntakeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({ name: '', email: '', url: '' });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong.');
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setStatus('idle');
      setFormData({ name: '', email: '', url: '' });
      setErrorMsg('');
    }, 300);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'modalFadeIn 0.3s ease-out',
      }}
    >
      {/* Backdrop */}
      <div
        className="bg-dots"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 10, 8, 0.85)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '480px',
          background: '#FAFAF8',
          border: '2px solid #111',
          borderRadius: '0',
          padding: '48px',
          boxShadow: '8px 8px 0px rgba(17, 17, 17, 1)',
          animation: 'modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '28px',
            color: '#6B6B6B',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
          }}
        >
          ×
        </button>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div className="pixel-text" style={{ fontSize: '48px', marginBottom: '16px' }}>OK</div>
            <h3
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                margin: '0 0 12px',
                color: '#111',
              }}
            >
              Request received.
            </h3>
            <p style={{ fontSize: '16px', color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
              We&apos;ll review your domain and be in touch to arrange provisioned access.
            </p>
            <button
              onClick={handleClose}
              className="btn-brutalist"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="pixel-text" style={{ color: '#111', fontSize: '12px', marginBottom: '8px', letterSpacing: '0.1em' }}>
              PROVISIONING
            </div>
            <h3
              style={{
                fontSize: '28px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                margin: '0 0 8px',
                color: '#111',
              }}
            >
              Request Access
            </h3>
            <p style={{ fontSize: '15px', color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
              Zybit is currently in closed rollout. Request access for your domain below.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="intake-name"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B6B6B',
                    marginBottom: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Your name
                </label>
                <input
                  id="intake-name"
                  type="text"
                  required
                  placeholder="Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  style={{ boxSizing: 'border-box', borderRadius: 0, border: '1px solid #111' }}
                />
              </div>

              <div>
                <label
                  htmlFor="intake-email"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B6B6B',
                    marginBottom: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Work email
                </label>
                <input
                  id="intake-email"
                  type="email"
                  required
                  placeholder="jane@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field"
                  style={{ boxSizing: 'border-box', borderRadius: 0, border: '1px solid #111' }}
                />
              </div>

              <div>
                <label
                  htmlFor="intake-url"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#6B6B6B',
                    marginBottom: '6px',
                    letterSpacing: '0.02em',
                  }}
                >
                  Domain
                </label>
                <input
                  id="intake-url"
                  type="url"
                  required
                  placeholder="https://yoursite.com"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="input-field"
                  style={{ boxSizing: 'border-box', borderRadius: 0, border: '1px solid #111' }}
                />
              </div>

              {status === 'error' && (
                <p style={{ fontSize: '14px', color: '#d32f2f', margin: '0', padding: '8px 12px', background: 'rgba(211,47,47,0.06)' }}>
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="btn-brutalist"
                style={{
                  marginTop: '8px',
                  width: '100%',
                  opacity: status === 'submitting' ? 0.7 : 1,
                  cursor: status === 'submitting' ? 'wait' : 'pointer',
                }}
              >
                {status === 'submitting' ? 'Sending…' : 'Request Access'}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
