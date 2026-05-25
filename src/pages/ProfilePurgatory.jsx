import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { listMyPurgatory, restoreBoard, getBoard, hardDeleteBoard } from '../lib/boards';
import { MoveLeft } from 'lucide-react';
import BoardFramework from '../components/BoardFramework';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function ProfilePurgatory() {
  const { user } = useAuth();
  const { setHeader } = useHeader();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Preview modal
  const [previewBoard, setPreviewBoard] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setHeader({ title: 'Czyściec', editable: false, showBack: true, backLabel: <><MoveLeft size={14} /> Profil</>, backTo: '/profile' });
  }, [setHeader]);

  const fetchBoards = async () => {
    try {
      const data = await listMyPurgatory();
      const sorted = (data || []).sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
      setBoards(sorted);
    } catch (err) {
      console.error('Error loading purgatory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) fetchBoards(); }, [user]);

  const handleRestore = async (id) => {
    try {
      await restoreBoard(id);
      setBoards(prev => prev.filter(b => b.id !== id));
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Restore error:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await hardDeleteBoard(deleteConfirm);
      await fetchBoards();
      window.dispatchEvent(new Event('boardsUpdated'));
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

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <Link to="/profile" className={s.breadcrumbLink}>Profil</Link>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Czyściec</span>
      </div>

      <div className={s.filterRow}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {boards.length} {boards.length === 1 ? 'board' : 'boardów'}
        </span>
        {boards.length > 0 && (
          <button
            className={s.btnDanger}
            onClick={() => setDeleteAllConfirm(true)}
          >
            Usuń wszystkie
          </button>
        )}
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
                      <button className={s.btnGhostInfo} onClick={() => handleRestore(board.id)}>
                        Przywróć
                      </button>
                      <button className={s.btnGhostDanger} onClick={() => setDeleteConfirm(board.id)}>
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
                  <button className={s.btnGhostInfo} onClick={() => {
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

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteConfirm}
        title="Usunąć board na zawsze?"
        description="Tej operacji nie można cofnąć."
        cancelLabel="Anuluj"
        confirmLabel="Usuń na zawsze"
        variant="danger"
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
      />

      {/* Delete all confirm */}
      <ConfirmModal
        open={deleteAllConfirm}
        title="Usunąć wszystkie boardy z czyśćca?"
        description="Tej operacji nie można cofnąć."
        cancelLabel="Anuluj"
        confirmLabel="Usuń wszystkie"
        variant="danger"
        onCancel={() => setDeleteAllConfirm(false)}
        onConfirm={async () => {
          try {
            await Promise.all(boards.map(b => hardDeleteBoard(b.id)));
            await fetchBoards();
            window.dispatchEvent(new Event('boardsUpdated'));
          } catch (err) {
            console.error('Delete all error:', err);
          } finally {
            setDeleteAllConfirm(false);
          }
        }}
      />
    </div>
  );
}