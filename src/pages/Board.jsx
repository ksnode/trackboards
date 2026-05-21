import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import {
  getBoard, updateBoardData, updateBoardMeta, toggleShareMode, adoptOrphanBoard,
  softDeleteBoard, hardDeleteBoard, subscribeToBoard, unsubscribeFromBoard,
} from '../lib/boards';
import { Link as LinkIcon, Pencil, Check, Trash2, Lock, Eye, PenLine, ChevronDown, Shield } from 'lucide-react';
import paStyles from './ProfileAdmin.module.css';
import { subscribeToBoardChanges } from '../lib/realtime';
import BoardFramework from '../components/BoardFramework/BoardFramework';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/Layout/PageContent.module.css';
import styles from './Board.module.css';

const RECENT_KEY = 'trackboards_recent';

function saveToRecent(guid) {
  if (!guid) return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    let recent = raw ? JSON.parse(raw) : [];
    // Normalize: extract guids from old object format
    recent = recent.map(r => typeof r === 'string' ? r : r.guid).filter(Boolean);
    // Deduplicate and move to top
    recent = recent.filter(g => g !== guid);
    recent.unshift(guid);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
  } catch { }
}

const SHARE_MODES = [
  { value: null, label: 'Private', icon: Lock, emoji: '🔒' },
  { value: 'read', label: 'Public view', icon: Eye, emoji: '👁' },
  { value: 'write', label: 'Public edit', icon: PenLine, emoji: '✏️' },
];

