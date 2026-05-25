import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listMyBoards, listSubscribedBoards, updateBoardMeta, toggleShareMode, getBoard } from '../lib/boards';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import { Lock, Eye, PenLine, ChevronDown, Globe, Ghost } from 'lucide-react';
import { createBoardAnonymous } from '../lib/boards';
import { subscribeToBoardList } from '../lib/realtime';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import sharedStyles from './shared.module.css';
import styles from './Boards.module.css';

const RECENT_KEY = 'trackboards_recent';

function getRecentGuids() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    const guids = items.map(item => typeof item === 'string' ? item : item.guid).filter(Boolean);
    return [...new Set(guids)].slice(0, 10);
  } catch { return []; }
}

const SHARE_MODES = [
  { value: null, label: 'Private', icon: Lock },
  { value: 'read', label: 'Public', icon: Eye },
  { value: 'write', label: 'Public', icon: PenLine },
];

function calcBoardPct(board) {
  const states = board.progress?.states || {};
  const modules = board.data?.modules || [];
  let totalH = 0, doneH = 0;
  const process = (node) => {
    if (!node.children?.length) {
      const st = states[node.id] || 'todo';
      if (st === 'skip') return;
      totalH += node.hours || 0;
      if (st === 'done') doneH += node.hours || 0;
    } else {
      node.children.forEach(process);
    }
  };
  modules.forEach(m => { if (m.tag !== 'placeholder') m.tree.forEach(process); });
  if (totalH === 0) {
    let hasLeaves = false;
    const checkLeaf = (n) => { if (!n.children?.length) hasLeaves = true; else n.children.forEach(checkLeaf); };
    modules.forEach(m => { if (m.tag !== 'placeholder') m.tree.forEach(checkLeaf); });
    return hasLeaves ? 100 : 0;
  }
  return Math.round((doneH / totalH) * 100);
}

