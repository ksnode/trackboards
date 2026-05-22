import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { Shield, Database, Server, Trash2, KeyRound } from 'lucide-react';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function Privacy() {
  const { user } = useAuth();
  const { setHeader } = useHeader();
  const navigate = useNavigate();

  useEffect(() => {
    setHeader({ title: 'Prywatność', editable: false, showBack: false });
  }, [setHeader]);

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <Link to="/boards" className={s.breadcrumbLink}>Trackboards</Link>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Prywatność</span>
      </div>

      <div className={s.privacySections}>
        <div className={s.privacySection}>
          <div className={s.privacySectionIcon}><KeyRound size={20} /></div>
          <div>
            <div className={s.privacySectionTitle}>Logowanie</div>
            <p className={s.privacySectionText}>
              Logowanie odbywa się wyłącznie przez Google OAuth. Adres email służy jedynie
              do identyfikacji konta. Nigdy nie przechowujemy Twojego hasła — całość autoryzacji
              odbywa się przez Google API.
            </p>
          </div>
        </div>

        <div className={s.privacySection}>
          <div className={s.privacySectionIcon}><Database size={20} /></div>
          <div>
            <div className={s.privacySectionTitle}>Przechowywane dane</div>
            <p className={s.privacySectionText}>
              Przechowujemy wyłącznie: adres email (do identyfikacji konta) oraz treść boardów —
              czyli dane, które sam wpisujesz. Nie zbieramy żadnych dodatkowych danych osobowych.
            </p>
          </div>
        </div>

        <div className={s.privacySection}>
          <div className={s.privacySectionIcon}><Server size={20} /></div>
          <div>
            <div className={s.privacySectionTitle}>Serwery</div>
            <p className={s.privacySectionText}>
              Dane są przechowywane na serwerach Supabase w Unii Europejskiej (Irlandia).
            </p>
          </div>
        </div>

        <div className={s.privacySection}>
          <div className={s.privacySectionIcon}><Trash2 size={20} /></div>
          <div>
            <div className={s.privacySectionTitle}>Usunięcie danych</div>
            <p className={s.privacySectionText}>
              Aby usunąć swoje dane, przejdź do{' '}
              <Link to="/profile/manage" className={s.breadcrumbLink}>
                Profil → Zarządzaj
              </Link>{' '}
              i wybierz opcję „Usuń konto". Wszystkie Twoje dane zostaną trwale usunięte.
            </p>
          </div>
        </div>

        <div className={s.privacySection}>
          <div className={s.privacySectionIcon}><Shield size={20} /></div>
          <div>
            <div className={s.privacySectionTitle}>Bezpieczeństwo</div>
            <p className={s.privacySectionText}>
              Komunikacja z serwerem jest szyfrowana (HTTPS). Dostęp do danych jest chroniony
              przez Row Level Security — każdy użytkownik widzi tylko swoje boardy, chyba że
              udostępni je publicznie.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
