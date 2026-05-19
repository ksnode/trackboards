import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { HeaderProvider, useHeader } from '../../lib/headerContext';
import { Sidebar } from './Sidebar';
import styles from './Layout.module.css';

function ContentHeader() {
  const { header } = useHeader();
  const navigate = useNavigate();

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
            <span className={styles.contentHeaderTitle}>{header.title}</span>
          )}
        </div>
        {header.showBack && (
          <button className={styles.contentHeaderBackBtn} onClick={() => navigate('/boards')}>
            ← Wróć do listy
          </button>
        )}
      </div>
    </div>
  );
}

export function Layout() {
  const { user } = useAuth();
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
        {user && (
          <>
            {isMobile && expanded && (
              <div className={styles.overlay} onClick={collapse} />
            )}
            <Sidebar
              expanded={expanded}
              isMobile={isMobile}
              onToggle={toggleExpanded}
              onCollapse={collapse}
            />
          </>
        )}
        <main className={styles.content}>
          <ContentHeader />
          <Outlet />
        </main>
      </div>
    </HeaderProvider>
  );
}
