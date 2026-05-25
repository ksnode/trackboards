import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHeader } from '../lib/headerContext';
import { Ghost, Users } from 'lucide-react';
import sharedStyles from './shared.module.css';

export default function Admin() {
  const { setHeader } = useHeader();

  useEffect(() => {
    setHeader({ title: 'Panel admina', editable: false, showBack: false });
  }, [setHeader]);

  return (
    <div className={sharedStyles.root}>
      <div className={sharedStyles.navCards}>
        <Link to="/admin/anonyms" className={sharedStyles.navCard}>
          <div className={sharedStyles.navCardTitle}><Ghost size={13} /> Anonimowe boardy</div>
          <div className={sharedStyles.navCardDesc}>Boardy bez właściciela. Przypisz lub usuń.</div>
        </Link>

        <Link to="/admin/users" className={sharedStyles.navCard}>
          <div className={sharedStyles.navCardTitle}><Users size={13} /> Użytkownicy</div>
          <div className={sharedStyles.navCardDesc}>Zarządzaj kontami, rolami i dostępem.</div>
        </Link>
      </div>
    </div>
  );
}