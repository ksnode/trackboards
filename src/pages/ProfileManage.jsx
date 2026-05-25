import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { ShieldMinus, Bomb, MoveLeft } from 'lucide-react';
import { updateUserStatus, hardDeleteUser } from '../lib/boards';
import ConfirmModal from '../components/ConfirmModal';
import profileStyles from './profile.module.css';
import sharedStyles from './shared.module.css';

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
    <div className={sharedStyles.root}>
      <div className={sharedStyles.breadcrumb}>
        <a href="/profile" className={sharedStyles.breadcrumbLink}>Profil</a>
        <span className={sharedStyles.breadcrumbSep}>›</span>
        <span className={sharedStyles.breadcrumbCurrent}>Zarządzaj</span>
      </div>

      <div className={sharedStyles.navCards}>
        {/* Deactivate */}
        <div className={profileStyles.manageCard}>
          <div className={profileStyles.manageCardTitle}><ShieldMinus size={13} /> Dezaktywuj konto</div>
          <p className={profileStyles.manageCardDesc}>
            Twoje konto zostanie dezaktywowane. Możesz je reaktywować logując się ponownie.
          </p>
          <button className={profileStyles.btnWarning} onClick={() => setDeactivateConfirm(true)}>
            Dezaktywuj
          </button>
        </div>

        {/* Delete */}
        <div className={profileStyles.manageCardDelete}>
          <div className={profileStyles.manageCardTitle}><Bomb size={13} /> Usuń konto</div>
          <p className={profileStyles.manageCardDesc}>
            Tej operacji nie można cofnąć. Twój email zostanie zamaskowany,
            a konto trwale usunięte.
          </p>
          <button className={sharedStyles.btnDanger} onClick={() => setDeleteConfirm(true)}>
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
          className={profileStyles.manageInput}
          placeholder="wpisz: potwierdzam"
          value={deleteInput}
          onChange={e => setDeleteInput(e.target.value)}
          autoFocus
        />
      </ConfirmModal>
    </div>
  );
}
