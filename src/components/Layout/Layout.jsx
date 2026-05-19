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
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), []);

  return (
    <HeaderProvider>
      <div className={styles.root}>
        {user && (
          <>
            {isMobile && sidebarOpen && (
              <div className={styles.overlay} onClick={closeSidebar} />
            )}
            <Sidebar
              isMobile={isMobile}
              isOpen={sidebarOpen}
              onToggle={toggleSidebar}
              onClose={closeSidebar}
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
