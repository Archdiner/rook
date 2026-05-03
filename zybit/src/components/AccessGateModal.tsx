"use client";

import React, { useState } from "react";
import { IntakeModal } from "./IntakeModal";

export function AccessGateModal({ 
  isOpen, 
  onClose,
  featureName = "This feature"
}: { 
  isOpen: boolean; 
  onClose: () => void;
  featureName?: string;
}) {
  const [showIntake, setShowIntake] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !showIntake) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showIntake, onClose]);

  if (!isOpen) return null;

  if (showIntake) {
    return <IntakeModal isOpen={true} onClose={() => { setShowIntake(false); onClose(); }} />;
  }

  return (
    <div
      onClick={onClose}
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
          maxWidth: '440px',
          background: '#FAFAF8',
          border: '2px solid #111',
          padding: '48px',
          boxShadow: '8px 8px 0px rgba(17, 17, 17, 1)',
          animation: 'modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
          textAlign: 'center',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
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

        <div className="pixel-text" style={{ fontSize: '48px', marginBottom: '16px', color: '#111' }}>
          LOCK
        </div>
        <h3
          style={{
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            margin: '0 0 12px',
            color: '#111',
          }}
        >
          Provisioned Access Required
        </h3>
        <p style={{ fontSize: '15px', color: '#6B6B6B', margin: '0 0 32px', lineHeight: 1.5 }}>
          {featureName} is currently locked in this interactive preview. To fully deploy Zybit on your domain, you need an enterprise plan.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => setShowIntake(true)}
            className="btn-brutalist"
            style={{ width: '100%' }}
          >
            Request Access
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#6B6B6B',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Return to preview
          </button>
        </div>
      </div>
    </div>
  );
}
