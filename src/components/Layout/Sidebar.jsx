import { NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEffect, useState } from 'react';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('trackboards_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('trackboards_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Mock data for this stage
  const mockBoards = [
    { id: '1', title: 'Roadmapa 2026' },
    { id: '2', title: 'Frontend nauka' },
  ];

  return (
    <aside className={styles.root}>
      <div className={styles.header}>
        <NavLink to={user ? "/trackboard" : "/"}>Trackboards</NavLink>
      </div>
      
      <div className={styles.boardsList}>
        {user && (
          <>
            <h3>Twoje boardy</h3>
            {mockBoards.map(b => (
              <NavLink 
                key={b.id} 
                to={`/board/${b.id}`} 
                className={({ isActive }) => isActive ? `${styles.boardItem} ${styles.active}` : styles.boardItem}
              >
                {b.title}
              </NavLink>
            ))}
          </>
        )}
      </div>

      <div className={styles.footer}>
        {user ? (
          <div className={styles.userInfo}>
            <span className={styles.email}>{user.email}</span>
            <NavLink to="/profile" className={styles.boardItem} style={{fontSize: 'var(--font-size-sm)', padding: 'var(--space-1) 0'}}>Profil</NavLink>
            <button onClick={signOut} className={styles.logoutBtn}>Wyloguj</button>
          </div>
        ) : (
          <button onClick={signInWithGoogle} className={styles.loginBtn}>Zaloguj się</button>
        )}
        <button onClick={toggleTheme} className={styles.themeBtn}>
          Theme: {theme}
        </button>
      </div>
    </aside>
  );
}
