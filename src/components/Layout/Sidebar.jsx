import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEffect, useState, useCallback } from 'react';
import { listMyBoards } from '../../lib/boards';
import styles from './Sidebar.module.css';

function resolveTheme(pref) {
  if (pref === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function Sidebar() {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const [themePref, setThemePref] = useState(localStorage.getItem('trackboards_theme') || 'auto');
  const [boards, setBoards] = useState([]);

  const applyTheme = useCallback((pref) => {
    document.documentElement.setAttribute('data-theme', resolveTheme(pref));
  }, []);

  useEffect(() => {
    localStorage.setItem('trackboards_theme', themePref);
    applyTheme(themePref);
  }, [themePref, applyTheme]);

  // Listen for OS theme changes when in auto mode
  useEffect(() => {
    if (themePref !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themePref, applyTheme]);

  useEffect(() => {
    if (!user) return;
    listMyBoards()
      .then(data => setBoards(data || []))
      .catch(() => {});
  }, [user]);

  return (
    <aside className={styles.root}>
      <div className={styles.header}>
        <NavLink to={user ? "/trackboard" : "/"}>Trackboards</NavLink>
      </div>
      
      <div className={styles.boardsList}>
        {user && (
          <>
            <h3>Twoje boardy</h3>
            {boards.map(b => (
              <NavLink 
                key={b.id} 
                to={`/board/${b.id}`} 
                className={({ isActive }) => isActive ? `${styles.boardItem} ${styles.active}` : styles.boardItem}
              >
                <span className={styles.boardDot} style={{ background: b.color }} />
                {b.title}
              </NavLink>
            ))}
          </>
        )}
        {user && profile?.role === 'admin' && (
          <>
            <h3 style={{ marginTop: 'var(--space-4)' }}>Admin</h3>
            <NavLink to="/admin" className={({ isActive }) => isActive ? `${styles.boardItem} ${styles.active}` : styles.boardItem}>
              Panel admina
            </NavLink>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {user ? (
          <div className={styles.userInfo}>
            <span className={styles.email}>{user.email}</span>
            <NavLink to="/profile" className={styles.profileLink}>Profil</NavLink>
            <button onClick={signOut} className={styles.logoutBtn}>Wyloguj</button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} className={styles.loginBtn}>Zaloguj się</button>
        )}
        <div className={styles.segmentedGroup}>
          {[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Jasny' },
            { value: 'dark', label: 'Ciemny' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setThemePref(opt.value)}
              className={themePref === opt.value ? styles.segmentActive : styles.segment}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
