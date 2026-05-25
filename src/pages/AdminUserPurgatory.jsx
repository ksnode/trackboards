import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useHeader } from '../lib/headerContext';
import { getUserProfile, listUserPurgatory, restoreBoard, hardDeleteBoard, getBoard } from '../lib/boards';
import { MoveLeft } from 'lucide-react';
import BoardFramework from '../components/BoardFramework';
import ConfirmModal from '../components/ConfirmModal';
import sharedStyles from './shared.module.css';


export default function AdminUserPurgatory() {
  const { id: userId } = useParams();
  const { setHeader } = useHeader();
  const [targetUser, setTargetUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Preview modal
  const [previewBoard, setPreviewBoard] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setHeader({ title: 'Czyściec użytkownika', editable: false, showBack: true, backLabel: <><MoveLeft size={14} /> Użytkownicy</>, backTo: '/admin/users' });
  }, [setHeader]);

  const fetchData = async () => {
    try {
      const [profile, purgatory] = await Promise.all([
        getUserProfile(userId),
        listUserPurgatory(userId),
      ]);
      setTargetUser(profile);
      const sorted = (purgatory || []).sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
      setBoards(sorted);
    } catch (err) {
      console.error('Error loading user purgatory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const handleRestore = async (id) => {
    try {
      await restoreBoard(id);
      setBoards(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      console.error('Restore error:', err);
    }
  };

  const handleHardDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await hardDeleteBoard(deleteConfirm);
      setBoards(prev => prev.filter(b => b.id !== deleteConfirm));
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const openPreview = async (boardId) => {
    setPreviewLoading(true);
    try {
      const data = await getBoard(boardId);
      setPreviewBoard(data);
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const truncate = (str, max = 30) => str && str.length > max ? str.slice(0, max) + '…' : str;

  if (loading) return <div className={sharedStyles.loading}>Ładowanie...</div>;

  const email = targetUser?.email || 'Nieznany';

  return (
    <div className={sharedStyles.root}>
      <div className={sharedStyles.breadcrumb}>
        <Link to="/admin" className={sharedStyles.breadcrumbLink}>Admin</Link>
        <span className={sharedStyles.breadcrumbSep}>›</span>
        <Link to="/admin/users" className={sharedStyles.breadcrumbLink}>Użytkownicy</Link>
        <span className={sharedStyles.breadcrumbSep}>›</span>
        <span className={sharedStyles.breadcrumbCurrent}>Czyściec ({email})</span>
      </div>

      {boards.length === 0 ? (
        <div className={sharedStyles.emptyState}>Brak usuniętych boardów</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={sharedStyles.table}>
            <thead className={sharedStyles.tableHead}>
              <tr>
                <th className={sharedStyles.tableHeadCell}>Nazwa</th>
                <th className={sharedStyles.tableHeadCell}>Utworzono</th>
                <th className={sharedStyles.tableHeadCell}>Usunięto</th>
                <th className={sharedStyles.tableHeadCell}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {boards.map(board => (
                <tr key={board.id} className={sharedStyles.tableRow}>
                  <td className={sharedStyles.tableCell}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className={sharedStyles.colorDot} style={{ background: board.color || '#888' }} />
                      <span className={sharedStyles.titleTruncate} title={board.title}>{truncate(board.title)}</span>
                    </span>
                  </td>
                  <td className={`${sharedStyles.tableCell} ${sharedStyles.tableCellMono}`}>
                    {new Date(board.created_at).toLocaleDateString('pl-PL', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className={`${sharedStyles.tableCell} ${sharedStyles.tableCellMono}`}>
                    {new Date(board.deleted_at).toLocaleString('pl-PL')}
                  </td>
                  <td className={sharedStyles.tableCellActions}>
                    <div className={sharedStyles.actionsRow}>
                      <button className={sharedStyles.btnGhost} onClick={() => openPreview(board.id)}>
                        Podgląd
                      </button>
                      <button className={sharedStyles.btnGhostInfo} onClick={() => handleRestore(board.id)}>
                        Przywróć
                      </button>
                      <button className={sharedStyles.btnGhostDanger} onClick={() => setDeleteConfirm(board.id)}>
                        Usuń na zawsze
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteConfirm}
        title="Usunąć board na zawsze?"
        description="Tej operacji nie można cofnąć. Board zostanie trwale usunięty."
        cancelLabel="Anuluj"
        confirmLabel="Usuń na zawsze"
        variant="danger"
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={handleHardDelete}
      />

      {/* Preview modal */}
      {(previewBoard || previewLoading) && (
        <div className={sharedStyles.previewOverlay} onClick={() => { setPreviewBoard(null); setPreviewLoading(false); }}>
          <div className={sharedStyles.previewModal} onClick={e => e.stopPropagation()}>
            <div className={sharedStyles.previewHeader}>
              <span className={sharedStyles.previewTitle}>
                {previewLoading ? 'Ładowanie...' : previewBoard?.title}
              </span>
              <div className={sharedStyles.previewActions}>
                {previewBoard && (
                  <button className={sharedStyles.btnGhostInfo} onClick={() => {
                    handleRestore(previewBoard.id);
                    setPreviewBoard(null);
                  }}>
                    Przywróć
                  </button>
                )}
                <button className={sharedStyles.btnGhost} onClick={() => { setPreviewBoard(null); setPreviewLoading(false); }}>
                  Zamknij
                </button>
              </div>
            </div>
            <div className={sharedStyles.previewBody}>
              {previewLoading ? (
                <div className={sharedStyles.loading}>Ładowanie boardu...</div>
              ) : previewBoard ? (
                <BoardFramework
                  boardId={previewBoard.id}
                  data={previewBoard.data}
                  progress={previewBoard.progress}
                  onChange={() => { }}
                  readOnly={true}
                  canEditStructure={false}
                  editMode={false}
                  onEditModeChange={() => { }}
                  saveStatus=""
                  createdAt={previewBoard.created_at}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}