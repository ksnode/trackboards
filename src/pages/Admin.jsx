import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHeader } from '../lib/headerContext';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function Admin() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: 'Panel admina', editable: false, showBack: false });
  }, [setHeader]);

  return (
    <div className={pageStyles.root}>
      <div className={s.navCards}>
        <Link to="/admin/anonyms" className={s.navCard}>
          <div className={s.navCardTitle}>Anonimowe boardy</div>
          <div className={s.navCardDesc}>Boardy bez właściciela. Przypisz lub usuń.</div>
        </Link>

        <Link to="/admin/users" className={s.navCard}>
          <div className={s.navCardTitle}>Użytkownicy</div>
          <div className={s.navCardDesc}>Zarządzaj kontami, rolami i dostępem.</div>
        </Link>
      </div>
    </div>
  );
}