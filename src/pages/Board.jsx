import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  getBoard, updateBoardData, updateBoardMeta, togglePublic, adoptOrphanBoard,
  softDeleteBoard, hardDeleteBoard,
} from '../lib/boards';
import BoardFramework from '../components/BoardFramework/BoardFramework';
import styles from './Board.module.css';

const RECENT_KEY = 'trackboards_recent';

function saveToRecent(guid, title) {
  if (!guid) return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    let recent = raw ? JSON.parse(raw) : [];
    recent = recent.filter(r => r.guid !== guid);
    recent.unshift({ guid, title, lastVisited: new Date().toISOString() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
  } catch {}
}

export default function Board() {
  const { guid } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyTooltip, setCopyTooltip] = useState(false);

  const debounceRef = useRef(null);

  // Fetch board
  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const data = await getBoard(guid);
        if (mounted) {
          setBoard(data);
          setTitleDraft(data.title);
          // Save to localStorage for anon recently visited
          if (!user && data.share_guid) {
            saveToRecent(data.share_guid, data.title);
          }
        }
      } catch (err) {
        if (mounted) setError('Brak dostępu lub board nie istnieje');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, [guid, user]);

  // Permissions
  const isOwner = user && board && board.owner_id === user.id;
  const isOrphan = board && board.owner_id === null && board.share_guid;
  const canEdit = isOwner || isOrphan;
  const canEditStructure = canEdit;
  const canAdopt = user && isOrphan;
  const isPublic = board && board.share_guid !== null;

  // Anon can delete only within 15 min of creation
  const canDeleteOrphan = isOrphan && board.created_at &&
    (Date.now() - new Date(board.created_at).getTime() < 15 * 60 * 1000);
  const canDelete = isOwner || canDeleteOrphan;

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
  const handleTitleBlur = async () => {
    if (!board || titleDraft === board.title) return;
    if (titleDraft.length > 200) return;
    try {
      await updateBoardMeta(board.id, { title: titleDraft });
      setBoard(prev => ({ ...prev, title: titleDraft }));
      // Update localStorage for anon
      if (!user && board.share_guid) {
        saveToRecent(board.share_guid, titleDraft);
      }
    } catch (err) {
      console.error('Title save error:', err);
    }
  };

  // Color change
  const handleColorChange = async (e) => {
    const color = e.target.value;
    try {
      await updateBoardMeta(board.id, { color });
      setBoard(prev => ({ ...prev, color }));
    } catch (err) {
      console.error('Color save error:', err);
    }
  };

  // Toggle public/private
  const handleTogglePublic = async () => {
    try {
      await togglePublic(board.id, !isPublic);
      // Refetch board to get new share_guid
      const updated = await getBoard(board.id);
      setBoard(updated);
    } catch (err) {
      console.error('Toggle public error:', err);
    }
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
      const updated = await getBoard(board.id);
      setBoard(updated);
      setSaveStatus('Board zaadoptowany!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Adopt error:', err);
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      if (isOwner) {
        await softDeleteBoard(board.id);
        navigate('/trackboard');
      } else {
        await hardDeleteBoard(board.id);
        // Remove from localStorage recent
        try {
          const raw = localStorage.getItem(RECENT_KEY);
          if (raw) {
            const recent = JSON.parse(raw).filter(r => r.guid !== board.share_guid);
            localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
          }
        } catch {}
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
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.boardHeader}>
        {canEdit ? (
          <label className={styles.colorPicker} style={{ background: board.color }} title="Zmień kolor">
            <input
              type="color"
              value={board.color}
              onChange={handleColorChange}
              className={styles.colorInput}
            />
          </label>
        ) : (
          <div className={styles.colorDot} style={{ background: board.color }} />
        )}

        {canEdit ? (
          <input
            className={styles.titleEdit}
            value={titleDraft}
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            maxLength={200}
          />
        ) : (
          <span className={styles.titleStatic}>{board.title}</span>
        )}

        <span className={isPublic ? styles.badgePublic : styles.badgePrivate}>
          {isPublic ? 'PUBLIC' : 'PRIVATE'}
        </span>

        {isOwner && (
          <button className={styles.headerBtn} onClick={handleTogglePublic}>
            {isPublic ? '🔒 Ustaw prywatny' : '🔗 Udostępnij'}
          </button>
        )}

        {isPublic && (
          <span className={styles.copyLinkWrapper}>
            <button className={styles.headerBtn} onClick={handleCopyLink}>
              Skopiuj link
            </button>
            {copyTooltip && <span className={styles.copyTooltip}><span className={styles.copyTooltipCheck}>✓</span> Skopiowano!</span>}
          </span>
        )}

        {canAdopt && (
          <button className={styles.adoptBtn} onClick={handleAdopt}>
            Zaadoptuj ten board
          </button>
        )}

        {canDelete && (
          <button className={styles.deleteBtn} onClick={() => setShowDeleteConfirm(true)}>
            Usuń board
          </button>
        )}
      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <p className={styles.modalText}>Usunąć ten board?</p>
            <p className={styles.modalSubtext}>Tej operacji nie można cofnąć.</p>
            <div className={styles.modalActions}>
              <button onClick={() => setShowDeleteConfirm(false)} className={styles.modalCancelBtn}>Anuluj</button>
              <button onClick={handleDelete} className={styles.modalDeleteBtn}>Usuń</button>
            </div>
          </div>
        </div>
      )}

      {/* Board Framework */}
      <BoardFramework
        boardId={board.id}
        data={board.data}
        progress={board.progress}
        onChange={handleBoardChange}
        readOnly={!canEdit}
        canEditStructure={canEditStructure}
        defaultEditMode={canEdit && (!board.data?.modules?.length)}
        saveStatus={saveStatus}
      />
    </div>
  );
}