import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function Profile() {
  const { profile } = useAuth();
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: 'Profil', editable: false, showBack: false });
  }, [setHeader]);

  if (!profile) return <div className={s.loading}>Ładowanie...</div>;

  const initial = (profile.email || '?')[0].toUpperCase();
  const isAdmin = profile.role === 'admin';

  return (
    <div className={pageStyles.root}>
      {/* Account section */}
      <div className={s.accountSection}>
        <div className={s.avatar}>{initial}</div>
        <div className={s.accountDetails}>
          <span className={s.accountEmail}>{profile.email}</span>
          <div className={s.accountMeta}>
            <span>
              Zarejestrowano{' '}
              {new Date(profile.created_at).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className={`${s.roleBadge} ${isAdmin ? s.roleBadgeAdmin : ''}`}>
              {profile.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation cards */}
      <div className={s.navCards}>
        <Link to="/profile/purgatory" className={s.navCard}>
          <div className={s.navCardTitle}>Czyściec</div>
          <div className={s.navCardDesc}>Twoje usunięte boardy. Możesz je przywrócić.</div>
        </Link>

        {!isAdmin && (
          <Link to="/profile/manage" className={s.navCardDanger}>
            <div className={s.navCardTitle}>Zarządzaj</div>
            <div className={s.navCardDesc}>Dezaktywuj lub usuń swoje konto.</div>
          </Link>
        )}
      </div>
    </div>
  );
}