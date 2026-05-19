import { Outlet, useNavigate } from 'react-router-dom';
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

  return (
    <HeaderProvider>
      <div className={styles.root}>
        {user && <Sidebar />}
        <main className={styles.content}>
          <ContentHeader />
          <Outlet />
        </main>
      </div>
    </HeaderProvider>
  );
}
