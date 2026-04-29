'use client';

import Link from 'next/link';
import React, { useState } from 'react';

import {
  DISCOVERY_Q3_OPTIONS,
  DISCOVERY_Q5_OPTIONS,
  DISCOVERY_Q6_OPTIONS,
  validateDiscoveryPayload,
} from '@/lib/discovery/schema';

type YesNo = 'yes' | 'no' | '';
type Status = 'idle' | 'submitting' | 'success' | 'error';

const INK = '#111';
const MUTED = '#6B6B6B';
const CREAM = '#FAFAF8';
const HAIRLINE = 'rgba(0,0,0,0.12)';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: MUTED,
  marginBottom: '8px',
  letterSpacing: '0.02em',
};

const promptStyle: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: 600,
  color: INK,
  margin: '0 0 16px',
  lineHeight: 1.45,
  letterSpacing: '-0.01em',
};

const numberStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: MUTED,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  marginBottom: '10px',
  display: 'block',
  fontVariantNumeric: 'tabular-nums',
};

const questionBlockStyle: React.CSSProperties = {
  marginBottom: '48px',
};

function OptionRow({
  selected,
  children,
  onChange,
  type,
  name,
  value,
}: {
  selected: boolean;
  children: React.ReactNode;
  onChange: () => void;
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        border: `1px solid ${selected ? INK : HAIRLINE}`,
        background: selected ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
        fontSize: '15px',
        color: INK,
        lineHeight: 1.4,
      }}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={selected}
        onChange={onChange}
        style={{
          accentColor: INK,
          width: '16px',
          height: '16px',
          flexShrink: 0,
          margin: 0,
          cursor: 'pointer',
        }}
      />
      <span>{children}</span>
    </label>
  );
}

