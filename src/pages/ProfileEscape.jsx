import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function ProfileEscape() {
  const { profile } = useAuth();
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: 'Wyjście', editable: false, showBack: true, backLabel: '← Profil', backTo: '/profile' });
  }, [setHeader]);

  // Admin cannot delete their account
  if (profile?.role === 'admin') {
    return <Navigate to="/profile" replace />;
  }

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <a href="/profile" className={s.breadcrumbLink}>Profil</a>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Wyjście</span>
      </div>

      <div className={s.escapeWarning}>
        <div className={s.escapeWarningTitle}>Usuń konto</div>
        <p className={s.escapeWarningText}>
          Tej operacji nie można cofnąć. Wszystkie Twoje boardy, dane i historia
          zostaną trwale usunięte.
        </p>
        <input
          type="text"
          className={s.escapeInput}
          placeholder='wpisz: potwierdzam'
          disabled
        />
        <br />
        <span className={s.tooltipWrapper}>
          <button className={s.btnDisabled} disabled>
            Usuń konto
          </button>
          <span className={s.tooltipText}>Wkrótce</span>
        </span>
      </div>
    </div>
  );
}