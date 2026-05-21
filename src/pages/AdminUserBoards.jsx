import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import { useHeader } from '../lib/headerContext';
import {
  getUserProfile, listUserBoards, listUsers,
  toggleShareMode, softDeleteBoard, hardDeleteBoard,
  assignOrphanToUser,
} from '../lib/boards';
import { supabase } from '../lib/supabase';
import { Lock, Eye, PenLine, ChevronDown } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

const SHARE_MODES = [
  { value: null, label: 'Private', icon: Lock },
  { value: 'read', label: 'Public', icon: Eye },
  { value: 'write', label: 'Public', icon: PenLine },
];

export default function AdminUserBoards() {
  const { id: userId } = useParams();
  const { setHeader } = useHeader();

  const [targetUser, setTargetUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Share mode (portal)
  const [shareModeOpenId, setShareModeOpenId] = useState(null);
  const [shareModePos, setShareModePos] = useState({ top: 0, left: 0 });
  const [privateConfirm, setPrivateConfirm] = useState(null);
  const shareModeBtnRefs = useRef({});

  // Options dropdown (portal)
  const [optionsOpenId, setOptionsOpenId] = useState(null);
  const [optionsPos, setOptionsPos] = useState({ top: 0, left: 0 });
  const optionsBtnRefs = useRef({});

  // Action modals
  const [orphanConfirm, setOrphanConfirm] = useState(null);
  const [trashConfirm, setTrashConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Assign modal
  const [assignModal, setAssignModal] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignSelected, setAssignSelected] = useState(null);

  // Copy
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    setHeader({ title: 'Boardy użytkownika', editable: false, showBack: true, backLabel: '← Użytkownicy', backTo: '/admin/users' });
  }, [setHeader]);

  const fetchData = async () => {
    try {
      const [profile, userBoards, users] = await Promise.all([
        getUserProfile(userId),
        listUserBoards(userId),
        listUsers(),
      ]);
      setTargetUser(profile);
      const sorted = (userBoards || []).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      setBoards(sorted);
      setAllUsers(users || []);
    } catch (err) {
      console.error('Error loading user boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  // Close share mode
  useEffect(() => {
    if (!shareModeOpenId) return;
    const handler = () => setShareModeOpenId(null);
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [shareModeOpenId]);

  // Close portal options
  useEffect(() => {
    if (!optionsOpenId) return;
    const handler = () => setOptionsOpenId(null);
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [optionsOpenId]);

  const openShareMode = useCallback((boardId) => {
    if (shareModeOpenId === boardId) { setShareModeOpenId(null); return; }
    const btn = shareModeBtnRefs.current[boardId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setShareModePos({ top: rect.bottom + 4, left: rect.left });
    }
    setShareModeOpenId(boardId);
  }, [shareModeOpenId]);

  const openOptions = useCallback((boardId) => {
    if (optionsOpenId === boardId) { setOptionsOpenId(null); return; }
    const btn = optionsBtnRefs.current[boardId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setOptionsPos({ top: rect.bottom + 4, left: rect.right - 200 });
    }
    setOptionsOpenId(boardId);
  }, [optionsOpenId]);

  // Share mode
  const handleShareModeChange = async (board, newMode) => {
    if (board.share_mode && !newMode) {
      setPrivateConfirm({ boardId: board.id, newMode, shareGuid: board.share_guid });
      return;
    }
    await applyShareMode(board.id, newMode, board.share_guid);
  };

  const applyShareMode = async (boardId, newMode, shareGuid) => {
    try {
      await toggleShareMode(boardId, newMode, shareGuid);
      await fetchData();
    } catch (err) {
      console.error('Share mode error:', err);
    }
  };

  const confirmPrivate = async () => {
    if (!privateConfirm) return;
    await applyShareMode(privateConfirm.boardId, privateConfirm.newMode, privateConfirm.shareGuid);
    setPrivateConfirm(null);
  };

  // Make orphan
  const handleMakeOrphan = async () => {
    if (!orphanConfirm) return;
    try {
      const { error } = await supabase.from('boards').update({ owner_id: null }).eq('id', orphanConfirm);
      if (error) throw error;
      setBoards(prev => prev.filter(b => b.id !== orphanConfirm));
    } catch (err) {
      console.error('Make orphan error:', err);
    } finally {
      setOrphanConfirm(null);
    }
  };

  const handleTrash = async () => {
    if (!trashConfirm) return;
    try {
      await softDeleteBoard(trashConfirm, userId);
      setBoards(prev => prev.filter(b => b.id !== trashConfirm));
    } catch (err) {
      console.error('Trash error:', err);
    } finally {
      setTrashConfirm(null);
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

  const handleAssign = async () => {
    if (!assignModal || !assignSelected) return;
    try {
      await assignOrphanToUser(assignModal.boardId, assignSelected.userId);
      setBoards(prev => prev.filter(b => b.id !== assignModal.boardId));
    } catch (err) {
      console.error('Assign error:', err);
    } finally {
      setAssignModal(null);
      setAssignSelected(null);
      setAssignSearch('');
    }
  };

  const handleCopyLink = (board) => {
    if (!board.share_guid) return;
    const url = `${window.location.origin}/board/${board.share_guid}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(board.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const truncate = (str, max = 30) => str && str.length > max ? str.slice(0, max) + '…' : str;

  const filteredUsers = allUsers.filter(u =>
    u.user_id !== userId && u.email.toLowerCase().includes(assignSearch.toLowerCase())
  );

  if (loading) return <div className={s.loading}>Ładowanie...</div>;

  const email = targetUser?.email || 'Nieznany';

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <Link to="/admin" className={s.breadcrumbLink}>Admin</Link>
        <span className={s.breadcrumbSep}>›</span>
        <Link to="/admin/users" className={s.breadcrumbLink}>Użytkownicy</Link>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Boardy ({email})</span>
      </div>

      {boards.length === 0 ? (
        <div className={s.emptyState}>Brak aktywnych boardów</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={s.table}>
            <thead className={s.tableHead}>
              <tr>
                <th className={s.tableHeadCell}>Nazwa</th>
                <th className={s.tableHeadCell}>Utworzono</th>
                <th className={s.tableHeadCell}>Ostatnia aktywność</th>
                <th className={s.tableHeadCell}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {boards.map(board => {
                const curMode = SHARE_MODES.find(m => m.value === board.share_mode) || SHARE_MODES[0];
                const CurIcon = curMode.icon;
                return (
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
                      {new Date(board.updated_at).toLocaleString('pl-PL')}
                    </td>
                    <td className={s.tableCellActions}>
                      <div className={s.actionsRow}>
                        {/* Share mode dropdown (portal) */}
                        <button
                          className={board.share_mode ? s.shareModeTogglePublic : s.shareModeToggle}
                          ref={el => { shareModeBtnRefs.current[board.id] = el; }}
                          onClick={() => openShareMode(board.id)}
                        >
                          <CurIcon size={10} /> {curMode.label}
                          <ChevronDown size={10} className={shareModeOpenId === board.id ? s.chevronOpen : ''} />
                        </button>
                        {shareModeOpenId === board.id && createPortal(
                          <div
                            className={s.optionsDropdownPortal}
                            style={{ top: shareModePos.top, left: shareModePos.left, minWidth: 85 }}
                            onMouseDown={e => e.stopPropagation()}
                          >
                            {SHARE_MODES.map(m => {
                              const isActive = board.share_mode === m.value;
                              const Icon = m.icon;
                              return (
                                <button
                                  key={m.label + (m.value || 'null')}
                                  className={isActive ? s.shareModeMenuItemActive : s.shareModeMenuItem}
                                  onClick={() => { handleShareModeChange(board, m.value); setShareModeOpenId(null); }}
                                >
                                  <Icon size={11} /> {m.label}
                                </button>
                              );
                            })}
                          </div>,
                          document.body
                        )}

                        {/* Options button */}
                        <button
                          className={s.btnGhost}
                          ref={el => { optionsBtnRefs.current[board.id] = el; }}
                          onClick={() => openOptions(board.id)}
                        >
                          Opcje…
                          <ChevronDown size={10} className={optionsOpenId === board.id ? s.chevronOpen : ''} />
                        </button>

                        {/* Options portal dropdown */}
                        {optionsOpenId === board.id && createPortal(
                          <div
                            className={s.optionsDropdownPortal}
                            style={{ top: optionsPos.top, left: optionsPos.left }}
                            onMouseDown={e => e.stopPropagation()}
                          >
                            <Link
                              to={`/board/${board.id}?adminPreview=true`}
                              className={s.optionsItem}
                              onClick={() => setOptionsOpenId(null)}
                            >
                              Otwórz (admin)
                            </Link>
                            <button
                              className={s.optionsItem}
                              onClick={() => {
                                setAssignModal({ boardId: board.id, boardTitle: board.title });
                                setAssignSelected(null);
                                setAssignSearch('');
                                setOptionsOpenId(null);
                              }}
                            >
                              Przepisz do innego usera
                            </button>
                            <button
                              className={s.optionsItem}
                              onClick={() => { setOrphanConfirm(board.id); setOptionsOpenId(null); }}
                            >
                              Przepisz do anonima
                            </button>
                            {board.share_mode && (
                              <button
                                className={s.optionsItem}
                                onClick={() => { handleCopyLink(board); setOptionsOpenId(null); }}
                              >
                                {copiedId === board.id ? '✓ Skopiowano' : 'Skopiuj link'}
                              </button>
                            )}
                            <div className={s.optionsSep} />
                            <button
                              className={s.optionsItemDanger}
                              onClick={() => { setTrashConfirm(board.id); setOptionsOpenId(null); }}
                            >
                              Przenieś do kosza
                            </button>
                            <button
                              className={s.optionsItemDanger}
                              onClick={() => { setDeleteConfirm(board.id); setOptionsOpenId(null); }}
                            >
                              Usuń na zawsze
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Private confirm */}
      <ConfirmModal open={!!privateConfirm} title="Ustawić jako prywatny?"
        description="Osoby które mają link do tego boardu stracą dostęp."
        cancelLabel="Anuluj" confirmLabel="Kontynuuj" variant="primary"
        onCancel={() => setPrivateConfirm(null)} onConfirm={confirmPrivate} />

      {/* Orphan confirm */}
      <ConfirmModal open={!!orphanConfirm} title="Przepisać do anonima?"
        description="Board stanie się bezpański i pojawi się w /admin/anonyms."
        cancelLabel="Anuluj" confirmLabel="Przepisz" variant="primary"
        onCancel={() => setOrphanConfirm(null)} onConfirm={handleMakeOrphan} />

      {/* Trash confirm */}
      <ConfirmModal open={!!trashConfirm} title="Przenieść do kosza?"
        description="Board trafi do czyśćca użytkownika."
        cancelLabel="Anuluj" confirmLabel="Przenieś" variant="danger"
        onCancel={() => setTrashConfirm(null)} onConfirm={handleTrash} />

      {/* Hard delete confirm */}
      <ConfirmModal open={!!deleteConfirm} title="Usunąć board na zawsze?"
        description="Tej operacji nie można cofnąć. Board zostanie trwale usunięty."
        cancelLabel="Anuluj" confirmLabel="Usuń na zawsze" variant="danger"
        onCancel={() => setDeleteConfirm(null)} onConfirm={handleHardDelete} />

      {/* Assign modal */}
      <ConfirmModal
        open={!!assignModal}
        title="Przepisz board do innego usera"
        description={assignModal ? `Board: „${assignModal.boardTitle}"` : ''}
        cancelLabel="Anuluj" confirmLabel="Przepisz" variant="primary"
        disabled={!assignSelected}
        onCancel={() => { setAssignModal(null); setAssignSelected(null); setAssignSearch(''); }}
        onConfirm={handleAssign}
      >
        <input
          type="text" className={s.userPickerSearch} placeholder="Szukaj po emailu…"
          value={assignSearch}
          onChange={(e) => { setAssignSearch(e.target.value); setAssignSelected(null); }}
          autoFocus
          style={{ borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-border-primary)', marginBottom: 'var(--space-2)' }}
        />
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {filteredUsers.length === 0 ? (
            <div className={s.userPickerEmpty}>Brak wyników</div>
          ) : (
            filteredUsers.map(u => (
              <button key={u.user_id} className={s.userPickerItem}
                style={assignSelected?.userId === u.user_id ? { background: 'var(--color-accent)', color: 'white' } : {}}
                onClick={() => setAssignSelected({ userId: u.user_id, email: u.email })}
              >
                {u.email}
              </button>
            ))
          )}
        </div>
        {assignSelected && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-accent)' }}>
            Wybrany: {assignSelected.email}
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}