export default function Boards() {
  const { user, signInWithGoogle } = useAuth();
  const { setHeader } = useHeader();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [extBoards, setExtBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [privateConfirm, setPrivateConfirm] = useState(null);
  const [shareModeOpenId, setShareModeOpenId] = useState(null);
  const [recentBoards, setRecentBoards] = useState([]);
  const shareModeRef = useRef(null);

  // Close share mode dropdown on outside click
  useEffect(() => {
    if (!shareModeOpenId) return;
    const handler = (e) => {
      if (shareModeRef.current && !shareModeRef.current.contains(e.target)) setShareModeOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [shareModeOpenId]);

  // Set content header
  useEffect(() => {
    setHeader({
      title: user ? 'Lista boardów' : '.',
      editable: false,
      showBack: false,
    });
  }, [setHeader, user]);

  const fetchBoards = async () => {
    if (!user) { setLoading(false); return; }
    try {
      const [own, ext] = await Promise.all([
        listMyBoards(),
        listSubscribedBoards(),
      ]);
      setBoards(own || []);
      setExtBoards(ext || []);
    } catch (err) {
      console.error('Error loading boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoards(); }, [user]);

  useEffect(() => {
    window.addEventListener('boardsUpdated', fetchBoards);
    return () => window.removeEventListener('boardsUpdated', fetchBoards);
  }, [user]);

  // Realtime: subscribe to board list changes
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToBoardList(() => fetchBoards());
    return unsub;
  }, [user]);

  // Fetch recent boards from DB for anon welcome screen
  const fetchRecentBoards = useCallback(async () => {
    if (user) return;
    const guids = getRecentGuids();
    if (guids.length === 0) { setRecentBoards([]); return; }
    const results = await Promise.all(
      guids.map(async (guid) => {
        try {
          const board = await getBoard(guid);
          return board ? { guid, title: board.title, created_at: board.created_at } : null;
        } catch { return null; }
      })
    );
    setRecentBoards(results.filter(Boolean));
  }, [user]);

  useEffect(() => { fetchRecentBoards(); }, [fetchRecentBoards]);

  // Color change from card dot
  const handleColorChange = async (boardId, newColor) => {
    try {
      await updateBoardMeta(boardId, { color: newColor });
      setBoards(prev => prev.map(b => b.id === boardId ? { ...b, color: newColor } : b));
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Color change error:', err);
    }
  };

  // Share mode change from card dropdown
  const handleShareModeChange = async (e, board, newMode) => {
    e.preventDefault();
    e.stopPropagation();
    // Going from public to private → confirm
    if (board.share_mode && !newMode) {
      setPrivateConfirm({ boardId: board.id, newMode, shareGuid: board.share_guid });
      return;
    }
    await applyShareMode(board.id, newMode, board.share_guid);
  };


  const applyShareMode = async (boardId, newMode, shareGuid) => {
    try {
      await toggleShareMode(boardId, newMode, shareGuid);
      await fetchBoards();
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Share mode change error:', err);
    }
  };

  const confirmPrivate = async () => {
    if (!privateConfirm) return;
    await applyShareMode(privateConfirm.boardId, privateConfirm.newMode, privateConfirm.shareGuid);
    setPrivateConfirm(null);
  };

  // Create anon board
  const handleCreateAnonymous = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const board = await createBoardAnonymous();
      const recent = getRecentGuids().filter(g => g !== board.share_guid);
      recent.unshift(board.share_guid);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 10)));
      navigate(`/board/${board.share_guid}`);
    } catch (err) {
      console.error('Error creating anonymous board:', err);
      setCreating(false);
    }
  };

  // ── Welcome screen for unauthenticated ──
  if (!user) {
    return (
      <div className={`${sharedStyles.root} ${styles.root}`}>
        <div className={styles.welcomeCards}>
          <button className={styles.welcomeCard} onClick={handleCreateAnonymous} disabled={creating}>
            <div className={styles.welcomeCardTitle}>
              {creating ? 'Tworzę...' : 'Utwórz board bez logowania'}
            </div>
            <div className={styles.welcomeCardDesc}>Publiczny link, bez konta</div>
          </button>
          <button className={styles.welcomeCardAccent} onClick={signInWithGoogle}>
            <div className={styles.welcomeCardTitle}>Zaloguj się przez Google</div>
            <div className={styles.welcomeCardDesc}>Prywatne boardy, pełna kontrola</div>
          </button>
        </div>
        {recentBoards.length > 0 && (
          <div className={styles.recentSection}>
            <h2 className={styles.recentTitle}>Ostatnio odwiedzane</h2>
            <div className={styles.recentList}>
              {recentBoards.map(b => (
                <Link key={b.guid} to={`/board/${b.guid}`} className={styles.recentItem}>
                  <span className={styles.recentItemTitle}>{b.title || 'Board bez nazwy'}</span>
                  <span className={styles.recentItemDate}>
                    {new Date(b.created_at).toLocaleString('pl-PL')}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) return <div className={styles.loading}>Ładowanie...</div>;

  return (
    <div className={`${sharedStyles.root} ${styles.root}`}>
      <div className={styles.boardsList}>
        {/* ── ULUBIONE ── */}
        {(() => {
          const pinned = boards.filter(b => b.is_pinned);
          const unpinned = boards.filter(b => !b.is_pinned);

          const renderBoardCard = (board) => {
            const pct = calcBoardPct(board);
            const isPublic = !!board.share_mode;
            return (
              <Link key={board.id} to={`/board/${board.id}`} className={styles.boardCard}>
                <label
                  className={styles.colorDotLabel}
                  style={{ background: board.color }}
                  title="Zmień kolor"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="color"
                    value={board.color}
                    onChange={e => handleColorChange(board.id, e.target.value)}
                    className={styles.colorInput}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); e.target.showPicker?.(); }}
                  />
                </label>
                <div className={styles.boardInfo}>
                  <span className={styles.boardTitle}>{board.title}</span>
                  <div className={styles.boardMeta}>
                    {new Date(board.updated_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div className={styles.progressSection}>
                  <div className={styles.boardProgressBar}>
                    <div
                      className={styles.boardProgressFill}
                      style={{ width: `${pct}%`, background: board.color }}
                    />
                  </div>
                  <span className={styles.boardPct}>{pct}%</span>
                </div>

                {/* Share mode dropdown (small) */}
                <div
                  className={styles.shareModeDropdownSm}
                  ref={shareModeOpenId === board.id ? shareModeRef : null}
                  onClick={e => e.preventDefault()}
                >
                  <button
                    //className={isPublic ? styles.shareModeToggleSmPublic : styles.shareModeToggleSm}
                    className={isPublic ? sharedStyles.shareModeTogglePublic : sharedStyles.shareModeTogglePrivate}
                    //className={board.share_mode ? sharedStyles.shareModeTogglePublic : sharedStyles.shareModeToggle}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShareModeOpenId(shareModeOpenId === board.id ? null : board.id); }}
                  >
                    {(() => { const cur = SHARE_MODES.find(m => m.value === board.share_mode) || SHARE_MODES[0]; const Icon = cur.icon; return <><Icon size={10} /> {cur.label}</>; })()}
                    <ChevronDown size={10} className={shareModeOpenId === board.id ? sharedStyles.chevronOpen : ''} />
                  </button>
                  {shareModeOpenId === board.id && (
                    <div className={styles.shareModeMenuSm}>
                      {SHARE_MODES.map(m => {
                        const isActive = board.share_mode === m.value;
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.value ?? 'null'}
                            className={isActive ? sharedStyles.shareModeMenuItemActive : sharedStyles.shareModeMenuItem}
                            onClick={(e) => { handleShareModeChange(e, board, m.value); setShareModeOpenId(null); }}
                          >
                            <Icon size={11} /> {m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Link>
            );
          };

          return (
            <>
              {pinned.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>Ulubione</div>
                  {pinned.map(renderBoardCard)}
                </>
              )}
              <div className={styles.sectionTitle}>Moje boardy</div>
              {unpinned.map(renderBoardCard)}
              {unpinned.length === 0 && pinned.length === 0 && (
                <div className={styles.emptyState}>
                  <p className={styles.emptyText}>Nie masz jeszcze żadnych boardów</p>
                  <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
                    Użyj przycisku „+ Nowy board" w sidebarze
                  </p>
                </div>
              )}
            </>
          );
        })()}

        {/* ── ZEWNĘTRZNE ── */}
        {extBoards.length > 0 && (
          <>
            <div className={styles.sectionTitle} style={{ marginTop: 'var(--space-6)' }}>Zewnętrzne</div>
            {extBoards.map(sub => {
              const b = sub.boards;
              const isAvailable = b && b.share_mode;
              const pct = isAvailable ? calcBoardPct(b) : 0;
              return (
                <Link
                  key={sub.id}
                  to={isAvailable ? `/board/${b.share_guid || b.id}` : '#'}
                  className={`${styles.boardCard} ${!isAvailable ? styles.boardCardDisabled : ''}`}
                  onClick={e => { if (!isAvailable) e.preventDefault(); }}
                >
                  <span className={styles.colorDotLabel} style={{ background: isAvailable ? (b.color || '#888') : '#666' }} />
                  <div className={styles.boardInfo}>
                    <span className={styles.boardTitle}>{b?.title || 'Niedostępny board'}</span>
                    {isAvailable && (
                      <div className={styles.boardMeta}>
                        {new Date(b.updated_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>

                  {isAvailable && (
                    <div className={styles.progressSection}>
                      <div className={styles.boardProgressBar}>
                        <div
                          className={styles.boardProgressFill}
                          style={{ width: `${pct}%`, background: b.color || '#888' }}
                        />
                      </div>
                      <span className={styles.boardPct}>{pct}%</span>
                    </div>
                  )}

                  {/* Static badge instead of dropdown */}
                  {isAvailable ? (
                    <span className={styles.extBadge}>
                      {b.owner_id ? <><Globe size={10} /> Shared</> : <><Ghost size={10} /> Anonym</>}
                    </span>
                  ) : (
                    <span className={styles.extBadgeHidden}>Ukryty</span>
                  )}
                </Link>
              );
            })}
          </>
        )}
      </div>

      {/* Private confirm modal */}
      <ConfirmModal
        open={!!privateConfirm}
        title="Ustawić jako prywatny?"
        description="Osoby które mają link do tego boardu stracą dostęp. Kontynuować?"
        cancelLabel="Anuluj"
        confirmLabel="Kontynuuj"
        variant="primary"
        onCancel={() => setPrivateConfirm(null)}
        onConfirm={confirmPrivate}
      />
    </div>
  );
}