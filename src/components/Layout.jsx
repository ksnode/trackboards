import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { HeaderProvider, useHeader } from '../lib/headerContext';
import { Sidebar } from './Sidebar';
import ConfirmModal from './ConfirmModal';
import { MoveLeft } from 'lucide-react';
import styles from './Layout.module.css';

function ContentHeader() {
  const { header } = useHeader();
  const navigate = useNavigate();
  const location = useLocation();

  // Route-based fallback title
  const fallbackTitle = (() => {
    const p = location.pathname;
    if (p === '/' || p === '/boards') return 'Lista boardów';
    if (p.startsWith('/admin')) return 'Admin';
    if (p.startsWith('/profile')) return 'Profil';
    return '';
  })();

  const displayTitle = header.title || fallbackTitle;

  return (
    <div className={styles.contentHeader}>
      <div className={styles.contentHeaderInner}>
        <div className={styles.contentHeaderLeft}>
          {header.editable ? (
            <input
              className={styles.contentHeaderInput}
              value={header.titleDraft}
              onChange={header.onTitleChange}
              onBlur={header.onTitleBlur}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              maxLength={200}
            />
          ) : (
            <span className={styles.contentHeaderTitle}>{displayTitle}</span>
          )}
        </div>
        {header.showBack && (
          <button className={styles.contentHeaderBackBtn} onClick={() => navigate(header.backTo || '/boards')}>
            {header.backLabel || <><MoveLeft size={14} /> Wróć do listy</>}
          </button>
        )}
      </div>
    </div>
  );
}

export function Layout() {
  const { user, showReactivateModal, reactivateAccount, cancelReactivation } = useAuth();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expanded, setExpanded] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Auto-expand on desktop, auto-collapse on mobile
      setExpanded(!mobile);
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Collapse sidebar on route change when mobile
  useEffect(() => {
    if (isMobile) setExpanded(false);
  }, [location.pathname]);

  const toggleExpanded = useCallback(() => setExpanded(e => !e), []);
  const collapse = useCallback(() => setExpanded(false), []);

  return (
    <HeaderProvider>
      <div className={styles.root}>
        {isMobile && (
          <div
            className={styles.overlay}
            onClick={expanded ? collapse : undefined}
            style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? 'auto' : 'none' }}
          />
        )}
        <div style={{ width: isMobile ? (expanded ? 48 : 48) + 'px' : undefined, flexShrink: 0, transition: 'width 0.25s ease' }}>
          <Sidebar
            expanded={expanded}
            isMobile={isMobile}
            onToggle={toggleExpanded}
            onCollapse={collapse}
          />
        </div>
        <main className={styles.content}>
          <ContentHeader />
          <Outlet />
        </main>
      </div>
      <ConfirmModal
        open={showReactivateModal}
        title="Twoje konto jest dezaktywowane"
        description="Czy chcesz reaktywować swoje konto i przywrócić wszystkie boardy?"
        cancelLabel="Anuluj"
        confirmLabel="Reaktywuj"
        variant="primary"
        onCancel={cancelReactivation}
        onConfirm={reactivateAccount}
      />
    </HeaderProvider>
  );
}
