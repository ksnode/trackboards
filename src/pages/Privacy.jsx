import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { Shield, Database, Trash2, KeyRound } from 'lucide-react';
import privacyStyles from './privacy.module.css';
import sharedStyles from './shared.module.css';

export default function Privacy() {
  const { user } = useAuth();
  const { setHeader } = useHeader();
  const navigate = useNavigate();

  useEffect(() => {
    setHeader({ title: 'Prywatność', editable: false, showBack: false });
  }, [setHeader]);


  return (
    <div className={sharedStyles.root}>
      <div className={privacyStyles.privacyWrapper}>
        <p className={privacyStyles.privacySubtitle}>Jak dbamy o Twoje dane w Trackboards</p>

        <div className={privacyStyles.privacySections}>
          <div className={privacyStyles.privacySection}>
            <div className={privacyStyles.privacySectionIcon}><KeyRound size={20} /></div>
            <div>
              <div className={privacyStyles.privacySectionTitle}>Logowanie</div>
              <p className={privacyStyles.privacySectionText}>
                Logowanie odbywa się wyłącznie przez Google OAuth. Adres email służy jedynie
                do identyfikacji konta. Nigdy nie przechowujemy Twojego hasła — całość autoryzacji
                odbywa się przez Google API.
              </p>
            </div>
          </div>

          <div className={privacyStyles.privacySection}>
            <div className={privacyStyles.privacySectionIcon}><Shield size={20} /></div>
            <div>
              <div className={privacyStyles.privacySectionTitle}>Bezpieczeństwo</div>
              <p className={privacyStyles.privacySectionText}>
                Komunikacja z serwerem jest szyfrowana (HTTPS). Dostęp do danych jest chroniony
                przez Row Level Security — każdy użytkownik widzi tylko swoje boardy, chyba że
                udostępni je publicznie.
              </p>
            </div>
          </div>

          <div className={privacyStyles.privacySection}>
            <div className={privacyStyles.privacySectionIcon}><Database size={20} /></div>
            <div>
              <div className={privacyStyles.privacySectionTitle}>Przechowywane dane</div>
              <p className={privacyStyles.privacySectionText}>
                Przechowujemy wyłącznie: adres email (do identyfikacji konta) oraz treść boardów —
                czyli dane, które sam wpisujesz. Nie zbieramy żadnych dodatkowych danych osobowych.
              </p>
              <p className={privacyStyles.privacySectionText}>
                Dane są przechowywane na serwerach Supabase w Unii Europejskiej (Irlandia).
              </p>
            </div>
          </div>

          <div className={privacyStyles.privacySection}>
            <div className={privacyStyles.privacySectionIcon}><Trash2 size={20} /></div>
            <div>
              <div className={privacyStyles.privacySectionTitle}>Usunięcie danych</div>
              <p className={privacyStyles.privacySectionText}>
                Aby usunąć swoje dane, przejdź do{' '}
                <Link to="/profile/manage" className={sharedStyles.breadcrumbLink} style={{ color: "var(--color-accent)" }}>
                  Profil → Zarządzaj
                </Link>{' '}
                i wybierz opcję „Usuń konto". Wszystkie Twoje dane zostaną trwale usunięte.
              </p>
            </div>
          </div>


        </div>
      </div>
    </div >
  );
}
