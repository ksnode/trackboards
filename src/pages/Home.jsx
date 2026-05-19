import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { createBoardAnonymous } from '../lib/boards';
import styles from './Home.module.css';

const RECENT_KEY = 'trackboards_recent';

function getRecentBoards() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw)
      .sort((a, b) => new Date(b.lastVisited) - new Date(a.lastVisited))
      .slice(0, 10);
  } catch { return []; }
}

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const recentBoards = getRecentBoards();

  // Redirect logged-in users only after auth resolves
  if (!loading && user) return <Navigate to="/boards" replace />;

  const handleCreateAnonymous = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const board = await createBoardAnonymous();
      // Save to localStorage for "recently visited"
      const recent = getRecentBoards();
      recent.unshift({ guid: board.share_guid, title: board.title, lastVisited: new Date().toISOString() });
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
      navigate(`/board/${board.share_guid}`);
    } catch (err) {
      console.error('Error creating anonymous board:', err);
      setCreating(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.hero}>
        <h1 className={styles.logo}>Trackboards</h1>
        <p className={styles.tagline}>Śledź swoje cele. Jakkolwiek chcesz.</p>
      </div>

      <div className={styles.cards}>
        <button className={styles.card} onClick={handleCreateAnonymous} disabled={creating}>
          <div className={styles.cardTitle}>
            {creating ? 'Tworzę...' : 'Utwórz board bez logowania'}
          </div>
          <div className={styles.cardDesc}>Publiczny link, bez konta</div>
        </button>

        <button className={styles.cardAccent} onClick={signInWithGoogle}>
          <div className={styles.cardTitle}>Zaloguj się przez Google</div>
          <div className={styles.cardDesc}>Prywatne boardy, pełna kontrola</div>
        </button>
      </div>

      {recentBoards.length > 0 && (
        <div className={styles.recentSection}>
          <h2 className={styles.recentTitle}>Ostatnio odwiedzane</h2>
          <div className={styles.recentList}>
            {recentBoards.map(b => (
              <Link key={b.guid} to={`/board/${b.guid}`} className={styles.recentItem}>
                <span className={styles.recentItemTitle}>{b.title}</span>
                <span className={styles.recentItemDate}>
                  {new Date(b.lastVisited).toLocaleString('pl-PL')}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}