function ScaleButton({
  value,
  selected,
  onSelect,
}: {
  value: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Rate ${value} out of 5`}
      style={{
        flex: '1 1 0',
        minWidth: 0,
        padding: '14px 0',
        border: `1px solid ${selected ? INK : HAIRLINE}`,
        background: selected ? INK : 'rgba(255,255,255,0.55)',
        color: selected ? CREAM : INK,
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        fontFamily: 'inherit',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </button>
  );
}

export default function DiscoveryPage() {
  const [q1, setQ1] = useState<YesNo>('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState<string[]>([]);
  const [q3Other, setQ3Other] = useState('');
  const [q4, setQ4] = useState<number>(0);
  const [q4Note, setQ4Note] = useState('');
  const [q5, setQ5] = useState('');
  const [q6, setQ6] = useState('');
  const [q7, setQ7] = useState<YesNo>('');
  const [q7Email, setQ7Email] = useState('');
  const [q8, setQ8] = useState<YesNo>('');
  const [q8Url, setQ8Url] = useState('');
  const [websiteField, setWebsiteField] = useState('');

  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const toggleQ3 = (option: string) => {
    setQ3((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const payload = {
      q1,
      q2: q1 === 'yes' ? q2.trim() : '',
      q3: q1 === 'yes' ? q3 : [],
      q3_other: q1 === 'yes' && q3.includes('Other') ? q3Other.trim() : '',
      q4: q1 === 'yes' ? q4 : null,
      q4_note: q1 === 'yes' ? q4Note.trim() : '',
      q5: q1 === 'yes' ? q5 : '',
      q6: q1 === 'yes' ? q6 : '',
      q7: q1 === 'yes' ? q7 : '',
      q7_email: q1 === 'yes' && q7 === 'yes' ? q7Email.trim() : '',
      q8: q1 === 'yes' ? q8 : '',
      q8_url: q1 === 'yes' && q8 === 'yes' ? q8Url.trim() : '',
      website_field: websiteField,
    };

    const validated = validateDiscoveryPayload(payload);
    if (!validated.ok) {
      setErrorMsg(validated.error);
      return;
    }

    setStatus('submitting');

    try {
      const res = await fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated.data),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      setStatus('success');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  const showRest = q1 === 'yes';
  const showShortSubmit = q1 === 'no';

  return (
    <main
      style={{
        background: CREAM,
        minHeight: '100vh',
        color: INK,
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
      }}
    >
      <header
        style={{
          padding: '32px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        <Link
          href="/"
          aria-label="Go to Forge homepage"
          style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}
        >
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: INK,
            }}
          />
          <span
            className="sans-text"
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: INK,
            }}
          >
            Forge
          </span>
        </Link>
        <div
          className="sans-text"
          style={{
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: MUTED,
          }}
        >
          Customer Discovery
        </div>
      </header>

      <article
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '40px 24px 96px',
        }}
      >
        {status === 'success' ? (
          <div style={{ animation: 'discoveryFadeIn 0.4s ease-out' }}>
            <h1
              style={{
                fontSize: '36px',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                color: INK,
                margin: '0 0 16px',
                lineHeight: 1.1,
              }}
            >
              Thank you.
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: '19px',
                lineHeight: 1.6,
                color: INK,
                margin: '0 0 12px',
              }}
            >
              Your response is recorded. If you offered a call or an audit, we&apos;ll be in
              touch within a couple of days.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: '17px',
                lineHeight: 1.6,
                color: MUTED,
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              No further action is required. You can close this tab.
            </p>
          </div>
        ) : (
          <>
            <p
              style={{
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: '19px',
                lineHeight: 1.6,
                color: INK,
                margin: '0 0 12px',
              }}
            >
              We&apos;re building a product that turns real user behavior into the precise
              changes that move conversion. Before we ship a line of code, we&apos;d like to
              understand what you&apos;ve actually tried — and what would actually be useful.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-newsreader), Georgia, serif',
                fontSize: '17px',
                lineHeight: 1.6,
                color: MUTED,
                margin: '0 0 56px',
                fontStyle: 'italic',
              }}
            >
              Three minutes. Eight questions.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <input
                type="text"
                name="website_field"
                value={websiteField}
                onChange={(e) => setWebsiteField(e.target.value)}
                aria-hidden="true"
                tabIndex={-1}
                autoComplete="off"
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  top: '-9999px',
                  width: '1px',
                  height: '1px',
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />

              <div style={questionBlockStyle}>
                <span style={numberStyle}>01</span>
                <p style={promptStyle}>
                  In the last 90 days, have you spent meaningful time trying to fix
                  conversion, activation, or retention on something you built?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <OptionRow
                    selected={q1 === 'yes'}
                    onChange={() => setQ1('yes')}
                    type="radio"
                    name="q1"
                    value="yes"
                  >
                    Yes
                  </OptionRow>
                  <OptionRow
                    selected={q1 === 'no'}
                    onChange={() => setQ1('no')}
                    type="radio"
                    name="q1"
                    value="no"
                  >
                    No
                  </OptionRow>
                </div>
              </div>

              {showShortSubmit && (
                <p
                  style={{
                    fontFamily: 'var(--font-newsreader), Georgia, serif',
                    fontSize: '17px',
                    lineHeight: 1.6,
                    color: MUTED,
                    margin: '0 0 32px',
                    fontStyle: 'italic',
                  }}
                >
                  Understood — that&apos;s all we need. Thank you for the honest answer.
                </p>
              )}

              {showRest && (
                <>
                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>02</span>
                    <p style={promptStyle}>What&apos;s the URL of the product?</p>
                    <label htmlFor="q2" style={labelStyle}>
                      Optional
                    </label>
                    <input
                      id="q2"
                      type="text"
                      placeholder="https://..."
                      value={q2}
                      onChange={(e) => setQ2(e.target.value)}
                      className="input-field"
                      style={{ boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>03</span>
                    <p style={promptStyle}>What did you try?</p>
                    <p
                      style={{
                        fontSize: '14px',
                        color: MUTED,
                        margin: '0 0 16px',
                        lineHeight: 1.5,
                      }}
                    >
                      Select all that apply.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {DISCOVERY_Q3_OPTIONS.map((option) => (
                        <OptionRow
                          key={option}
                          selected={q3.includes(option)}
                          onChange={() => toggleQ3(option)}
                          type="checkbox"
                          name="q3"
                          value={option}
                        >
                          {option}
                        </OptionRow>
                      ))}
                    </div>
                    {q3.includes('Other') && (
                      <div style={{ marginTop: '16px' }}>
                        <label htmlFor="q3-other" style={labelStyle}>
                          Tell us what
                        </label>
                        <input
                          id="q3-other"
                          type="text"
                          value={q3Other}
                          onChange={(e) => setQ3Other(e.target.value)}
                          className="input-field"
                          style={{ boxSizing: 'border-box' }}
                          placeholder="Briefly..."
                        />
                      </div>
                    )}
                  </div>

                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>04</span>
                    <p style={promptStyle}>Did it work?</p>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginBottom: '10px',
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <ScaleButton
                          key={value}
                          value={value}
                          selected={q4 === value}
                          onSelect={() => setQ4(value)}
                        />
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        color: MUTED,
                        marginBottom: '20px',
                        letterSpacing: '0.02em',
                      }}
                    >
                      <span>1 · Not at all</span>
                      <span>5 · Materially moved the metric</span>
                    </div>
                    <label htmlFor="q4-note" style={labelStyle}>
                      What worked or didn&apos;t? (optional)
                    </label>
                    <textarea
                      id="q4-note"
                      value={q4Note}
                      onChange={(e) => setQ4Note(e.target.value)}
                      className="input-field"
                      rows={3}
                      style={{
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        minHeight: '88px',
                      }}
                      placeholder="A sentence or two is plenty."
                    />
                  </div>

                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>05</span>
                    <p style={promptStyle}>
                      If a tool gave you 3 specific, evidenced changes to make right now —
                      would you ship them?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {DISCOVERY_Q5_OPTIONS.map((option) => (
                        <OptionRow
                          key={option}
                          selected={q5 === option}
                          onChange={() => setQ5(option)}
                          type="radio"
                          name="q5"
                          value={option}
                        >
                          {option}
                        </OptionRow>
                      ))}
                    </div>
                  </div>

                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>06</span>
                    <p style={promptStyle}>
                      Would you pay $199 a month for a tool that ships those changes for
                      you, with a refund if your conversions don&apos;t move within 60 days?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {DISCOVERY_Q6_OPTIONS.map((option) => (
                        <OptionRow
                          key={option}
                          selected={q6 === option}
                          onChange={() => setQ6(option)}
                          type="radio"
                          name="q6"
                          value={option}
                        >
                          {option}
                        </OptionRow>
                      ))}
                    </div>
                  </div>

                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>07</span>
                    <p style={promptStyle}>
                      Would you give us 30 minutes for a call this week?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <OptionRow
                        selected={q7 === 'yes'}
                        onChange={() => setQ7('yes')}
                        type="radio"
                        name="q7"
                        value="yes"
                      >
                        Yes
                      </OptionRow>
                      <OptionRow
                        selected={q7 === 'no'}
                        onChange={() => setQ7('no')}
                        type="radio"
                        name="q7"
                        value="no"
                      >
                        No
                      </OptionRow>
                    </div>
                    {q7 === 'yes' && (
                      <div style={{ marginTop: '16px' }}>
                        <label htmlFor="q7-email" style={labelStyle}>
                          Email — we&apos;ll reach out to schedule
                        </label>
                        <input
                          id="q7-email"
                          type="email"
                          value={q7Email}
                          onChange={(e) => setQ7Email(e.target.value)}
                          className="input-field"
                          style={{ boxSizing: 'border-box' }}
                          placeholder="you@domain.com"
                        />
                      </div>
                    )}
                  </div>

                  <div style={questionBlockStyle}>
                    <span style={numberStyle}>08</span>
                    <p style={promptStyle}>
                      Would you let us run a free audit on your site as a design partner?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <OptionRow
                        selected={q8 === 'yes'}
                        onChange={() => setQ8('yes')}
                        type="radio"
                        name="q8"
                        value="yes"
                      >
                        Yes
                      </OptionRow>
                      <OptionRow
                        selected={q8 === 'no'}
                        onChange={() => setQ8('no')}
                        type="radio"
                        name="q8"
                        value="no"
                      >
                        No
                      </OptionRow>
                    </div>
                    {q8 === 'yes' && (
                      <div style={{ marginTop: '16px' }}>
                        <label htmlFor="q8-url" style={labelStyle}>
                          Site URL
                        </label>
                        <input
                          id="q8-url"
                          type="text"
                          value={q8Url}
                          onChange={(e) => setQ8Url(e.target.value)}
                          className="input-field"
                          style={{ boxSizing: 'border-box' }}
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {status === 'error' && errorMsg && (
                <p
                  style={{
                    fontSize: '14px',
                    color: '#9A1F2A',
                    margin: '0 0 16px',
                    padding: '12px 14px',
                    background: 'rgba(154, 31, 42, 0.06)',
                    border: '1px solid rgba(154, 31, 42, 0.2)',
                    borderRadius: '10px',
                    lineHeight: 1.5,
                  }}
                  role="alert"
                >
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                style={{
                  marginTop: '24px',
                  background: status === 'submitting' ? '#444' : '#0A0A0A',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '18px 36px',
                  borderRadius: '100px',
                  fontSize: '16px',
                  fontWeight: 500,
                  cursor: status === 'submitting' ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                  transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s',
                  opacity: status === 'submitting' ? 0.7 : 1,
                  width: '100%',
                  letterSpacing: '0.01em',
                }}
              >
                {status === 'submitting' ? 'Sending…' : 'Send →'}
              </button>
            </form>
          </>
        )}
      </article>

      <style>{`
        @keyframes discoveryFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          header { padding: 24px 20px !important; }
        }
      `}</style>
    </main>
  );
}
