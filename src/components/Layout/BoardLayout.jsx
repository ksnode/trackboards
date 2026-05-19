import { Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Sidebar } from './Sidebar';
import styles from './Layout.module.css';

export function BoardLayout() {
  const { user } = useAuth();

  // Always render Outlet immediately — never block on auth loading.
  // Sidebar appears only when user is confirmed logged in.
  return (
    <div className={styles.root}>
      {user && <Sidebar />}
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
