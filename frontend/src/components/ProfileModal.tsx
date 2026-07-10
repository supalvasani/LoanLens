// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Profile Modal
// Shows user info with a clean logout button
// ──────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types/auth';

const roleLabel: Record<Role, string> = {
  admin:     'Administrator',
  manager:   'Bank Manager',
  analyst:   'Credit Analyst',
  applicant: 'Applicant',
};

const roleBadgeStyle: Record<Role, { bg: string; color: string; border: string }> = {
  admin:     { bg: '#F8F8FF', color: '#3730A3', border: '#C7D2FE' },
  manager:   { bg: '#F0FDF4', color: '#166534', border: '#BBF7D0' },
  analyst:   { bg: '#FFF7ED', color: '#9A3412', border: '#FED7AA' },
  applicant: { bg: '#F8FAFC', color: '#475569', border: '#CBD5E1' },
};

interface ProfileModalProps {
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function ProfileModal({ onClose, anchorRef }: ProfileModalProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const modalRef = useRef<HTMLDivElement>(null);

  const role = (user?.role ?? 'applicant') as Role;
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        !(anchorRef?.current?.contains(e.target as Node))
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleLogout() {
    logout();
    onClose();
    navigate('/login', { replace: true });
  }

  const badge = roleBadgeStyle[role];

  return (
    <>
      {/* Backdrop overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'transparent',
        }}
      />

      {/* Modal panel */}
      <div
        ref={modalRef}
        style={{
          position: 'fixed',
          bottom: 72,
          left: 16,
          width: 280,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'profileSlideUp 0.18s ease forwards',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border-s)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            background: 'var(--bg)',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 'var(--r-md)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--t1)',
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </div>

          {/* Name & role badge */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--t1)',
                letterSpacing: '-0.01em',
                marginBottom: 6,
              }}
            >
              {user?.name ?? '—'}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
                padding: '2px 10px',
                borderRadius: 3,
                background: badge.bg,
                color: badge.color,
                border: `1px solid ${badge.border}`,
              }}
            >
              {roleLabel[role]}
            </span>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ padding: '12px 0' }}>
          <InfoRow
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            }
            label="Email"
            value={user?.email ?? '—'}
          />
          <InfoRow
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            }
            label="Member since"
            value={joinedDate}
          />
          <InfoRow
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            }
            label="Account status"
            value={user?.is_active ? 'Active' : 'Inactive'}
            valueStyle={{ color: user?.is_active ? 'var(--ok)' : 'var(--bad)' }}
          />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-s)', margin: '0 16px' }} />

        {/* Logout */}
        <div style={{ padding: '10px 12px' }}>
          <button
            id="profile-logout-btn"
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              borderRadius: 'var(--r-md)',
              border: '1px solid transparent',
              background: 'transparent',
              color: 'var(--bad)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'background 140ms, border-color 140ms',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--bad-b)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(198,40,40,0.18)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>

      <style>{`
        @keyframes profileSlideUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueStyle,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '7px 20px',
      }}
    >
      <span
        style={{
          color: 'var(--t3)',
          marginTop: 1,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 1 }}>
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--t1)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            ...valueStyle,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}
