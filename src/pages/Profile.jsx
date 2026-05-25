import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { BrushCleaning, Settings } from 'lucide-react';
import profileStyles from './profile.module.css';
import sharedStyles from './shared.module.css';

export default function Profile() {
  const { profile } = useAuth();
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: 'Profil', editable: false, showBack: false });
  }, [setHeader]);

  if (!profile) return <div className={sharedStyles.loading}>Ładowanie...</div>;

  const initial = (profile.email || '?')[0].toUpperCase();
  const isAdmin = profile.role === 'admin';

  return (
    <div className={sharedStyles.root}>
      {/* Account section */}
      <div className={profileStyles.accountSection}>
        <div className={profileStyles.avatar}>{initial}</div>
        <div className={profileStyles.accountDetails}>
          <span className={profileStyles.accountEmail}>{profile.email}</span>
          <div className={profileStyles.accountMeta}>
            <span>
              Zarejestrowano{' '}
              {new Date(profile.created_at).toLocaleDateString('pl-PL', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className={`${profileStyles.roleBadge} ${isAdmin ? profileStyles.roleBadgeAdmin : ''}`}>
              {profile.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation cards */}
      <div className={sharedStyles.navCards}>
        <Link to="/profile/purgatory" className={sharedStyles.navCard}>
          <div className={sharedStyles.navCardTitle}><BrushCleaning size={12} /> Czyściec</div>
          <div className={sharedStyles.navCardDesc}>Twoje usunięte boardy. Możesz je przywrócić.</div>
        </Link>

        {!isAdmin && (
          <Link to="/profile/manage" className={sharedStyles.navCardDanger}>
            <div className={sharedStyles.navCardTitle}><Settings size={12} /> Zarządzaj</div>
            <div className={sharedStyles.navCardDesc}>Dezaktywuj lub usuń swoje konto.</div>
          </Link>
        )}
      </div>
    </div>
  );
}