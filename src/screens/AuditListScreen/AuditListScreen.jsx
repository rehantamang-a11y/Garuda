/**
 * AuditListScreen.jsx
 *
 * The technician's audit dashboard. Shown after login and after submission.
 *
 * Responsibilities:
 *  - List all audits for the current technician (from localStorage)
 *  - Split into "In Progress" (draft) and "Submitted" sections
 *  - "New Audit" button → starts a fresh audit
 *  - Tap a draft card → resumes the audit
 *  - Logout button → clears session, returns to LoginScreen
 */

import { useState } from 'react';
import { useAuth }  from '../../context/AuthContext';
import { useAudit } from '../../context/AuditContext';
import { getAudits, deleteAudit } from '../../services/storageService';
import { submitToSheets } from '../../services/sheetsService';
import { AREAS }          from '../../data/areas';
import './AuditListScreen.css';

const BATHROOM_LABELS = {
  main: 'Main Bathroom', ensuite: 'En-suite', wetroom: 'Wet Room', other: 'Other',
};

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function photoCount(areaPhotos) {
  return Object.values(areaPhotos || {}).reduce((s, ps) => s + ps.length, 0);
}

function areaCount(areaPhotos) {
  return Object.values(areaPhotos || {}).filter(ps => ps.length > 0).length;
}

export default function AuditListScreen({ onNewAudit, onResumeAudit, onLogout }) {
  const { user, logout } = useAuth();
  const { startNewAudit, loadAudit } = useAudit();

  const [audits, setAudits] = useState(() =>
    getAudits().filter(a => a.technicianName === user.name)
  );
  const [resubmittingId, setResubmittingId] = useState(null);
  const [resubmitError, setResubmitError] = useState('');

  const drafts    = audits.filter(a => a.status === 'draft');
  const submitted = audits.filter(a => a.status === 'submitted');

  const handleNewAudit = () => {
    startNewAudit(user.name);
    onNewAudit();
  };

  const handleResume = (audit) => {
    loadAudit(audit);
    onResumeAudit();
  };

  const handleResubmit = async (audit, e) => {
    e.stopPropagation();
    setResubmittingId(audit.id);
    setResubmitError('');

    const totalPhotos      = photoCount(audit.areaPhotos);
    const totalAnnotations = Object.values(audit.areaPhotos || {})
      .flat()
      .reduce((s, p) => s + (p.annotations?.length ?? 0), 0);
    const areas            = AREAS.filter(a => (audit.areaPhotos[a.id]?.length ?? 0) > 0);
    const areasSummary     = areas.map(a => a.label).join(', ');
    const commentsSummary  = areas
      .flatMap(a => (audit.areaPhotos[a.id] || []).map(p => p.comment).filter(Boolean))
      .join(' | ');

    try {
      await submitToSheets(audit, { totalPhotos, totalAnnotations, areasSummary, commentsSummary });
    } catch (err) {
      console.warn('Resubmit to Sheets failed:', err);
      setResubmitError(err.message || 'Resubmit failed. Check Drive upload configuration and try again.');
    }

    setResubmittingId(null);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    deleteAudit(id);
    setAudits(prev => prev.filter(a => a.id !== id));
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <div className="audit-list-screen">

      {/* ── Header ── */}
      <header className="audit-list-header">
        <span className="audit-list-logo">EyEagle</span>
        <div className="audit-list-user">
          <span className="audit-list-username">{user.name}</span>
          <button className="btn-logout" onClick={handleLogout}>Log out</button>
        </div>
      </header>

      {/* ── New audit CTA ── */}
      <div className="audit-list-cta">
        <button className="btn-new-audit" onClick={handleNewAudit}>
          + New Audit
        </button>
      </div>

      {/* ── Empty state ── */}
      {audits.length === 0 && (
        <div className="audit-list-empty">
          <p className="audit-list-empty-text">No audits yet. Tap New Audit to get started.</p>
        </div>
      )}

      {/* ── In Progress ── */}
      {drafts.length > 0 && (
        <section className="audit-section">
          <h2 className="audit-section-title">In Progress</h2>
          {drafts.map(audit => (
            <button
              key={audit.id}
              className="audit-card audit-card--draft"
              onClick={() => handleResume(audit)}
            >
              <div className="audit-card-main">
                <div className="audit-card-top">
                  <span className="audit-card-client">
                    {audit.clientName || 'Unnamed Audit'}
                  </span>
                  <span className="audit-badge audit-badge--draft">Draft</span>
                </div>
                <span className="audit-card-meta">
                  {BATHROOM_LABELS[audit.bathroomType]} · {formatDate(audit.createdAt)}
                </span>
                <span className="audit-card-counts">
                  {areaCount(audit.areaPhotos)} area{areaCount(audit.areaPhotos) !== 1 ? 's' : ''} · {photoCount(audit.areaPhotos)} photo{photoCount(audit.areaPhotos) !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="btn-delete-audit"
                onClick={(e) => handleDelete(audit.id, e)}
                aria-label="Delete audit"
              >
                ✕
              </button>
            </button>
          ))}
        </section>
      )}

      {/* ── Submitted ── */}
      {submitted.length > 0 && (
        <section className="audit-section">
          <h2 className="audit-section-title">Submitted</h2>
          {resubmitError && (
            <p className="audit-list-error" role="alert">{resubmitError}</p>
          )}
          {submitted.map(audit => (
            <div key={audit.id} className="audit-card audit-card--submitted">
              <div className="audit-card-main">
                <div className="audit-card-top">
                  <span className="audit-card-client">
                    {audit.clientName || 'Unnamed Audit'}
                  </span>
                  <span className="audit-badge audit-badge--submitted">Submitted</span>
                </div>
                <span className="audit-card-meta">
                  {BATHROOM_LABELS[audit.bathroomType]} · {formatDate(audit.submittedAt || audit.createdAt)}
                </span>
                <span className="audit-card-counts">
                  {areaCount(audit.areaPhotos)} area{areaCount(audit.areaPhotos) !== 1 ? 's' : ''} · {photoCount(audit.areaPhotos)} photo{photoCount(audit.areaPhotos) !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="btn-resubmit-audit"
                onClick={(e) => handleResubmit(audit, e)}
                disabled={resubmittingId === audit.id}
                aria-label="Resubmit audit"
              >
                {resubmittingId === audit.id ? '…' : '↺'}
              </button>
              <button
                className="btn-delete-audit"
                onClick={(e) => handleDelete(audit.id, e)}
                aria-label="Delete audit"
              >
                ✕
              </button>
            </div>
          ))}
        </section>
      )}

    </div>
  );
}