export default function Board() {
  const { guid } = useParams();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { setHeader } = useHeader();

  const adminPreview = searchParams.get('adminPreview') === 'true';

  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPrivateConfirm, setShowPrivateConfirm] = useState(false);
  const [showAdoptConfirm, setShowAdoptConfirm] = useState(false);
  const [pendingShareMode, setPendingShareMode] = useState(null);
  const [copyTooltip, setCopyTooltip] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [shareModeOpen, setShareModeOpen] = useState(false);
  const shareModeRef = useRef(null);

  const debounceRef = useRef(null);

  // Close share mode dropdown on outside click
  useEffect(() => {
    if (!shareModeOpen) return;
    const handler = (e) => {
      if (shareModeRef.current && !shareModeRef.current.contains(e.target)) setShareModeOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareModeOpen]);

  // Fetch board
  useEffect(() => {
    let mounted = true;
    setError(null);
    setLoading(true);
    setBoard(null);
    const fetch = async () => {
      try {
        const data = await getBoard(guid);
        if (mounted) {
          // Redirect to share_guid URL if accessed by id and board is public
          // But preserve adminPreview param
          if (data.share_guid && guid !== data.share_guid && !adminPreview) {
            navigate(`/board/${data.share_guid}`, { replace: true });
            return;
          }
          setBoard(data);
          setTitleDraft(data.title);
          // Save to localStorage for anon recently visited
          if (!user && data.share_guid) {
            saveToRecent(data.share_guid);
          }
        }
      } catch (err) {
        if (mounted) {
          setError('Brak dostępu lub board nie istnieje');
          setHeader({
            title: 'Brak dostępu',
            editable: false,
            showBack: true,
            backLabel: user ? '← Wróć do listy' : '← Wróć do głównej',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, [guid, user]);

  // Auto-subscribe: logged-in user visiting a board they don't own
  // Disabled in admin preview mode
  useEffect(() => {
    if (adminPreview) return;
    if (!user || !board) return;
    if (board.owner_id === user.id) return;
    if (board.share_mode) {
      subscribeToBoard(board.id)
        .then(() => window.dispatchEvent(new Event('boardsUpdated')))
        .catch(() => { });
    }
  }, [user, board?.id, board?.owner_id, board?.share_mode, adminPreview]);

  // Realtime: subscribe to board changes
  useEffect(() => {
    if (!board?.id) return;
    const unsub = subscribeToBoardChanges(board.id, (updated) => {
      setBoard(prev => ({ ...prev, ...updated }));
      if (updated.title !== undefined) setTitleDraft(updated.title);
    });
    return unsub;
  }, [board?.id]);

  // Reset editMode when navigating to a different board
  useEffect(() => {
    setEditMode(false);
  }, [guid]);

  // Permissions
  const isAdmin = profile?.role === 'admin';
  const isOwner = user && board && board.owner_id === user.id;
  const isOrphan = board && board.owner_id === null && board.share_guid;

  // Admin preview: full access always
  const canEdit = adminPreview
    ? true
    : (isOwner || (board && board.share_mode === 'write'));
  const canEditStructure = canEdit;
  const canAdopt = user && isOrphan && !adminPreview;

  // Anon can delete only within 15 min of creation
  const canDeleteOrphan = isOrphan && board.created_at &&
    (Date.now() - new Date(board.created_at).getTime() < 15 * 60 * 1000);
  const canDelete = (adminPreview && isAdmin) || isOwner || canDeleteOrphan;

  // Auto-enable edit mode for new empty boards
  useEffect(() => {
    if (board && canEdit && !board.data?.modules?.length) {
      setEditMode(true);
    }
  }, [board?.id]);

  // Debounced save for board data/progress
  const handleBoardChange = useCallback((newData, newProgress) => {
    setBoard(prev => ({ ...prev, data: newData, progress: newProgress }));
    setSaveStatus('Zapisuję...');

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await updateBoardData(board.id, newData, newProgress);
        setSaveStatus('Zapisano');
        setTimeout(() => setSaveStatus(''), 2000);
      } catch (err) {
        console.error('Save error:', err);
        setSaveStatus('Błąd zapisu');
      }
    }, 300);
  }, [board?.id]);

  // Title change
  const handleTitleBlur = useCallback(async () => {
    if (!board || titleDraft === board.title) return;
    if (titleDraft.length > 200) return;
    try {
      await updateBoardMeta(board.id, { title: titleDraft });
      setBoard(prev => ({ ...prev, title: titleDraft }));
      if (!user && board.share_guid) saveToRecent(board.share_guid);
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Title save error:', err);
    }
  }, [board, titleDraft, user]);

  // Set content header for layout
  useEffect(() => {
    if (!board) return;
    setHeader({
      title: board.title,
      titleDraft,
      editable: canEdit,
      onTitleChange: (e) => setTitleDraft(e.target.value),
      onTitleBlur: handleTitleBlur,
      showBack: true,
      backLabel: user ? '← Wróć do listy' : '← Wróć do głównej',
    });
  }, [board?.id, board?.title, titleDraft, canEdit, user, handleTitleBlur, setHeader]);

  // Share mode change
  const handleShareModeChange = async (newMode) => {
    // Going from public to private → confirm
    if (board.share_mode && !newMode) {
      setPendingShareMode(newMode);
      setShowPrivateConfirm(true);
      return;
    }
    await applyShareMode(newMode);
  };

  const applyShareMode = async (newMode) => {
    try {
      await toggleShareMode(board.id, newMode, board.share_guid);
      const updated = await getBoard(board.id);
      setBoard(updated);
      window.dispatchEvent(new Event('boardsUpdated'));
      // Navigate to canonical URL if share_guid changed
      if (updated.share_guid && updated.share_guid !== guid) {
        navigate(`/board/${updated.share_guid}`, { replace: true });
      } else if (!updated.share_guid && isOwner) {
        // Private mode: share_guid removed, redirect owner to real board ID
        navigate(`/board/${updated.id}`, { replace: true });
      }
    } catch (err) {
      console.error('Share mode change error:', err);
    }
  };

  const confirmPrivate = async () => {
    setShowPrivateConfirm(false);
    await applyShareMode(pendingShareMode);
    setPendingShareMode(null);
  };

  // Copy link
  const handleCopyLink = () => {
    if (!board.share_guid) return;
    const url = `${window.location.origin}/board/${board.share_guid}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopyTooltip(true);
      setTimeout(() => setCopyTooltip(false), 2000);
    });
  };

  // Adopt
  const handleAdopt = async () => {
    try {
      await adoptOrphanBoard(board.id);
      // Remove from current user's subscriptions (now it's in MOJE BOARDY)
      try { await unsubscribeFromBoard(board.id); } catch { }
      const updated = await getBoard(board.id);
      setBoard(updated);
      setSaveStatus('Board zaadoptowany!');
      setTimeout(() => setSaveStatus(''), 2000);
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Adopt error:', err);
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      if (isOwner) {
        await softDeleteBoard(board.id, board.owner_id);
        navigate('/boards');
      } else {
        await hardDeleteBoard(board.id);
        // Remove from localStorage recent
        try {
          const raw = localStorage.getItem(RECENT_KEY);
          if (raw) {
            const recent = JSON.parse(raw).filter(r => {
              const g = typeof r === 'string' ? r : r.guid;
              return g !== board.share_guid;
            });
            localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
          }
        } catch { }
        navigate('/');
      }
    } catch (err) {
      console.error('Delete error:', err);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <div className={styles.loading}>Ładowanie...</div>;

  if (error || !board) {
    return (
      <div className={styles.error}>
        <span className={styles.errorText}>{error || 'Nie znaleziono boardu'}</span>
        <button className={styles.backBtn} onClick={() => navigate('/')}>
          Wróć na stronę główną
        </button>
      </div>
    );
  }

  return (
    <div className={`${pageStyles.root} ${styles.root}`}>
      {/* Action buttons — left/right split */}
      <div className={styles.boardHeader}>
        <div className={styles.boardHeaderGroup}>
          {/* Admin mode badge — only in admin preview */}
          {adminPreview && isAdmin && (
            <span className={paStyles.adminBadge}>
              <Shield size={14} />
              Admin mode
            </span>
          )}

          {/* Share mode dropdown — owner or admin preview */}
          {(isOwner || (adminPreview && isAdmin)) ? (
            <div className={styles.shareModeDropdown} ref={shareModeRef}>
              <button
                className={board.share_mode ? styles.shareModeTogglePublic : styles.shareModeToggle}
                onClick={() => setShareModeOpen(o => !o)}
              >
                {(() => { const cur = SHARE_MODES.find(m => m.value === board.share_mode) || SHARE_MODES[0]; const Icon = cur.icon; return <><Icon size={14} /> {cur.label}</>; })()}
                <ChevronDown size={12} className={shareModeOpen ? styles.chevronOpen : ''} />
              </button>
              {shareModeOpen && (
                <div className={styles.shareModeMenu}>
                  {SHARE_MODES.map(m => {
                    const isActive = board.share_mode === m.value;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.label}
                        className={isActive ? styles.shareModeMenuItem_active : styles.shareModeMenuItem}
                        onClick={() => { handleShareModeChange(m.value); setShareModeOpen(false); }}
                      >
                        <Icon size={12} /> {m.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Badge for non-owners */
            board.share_mode && (
              <span className={board.share_mode === 'write' ? styles.badgeWrite : styles.badgeRead}>
                {board.share_mode === 'write' ? <><PenLine size={11} /> Public edit</> : <><Eye size={11} /> Public view</>}
              </span>
            )
          )}

          {board.share_mode && (
            <span className={styles.copyLinkWrapper}>
              <button
                className={styles.headerBtn}
                onClick={handleCopyLink}
                style={{ borderColor: 'var(--color-success, #2e8b57)', color: 'var(--color-success, #2e8b57)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <LinkIcon size={14} /> Skopiuj link
              </button>
              {copyTooltip && <span className={styles.copyTooltip}><span className={styles.copyTooltipCheck}>✓</span> Skopiowano!</span>}
            </span>
          )}
        </div>

        <div className={styles.boardHeaderGroup}>
          {canAdopt && (
            <button className={styles.adoptBtn} onClick={() => setShowAdoptConfirm(true)}>
              Zaadoptuj ten board
            </button>
          )}

          {canEdit && (
            <button
              className={styles.adoptBtn}
              onClick={() => setEditMode(e => !e)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              {editMode ? <Check size={14} /> : <Pencil size={14} />}
              {editMode ? 'Zakończ edycję' : 'Edytuj'}
            </button>
          )}

          {canDelete && (
            <button
              className={styles.deleteBtn}
              onClick={() => setShowDeleteConfirm(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Trash2 size={14} /> Usuń
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm modal */}
      <ConfirmModal
        open={showDeleteConfirm}
        title="Usunąć ten board?"
        description="Tej operacji nie można cofnąć."
        cancelLabel="Anuluj"
        confirmLabel="Usuń"
        variant="danger"
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
      />

      {/* Private confirm modal */}
      <ConfirmModal
        open={showPrivateConfirm}
        title="Ustawić jako prywatny?"
        description="Osoby które mają link do tego boardu stracą dostęp. Kontynuować?"
        cancelLabel="Anuluj"
        confirmLabel="Kontynuuj"
        variant="primary"
        onCancel={() => { setShowPrivateConfirm(false); setPendingShareMode(null); }}
        onConfirm={confirmPrivate}
      />

      {/* Adopt confirm modal */}
      <ConfirmModal
        open={showAdoptConfirm}
        title="Zaadoptować ten board?"
        description="Board zostanie przypisany do Twojego konta. Staniesz się jego właścicielem."
        cancelLabel="Anuluj"
        confirmLabel="Adoptuj"
        variant="primary"
        onCancel={() => setShowAdoptConfirm(false)}
        onConfirm={() => { setShowAdoptConfirm(false); handleAdopt(); }}
      />

      {/* Board Framework */}
      <BoardFramework
        boardId={board.id}
        data={board.data}
        progress={board.progress}
        onChange={handleBoardChange}
        readOnly={!canEdit}
        canEditStructure={canEditStructure}
        editMode={editMode}
        onEditModeChange={setEditMode}
        saveStatus={saveStatus}
        createdAt={board.created_at}
      />
    </div>
  );
}