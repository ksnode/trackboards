import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useHeader } from '../lib/headerContext';
import { getUserProfile, listUserPurgatory, restoreBoard, hardDeleteBoard, getBoard } from '../lib/boards';
import BoardFramework from '../components/BoardFramework/BoardFramework';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

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
    setHeader({ title: 'Czyściec użytkownika', editable: false, showBack: true, backLabel: '← Użytkownicy', backTo: '/admin/users' });
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

  if (loading) return <div className={s.loading}>Ładowanie...</div>;

  const email = targetUser?.email || 'Nieznany';

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <Link to="/admin" className={s.breadcrumbLink}>Admin</Link>
        <span className={s.breadcrumbSep}>›</span>
        <Link to="/admin/users" className={s.breadcrumbLink}>Użytkownicy</Link>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Czyściec ({email})</span>
      </div>

      {boards.length === 0 ? (
        <div className={s.emptyState}>Brak usuniętych boardów</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={s.table}>
            <thead className={s.tableHead}>
              <tr>
                <th className={s.tableHeadCell}>Nazwa</th>
                <th className={s.tableHeadCell}>Utworzono</th>
                <th className={s.tableHeadCell}>Usunięto</th>
                <th className={s.tableHeadCell}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {boards.map(board => (
                <tr key={board.id} className={s.tableRow}>
                  <td className={s.tableCell}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span className={s.colorDot} style={{ background: board.color || '#888' }} />
                      <span className={s.titleTruncate} title={board.title}>{truncate(board.title)}</span>
                    </span>
                  </td>
                  <td className={`${s.tableCell} ${s.tableCellMono}`}>
                    {new Date(board.created_at).toLocaleDateString('pl-PL', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className={`${s.tableCell} ${s.tableCellMono}`}>
                    {new Date(board.deleted_at).toLocaleString('pl-PL')}
                  </td>
                  <td className={s.tableCellActions}>
                    <div className={s.actionsRow}>
                      <button className={s.btnGhost} onClick={() => openPreview(board.id)}>
                        Podgląd
                      </button>
                      <button className={s.btnPrimary} onClick={() => handleRestore(board.id)}>
                        Przywróć
                      </button>
                      <button className={s.btnDanger} onClick={() => setDeleteConfirm(board.id)}>
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
        <div className={s.previewOverlay} onClick={() => { setPreviewBoard(null); setPreviewLoading(false); }}>
          <div className={s.previewModal} onClick={e => e.stopPropagation()}>
            <div className={s.previewHeader}>
              <span className={s.previewTitle}>
                {previewLoading ? 'Ładowanie...' : previewBoard?.title}
              </span>
              <div className={s.previewActions}>
                {previewBoard && (
                  <button className={s.btnPrimary} onClick={() => {
                    handleRestore(previewBoard.id);
                    setPreviewBoard(null);
                  }}>
                    Przywróć
                  </button>
                )}
                <button className={s.btnGhost} onClick={() => { setPreviewBoard(null); setPreviewLoading(false); }}>
                  Zamknij
                </button>
              </div>
            </div>
            <div className={s.previewBody}>
              {previewLoading ? (
                <div className={s.loading}>Ładowanie boardu...</div>
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