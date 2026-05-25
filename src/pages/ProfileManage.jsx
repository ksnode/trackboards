import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { ShieldMinus, Bomb, MoveLeft } from 'lucide-react';
import { updateUserStatus, hardDeleteUser } from '../lib/boards';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function ProfileManage() {
  const { user, profile, signOut } = useAuth();
  const { setHeader } = useHeader();

  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  useEffect(() => {
    setHeader({ title: 'Zarządzaj', editable: false, showBack: true, backLabel: <><MoveLeft size={14} /> Profil</>, backTo: '/profile' });
  }, [setHeader]);

  // Admin cannot delete their account
  if (profile?.role === 'admin') {
    return <Navigate to="/profile" replace />;
  }

  const handleDeactivate = async () => {
    try {
      await updateUserStatus(user.id, 'soft_deleted');
      await signOut();
    } catch (err) {
      console.error('Deactivate error:', err);
    } finally {
      setDeactivateConfirm(false);
    }
  };

  const handleDelete = async () => {
    try {
      await hardDeleteUser(user.id, user.email, true);
      await signOut();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteConfirm(false);
      setDeleteInput('');
    }
  };

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <a href="/profile" className={s.breadcrumbLink}>Profil</a>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Zarządzaj</span>
      </div>

      <div className={s.navCards}>
        {/* Deactivate */}
        <div className={s.manageCard}>
          <div className={s.manageCardTitle}><ShieldMinus size={13} /> Dezaktywuj konto</div>
          <p className={s.manageCardDesc}>
            Twoje konto zostanie dezaktywowane. Możesz je reaktywować logując się ponownie.
          </p>
          <button className={s.btnWarning} onClick={() => setDeactivateConfirm(true)}>
            Dezaktywuj
          </button>
        </div>

        {/* Delete */}
        <div className={s.manageCardDelete}>
          <div className={s.manageCardTitle}><Bomb size={13} /> Usuń konto</div>
          <p className={s.manageCardDesc}>
            Tej operacji nie można cofnąć. Twój email zostanie zamaskowany,
            a konto trwale usunięte.
          </p>
          <button className={s.btnDanger} onClick={() => setDeleteConfirm(true)}>
            Usuń konto
          </button>
        </div>
      </div>

      {/* Deactivate confirm */}
      <ConfirmModal
        open={deactivateConfirm}
        title="Dezaktywować konto?"
        description="Twoje konto zostanie dezaktywowane. Możesz je reaktywować logując się ponownie."
        cancelLabel="Anuluj"
        confirmLabel="Dezaktywuj"
        variant="danger"
        onCancel={() => setDeactivateConfirm(false)}
        onConfirm={handleDeactivate}
      />

      {/* Delete confirm with text input */}
      <ConfirmModal
        open={deleteConfirm}
        title="Usunąć konto na zawsze?"
        description="Wpisz 'potwierdzam' aby usunąć konto. Operacja jest nieodwracalna."
        cancelLabel="Anuluj"
        confirmLabel="Usuń"
        variant="danger"
        disabled={deleteInput !== 'potwierdzam'}
        onCancel={() => { setDeleteConfirm(false); setDeleteInput(''); }}
        onConfirm={handleDelete}
      >
        <input
          type="text"
          className={s.manageInput}
          placeholder="wpisz: potwierdzam"
          value={deleteInput}
          onChange={e => setDeleteInput(e.target.value)}
          autoFocus
        />
      </ConfirmModal>
    </div>
  );
}
