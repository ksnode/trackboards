import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  listMyBoards, createBoardAuthenticated, createBoardAnonymous,
  updateBoardMeta, softDeleteBoard, adoptOrphanBoard,
  listSubscribedBoards, subscribeToBoard, unsubscribeFromBoard,
  parseBoardGuidFromUrl, getBoard,
  toggleBoardPin, duplicateBoardToMyBoards,
} from '../../lib/boards';
import {
  GripVertical, Menu, Plus,
  UserStar, User, LogIn, LogOut, Monitor, Sun, Moon,
  Globe, Unplug, Lock,
  Ghost, HatGlasses,
} from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import { subscribeToBoardList } from '../../lib/realtime';
import styles from './Sidebar.module.css';

const RECENT_KEY = 'trackboards_recent';

function getRecentGuids() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    // Support both old format {guid, title, ...} and new format (plain strings)
    const guids = items.map(item => typeof item === 'string' ? item : item.guid).filter(Boolean);
    // Deduplicate, preserving order (first occurrence wins)
    return [...new Set(guids)].slice(0, 10);
  } catch { return []; }
}

function resolveTheme(pref) {
  if (pref === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

const THEME_CYCLE = ['auto', 'light', 'dark'];
const THEME_ICONS = { auto: Monitor, light: Sun, dark: Moon };
const THEME_LABELS = { auto: 'Auto', light: 'Jasny', dark: 'Ciemny' };

export function Sidebar({ expanded, isMobile, onToggle, onCollapse }) {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [themePref, setThemePref] = useState(localStorage.getItem('trackboards_theme') || 'auto');
  const [boards, setBoards] = useState([]);
  const [pinnedBoards, setPinnedBoards] = useState([]);
  const [extBoards, setExtBoards] = useState([]);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [extMenuOpen, setExtMenuOpen] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeUrl, setSubscribeUrl] = useState('');
  const [subscribeError, setSubscribeError] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [recentBoardStatus, setRecentBoardStatus] = useState({});
  const [anonBoards, setAnonBoards] = useState([]);
  const [anonRemoveConfirm, setAnonRemoveConfirm] = useState(null);
  const [extUnsubConfirm, setExtUnsubConfirm] = useState(null);
  const [adoptConfirm, setAdoptConfirm] = useState(null);
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [copiedExtId, setCopiedExtId] = useState(null);
  const menuRef = useRef(null);
  const extMenuRef = useRef(null);

  const applyTheme = useCallback((pref) => {
    document.documentElement.setAttribute('data-theme', resolveTheme(pref));
  }, []);

  useEffect(() => {
    localStorage.setItem('trackboards_theme', themePref);
    applyTheme(themePref);
  }, [themePref, applyTheme]);

  useEffect(() => {
    if (themePref !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('auto');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [themePref, applyTheme]);

  const [overlayActive, setOverlayActive] = useState(false);

  useEffect(() => {
    if (isMobile && expanded) {
      setOverlayActive(true);
    } else if (!expanded) {
      const t = setTimeout(() => setOverlayActive(false), 250);
      return () => clearTimeout(t);
    }
  }, [isMobile, expanded]);


  // Fetch own boards
  const refreshBoards = useCallback(() => {
    if (!user) return;
    listMyBoards()
      .then(data => {
        setPinnedBoards((data || []).filter(b => b.is_pinned));
        setBoards((data || []).filter(b => !b.is_pinned));
      })
      .catch(() => { });
  }, [user]);

  // Fetch subscribed boards
  const refreshExtBoards = useCallback(() => {
    if (!user) return;
    listSubscribedBoards()
      .then(data => setExtBoards(data || []))
      .catch(() => { });
  }, [user]);

  useEffect(() => { refreshBoards(); refreshExtBoards(); }, [refreshBoards, refreshExtBoards]);

  useEffect(() => {
    const handler = () => { refreshBoards(); refreshExtBoards(); };
    window.addEventListener('boardsUpdated', handler);
    return () => window.removeEventListener('boardsUpdated', handler);
  }, [refreshBoards, refreshExtBoards]);

  // Fetch anon boards data from DB
  const fetchAnonBoards = useCallback(async () => {
    if (user) return;
    const guids = getRecentGuids();
    if (guids.length === 0) { setAnonBoards([]); return; }
    const results = await Promise.all(
      guids.map(async (guid) => {
        try {
          const board = await getBoard(guid);
          return board && board.share_mode
            ? { guid, available: true, title: board.title, owner_id: board.owner_id, share_mode: board.share_mode }
            : { guid, available: false, title: null, owner_id: null, share_mode: null };
        } catch {
          return { guid, available: false, title: null, owner_id: null, share_mode: null };
        }
      })
    );
    setAnonBoards(results);
  }, [user]);

  useEffect(() => {
    fetchAnonBoards();
    const handler = () => fetchAnonBoards();
    window.addEventListener('boardsUpdated', handler);
    return () => window.removeEventListener('boardsUpdated', handler);
  }, [fetchAnonBoards]);

  // Realtime: subscribe to board list changes (all users)
  useEffect(() => {
    const unsub = subscribeToBoardList(() => {
      if (user) {
        refreshBoards();
        refreshExtBoards();
      } else {
        fetchAnonBoards();
      }
    });
    return unsub;
  }, [user, refreshBoards, refreshExtBoards, fetchAnonBoards]);

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
      if (extMenuRef.current && !extMenuRef.current.contains(e.target)) setExtMenuOpen(null);
    };
    if (menuOpen || extMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen, extMenuOpen]);

  // Close sidebar when a link is clicked (mobile overlay)
  const handleLinkClick = () => {
    if (isMobile && expanded) onCollapse();
  };

  // Create new board (authenticated)
  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const board = await createBoardAuthenticated();
      await refreshBoards();
      navigate(`/board/${board.id}`);
    } catch (err) {
      console.error('Error creating board:', err);
    } finally {
      setCreating(false);
    }
  };

  // Create new anonymous board
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
    } finally {
      setCreating(false);
    }
  };

  // Delete board
  const handleDelete = async ({ id, ownerId }) => {
    try {
      await softDeleteBoard(id, ownerId);
      setBoards(prev => prev.filter(b => b.id !== id));
      setDeleteConfirm(null);
      setMenuOpen(null);
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Error deleting board:', err);
    }
  };

  // Unsubscribe from external board
  const handleUnsubscribe = async (boardId) => {
    try {
      await unsubscribeFromBoard(boardId);
      setExtBoards(prev => prev.filter(s => s.board_id !== boardId));
      setExtMenuOpen(null);
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Error unsubscribing:', err);
    }
  };

  // Subscribe modal
  const handleSubscribeSubmit = async () => {
    setSubscribeError('');
    const guid = parseBoardGuidFromUrl(subscribeUrl);
    if (!guid) {
      setSubscribeError('Nieprawidłowy link do boardu');
      return;
    }
    setSubscribing(true);
    try {
      const board = await getBoard(guid);
      if (!board) {
        setSubscribeError('Board nie istnieje lub brak dostępu');
        return;
      }
      // Check if board is private
      if (!board.share_mode) {
        setSubscribeError('Ten board jest prywatny lub nie istnieje');
        return;
      }
      // Check if user owns this board
      if (user && board.owner_id === user.id) {
        setSubscribeError('Ten board jest już na Twojej liście');
        return;
      }
      // Check if already subscribed
      if (extBoards.some(s => s.board_id === board.id)) {
        setSubscribeError('Ten board jest już w Zewnętrznych');
        return;
      }
      await subscribeToBoard(board.id);
      await refreshExtBoards();
      setShowSubscribeModal(false);
      setSubscribeUrl('');
    } catch (err) {
      setSubscribeError('Board nie istnieje lub brak dostępu');
    } finally {
      setSubscribing(false);
    }
  };

  // Drag & Drop
  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = async (e, dropIdx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === dropIdx) {
      handleDragEnd();
      return;
    }
    const reordered = [...boards];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dropIdx, 0, moved);
    setBoards(reordered);
    handleDragEnd();

    try {
      await Promise.all(
        reordered.map((b, i) => updateBoardMeta(b.id, { position: i }))
      );
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Error saving positions:', err);
      refreshBoards();
    }
  };

  const truncateEmail = (email) => {
    if (!email) return '';
    return email.length > 28 ? email.slice(0, 28) + '…' : email;
  };

  // Theme cycling (for collapsed icon)
  const cycleTheme = () => {
    const idx = THEME_CYCLE.indexOf(themePref);
    setThemePref(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  };



  return (
    <aside className={[
      styles.root,
      expanded ? styles.rootExpanded : styles.rootCollapsed,
      overlayActive ? styles.rootOverlay : '',
    ].filter(Boolean).join(' ')}>

      {/* ── Headers ── */}
      {expanded && (
        <div className={styles.header}>
          <button className={styles.hamburger} onClick={onToggle} aria-label="Menu" title="Zwiń">
            <Menu size={20} />
          </button>
          <NavLink
            to={user ? "/boards" : "/boards"}
            className={styles.headerLogo}
            onClick={handleLinkClick}
          >Trackboards</NavLink>
        </div>
      )}
      {!expanded && (
        <div className={styles.collapsedHeader}>
          <button className={styles.hamburger} onClick={onToggle} aria-label="Menu" title="Rozwiń">
            <Menu size={20} />
          </button>
        </div>
      )}

      {/* New board button — always rendered, adapts via CSS */}
      <button
        onClick={user ? handleCreate : handleCreateAnonymous}
        disabled={creating}
        className={styles.newBoardBtn}
        title={user ? "Nowy board" : "Nowy anonim board"}
      >
        <Plus size={16} />
        <span className={styles.newBoardBtnLabel}>{user ? 'Nowy board' : 'Nowy anonim board'}</span>
      </button>

      {/* ── EXPANDED view ── */}
      {expanded && (
        <>
          {/* ── LOGGED IN: own boards + external ── */}
          {user && (
            <div className={styles.boardsList}>
              {/* Section: ULUBIONE */}
              {pinnedBoards.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>Ulubione</div>
                  {pinnedBoards.map((b, idx) => (
                    <div
                      key={b.id}
                      className={styles.boardItemRow}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, idx)}
                    >
                      <span className={styles.dragHandle}>
                        <GripVertical size={18} />
                      </span>
                      <NavLink
                        to={`/board/${b.id}`}
                        className={({ isActive }) => isActive ? `${styles.boardItem} ${styles.active}` : styles.boardItem}
                        onClick={handleLinkClick}
                      >
                        <span className={styles.boardDot} style={{ background: b.color }} />
                        <span className={styles.boardItemTitle}>{b.title}</span>
                        {b.share_mode != null && (
                          <Globe size={18} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.4 }} />
                        )}
                      </NavLink>
                      <div className={styles.boardMenuWrapper} ref={menuOpen === b.id ? menuRef : null}>
                        <button
                          className={styles.boardMenuBtn}
                          onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === b.id ? null : b.id); }}
                        >⋮</button>
                        {menuOpen === b.id && (
                          <div className={styles.boardMenuDropdown}>
                            <button
                              className={styles.boardMenuItem}
                              onClick={async () => {
                                await toggleBoardPin(b.id, false);
                                window.dispatchEvent(new Event('boardsUpdated'));
                                setMenuOpen(null);
                              }}
                            >Odepnij</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Section: MOJE BOARDY */}
              <div className={styles.sectionTitleRow}>
                <span className={styles.sectionTitle}>Moje boardy</span>
                <button
                  className={styles.addExtBtn}
                  onClick={() => handleCreate(true)}
                  title="Nowy board"
                >
                  <Plus size={16} />
                </button>
              </div>

              {boards.map((b, idx) => (
                <div
                  key={b.id}
                  className={`${styles.boardItemRow} ${dragOverIdx === idx ? styles.boardItemDragOver : ''} ${dragIdx === idx ? styles.boardItemDragging : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, idx)}
                >
                  <span className={styles.dragHandle}>
                    <GripVertical size={18} />
                  </span>
                  <NavLink
                    to={`/board/${b.id}`}
                    className={({ isActive }) => isActive ? `${styles.boardItem} ${styles.active}` : styles.boardItem}
                    onClick={handleLinkClick}
                  >
                    <span className={styles.boardDot} style={{ background: b.color }} />
                    <span className={styles.boardItemTitle}>{b.title}</span>
                    {b.share_mode ? (
                      b.owner_id ? (
                        <Globe size={18} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.4 }} />
                      ) : (
                        <Ghost size={18} style={{ flexShrink: 0, color: 'var(--color-text-muted)', opacity: 0.4 }} />
                      )
                    ) : null}
                  </NavLink>
                  <div className={styles.boardMenuWrapper} ref={menuOpen === b.id ? menuRef : null}>
                    <button
                      className={styles.boardMenuBtn}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === b.id ? null : b.id); }}
                    >⋮</button>
                    {menuOpen === b.id && (
                      <div className={styles.boardMenuDropdown}>
                        <button
                          className={styles.boardMenuItem}
                          onClick={async () => {
                            await toggleBoardPin(b.id, true);
                            window.dispatchEvent(new Event('boardsUpdated'));
                            setMenuOpen(null);
                          }}
                        >Przypnij</button>
                        <button
                          className={styles.boardMenuItemDanger}
                          onClick={() => setDeleteConfirm({ id: b.id, ownerId: b.owner_id })}
                        >Usuń</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Section: ZEWNĘTRZNE */}
              <div className={styles.sectionTitleRow}>
                <span className={styles.sectionTitle}>Zewnętrzne</span>
                <button
                  className={styles.addExtBtn}
                  onClick={() => setShowSubscribeModal(true)}
                  title="Dodaj zewnętrzny board"
                >
                  <Plus size={18} />
                </button>
              </div>
              {extBoards.map(sub => {
                const b = sub.boards;
                const isAvailable = b && b.share_mode;
                return (
                  <div key={sub.id} className={`${styles.boardItemRow} ${!isAvailable ? styles.extBoardDisabled : ''}`}>
                    <NavLink
                      to={isAvailable ? `/board/${b.share_guid || b.id}` : '#'}
                      className={({ isActive }) =>
                        isActive && isAvailable ? `${styles.boardItem} ${styles.active}` : styles.boardItem
                      }
                      onClick={(e) => {
                        if (!isAvailable) { e.preventDefault(); return; }
                        handleLinkClick();
                      }}
                      title={!isAvailable ? 'Board został ukryty lub usunięty' : undefined}
                      style={!isAvailable ? { opacity: 0.4, cursor: 'default' } : undefined}
                    >
                      {isAvailable ? (
                        <>
                          <span className={styles.boardDot} style={{ background: b.color || '#888' }} />
                          <span className={styles.boardItemTitle}>{b.title}</span>
                          {b.owner_id ? (
                            <Globe size={18} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.4 }} />
                          ) : (
                            <Ghost size={18} style={{ flexShrink: 0, color: 'var(--color-text-muted)', opacity: 0.4 }} />
                          )}
                        </>
                      ) : (
                        <>
                          <Unplug size={18} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
                          <span className={styles.boardItemTitle}>{b?.title || 'Niedostępny board'}</span>
                        </>
                      )}
                    </NavLink>
                    <div className={styles.boardMenuWrapper} ref={extMenuOpen === sub.id ? extMenuRef : null}>
                      <button
                        className={styles.boardMenuBtn}
                        onClick={(e) => { e.stopPropagation(); setExtMenuOpen(extMenuOpen === sub.id ? null : sub.id); }}
                      >⋮</button>
                      {extMenuOpen === sub.id && (
                        <div className={styles.boardMenuDropdown}>
                          {!isAvailable && (
                            <button
                              className={styles.boardMenuItemDanger}
                              onClick={() => {
                                setExtMenuOpen(null);
                                setExtUnsubConfirm(sub.board_id);
                              }}
                            >Odłącz</button>
                          )}
                          {isAvailable && !b.owner_id && (
                            <>
                              <button
                                className={styles.boardMenuItem}
                                onClick={async () => {
                                  await duplicateBoardToMyBoards(b.id);
                                  setCopiedExtId(sub.id);
                                  setTimeout(() => setCopiedExtId(null), 2000);
                                  window.dispatchEvent(new Event('boardsUpdated'));
                                  setExtMenuOpen(null);
                                }}
                              >{copiedExtId === sub.id ? '✓ Skopiowano' : 'Skopiuj'}</button>
                              <hr className={styles.boardMenuSep} />
                              <button
                                className={styles.boardMenuItem}
                                onClick={() => {
                                  setAdoptConfirm(b.id);
                                  setExtMenuOpen(null);
                                }}
                              >Adoptuj</button>
                              <button
                                className={styles.boardMenuItemDanger}
                                onClick={() => {
                                  setExtUnsubConfirm(sub.board_id);
                                  setExtMenuOpen(null);
                                }}
                              >Odłącz</button>
                            </>
                          )}
                          {isAvailable && b.owner_id && (
                            <>
                              <button
                                className={styles.boardMenuItem}
                                onClick={async () => {
                                  await duplicateBoardToMyBoards(b.id);
                                  setCopiedExtId(sub.id);
                                  setTimeout(() => setCopiedExtId(null), 2000);
                                  window.dispatchEvent(new Event('boardsUpdated'));
                                  setExtMenuOpen(null);
                                }}
                              >{copiedExtId === sub.id ? '✓ Skopiowano' : 'Skopiuj'}</button>
                              <hr className={styles.boardMenuSep} />
                              <button
                                className={styles.boardMenuItemDanger}
                                onClick={() => {
                                  setExtUnsubConfirm(sub.board_id);
                                  setExtMenuOpen(null);
                                }}
                              >Odłącz</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {extBoards.length === 0 && (
                <div className={styles.extEmpty}>Brak zewnętrznych boardów</div>
              )}
            </div>
          )}

          {/* ── NOT LOGGED IN: anon boards from localStorage ── */}
          {!user && (
            <div className={styles.boardsList}>
              {anonBoards.map(b => (
                <div key={b.guid} className={styles.boardItemRow}>
                  <NavLink
                    to={b.available ? `/board/${b.guid}` : '#'}
                    className={({ isActive }) => isActive && b.available ? `${styles.boardItem} ${styles.active}` : styles.boardItem}
                    onClick={(e) => {
                      if (!b.available) { e.preventDefault(); return; }
                      handleLinkClick();
                    }}
                    style={!b.available ? { opacity: 0.4, cursor: 'default' } : undefined}
                    title={!b.available ? 'Board został ukryty lub usunięty' : undefined}
                  >
                    <span className={styles.boardItemTitle}>{b.title || 'Niedostępny board'}</span>
                    {b.available ? (
                      b.share_mode ? (
                        b.owner_id ? (
                          <Globe size={18} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.4 }} />
                        ) : (
                          <Ghost size={18} style={{ flexShrink: 0, color: 'var(--color-text-muted)', opacity: 0.4 }} />
                        )
                      ) : null
                    ) : (
                      <Unplug size={18} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
                    )}
                  </NavLink>
                  <div className={styles.boardMenuWrapper} ref={menuOpen === b.guid ? menuRef : null}>
                    <button
                      className={styles.boardMenuBtn}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === b.guid ? null : b.guid); }}
                    >⋮</button>
                    {menuOpen === b.guid && (
                      <div className={styles.boardMenuDropdown}>
                        <button
                          className={styles.boardMenuItemDanger}
                          onClick={() => {
                            setMenuOpen(null);
                            setAnonRemoveConfirm(b.guid);
                          }}
                        >Usuń z listy</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delete confirm modal */}
          <ConfirmModal
            open={!!deleteConfirm}
            title="Usunąć ten board?"
            description="Tej operacji nie można cofnąć."
            cancelLabel="Anuluj"
            confirmLabel="Usuń"
            variant="danger"
            onCancel={() => { setDeleteConfirm(null); setMenuOpen(null); }}
            onConfirm={() => handleDelete(deleteConfirm)}
          />

          {/* Ext board unsubscribe confirm */}
          <ConfirmModal
            open={!!extUnsubConfirm}
            title="Odłączyć board?"
            description="Board zniknie z listy."
            cancelLabel="Anuluj"
            confirmLabel="Odłącz"
            variant="danger"
            onCancel={() => setExtUnsubConfirm(null)}
            onConfirm={async () => {
              try {
                await unsubscribeFromBoard(extUnsubConfirm);
                setExtBoards(prev => prev.filter(s => s.board_id !== extUnsubConfirm));
                window.dispatchEvent(new Event('boardsUpdated'));
              } catch (err) {
                console.error('Unsubscribe error:', err);
              }
              setExtUnsubConfirm(null);
            }}
          />

          {/* Adopt confirm modal */}
          <ConfirmModal
            open={!!adoptConfirm}
            title="Zaadoptować ten board?"
            description="Board zostanie przeniesiony do Twoich boardów. Będziesz jego właścicielem."
            cancelLabel="Anuluj"
            confirmLabel="Adoptuj"
            variant="primary"
            onCancel={() => setAdoptConfirm(null)}
            onConfirm={async () => {
              try {
                await adoptOrphanBoard(adoptConfirm);
                try { await unsubscribeFromBoard(adoptConfirm); } catch { }
                window.dispatchEvent(new Event('boardsUpdated'));
              } catch (err) {
                console.error('Adopt error:', err);
              }
              setAdoptConfirm(null);
            }}
          />

          {/* Subscribe modal */}
          <ConfirmModal
            open={showSubscribeModal}
            title="Dodaj zewnętrzny board"
            description="Wklej link do boardu"
            cancelLabel="Anuluj"
            confirmLabel={subscribing ? 'Dodaję...' : 'Dodaj'}
            variant="primary"
            disabled={subscribing}
            error={subscribeError}
            onCancel={() => { setShowSubscribeModal(false); setSubscribeUrl(''); setSubscribeError(''); }}
            onConfirm={handleSubscribeSubmit}
          >
            <input
              className={styles.subscribeInput}
              type="text"
              placeholder="https://trackboards.web.app/board/..."
              value={subscribeUrl}
              onChange={e => { setSubscribeUrl(e.target.value); setSubscribeError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleSubscribeSubmit(); }}
              autoFocus
            />
          </ConfirmModal>

          {/* Sign out confirm */}
          <ConfirmModal
            open={signOutConfirm}
            title="Wylogować się?"
            description="Zostaniesz wylogowany z aplikacji."
            cancelLabel="Anuluj"
            confirmLabel="Wyloguj"
            variant="danger"
            onCancel={() => setSignOutConfirm(false)}
            onConfirm={() => { setSignOutConfirm(false); signOut(); }}
          />

          {/* Anon board remove confirm modal */}
          <ConfirmModal
            open={!!anonRemoveConfirm}
            title="Usunąć board z listy?"
            description="Board nie zostanie usunięty z bazy — tylko z Twojej listy."
            cancelLabel="Anuluj"
            confirmLabel="Usuń z listy"
            variant="danger"
            onCancel={() => setAnonRemoveConfirm(null)}
            onConfirm={() => {
              try {
                const raw = localStorage.getItem(RECENT_KEY);
                if (raw) {
                  const updated = JSON.parse(raw).filter(r =>
                    typeof r === 'string' ? r !== anonRemoveConfirm : r.guid !== anonRemoveConfirm
                  );
                  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
                }
              } catch { }
              setAnonBoards(prev => prev.filter(b => b.guid !== anonRemoveConfirm));
              setAnonRemoveConfirm(null);
              window.dispatchEvent(new Event('boardsUpdated'));
            }}
          />
        </>
      )}

      {/* Spacer — pushes footer to bottom when collapsed */}
      {!expanded && <div style={{ flex: 1 }} />}

      {/* Footer — always rendered, adapts via CSS */}
      <div className={styles.footer}>
        {user ? (
          <>
            {profile?.role === 'admin' && (
              <NavLink to="/admin" className={styles.footerLink} onClick={handleLinkClick} title="Panel admina">
                <UserStar size={18} />
                <span className={styles.footerLabel}>Administrator</span>
              </NavLink>
            )}
            <NavLink to="/profile" className={styles.footerLink} onClick={handleLinkClick} title="Profil">
              <User size={18} />
              <span className={styles.footerLabel}>Mój Profil</span>
            </NavLink>
            <NavLink to="/privacy" className={styles.footerLink} onClick={handleLinkClick} title="Prywatność">
              <HatGlasses size={18} />
              <span className={styles.footerLabel}>Prywatność</span>
            </NavLink>
            <div className={styles.separator} />
            <button onClick={() => setSignOutConfirm(true)} className={`${styles.footerLink} ${styles.logoutLink}`} title="Wyloguj">
              <LogOut size={18} />
              <span className={styles.footerLabel}>Wyloguj</span>
              <span className={`${styles.footerLabel} ${styles.email}`} title={user.email}>({truncateEmail(user.email)})</span>
            </button>
          </>
        ) : (
          <>
            <span className={styles.footerLink} title="Anonim">
              <Ghost size={18} />
              <span className={styles.footerLabel}>Anonim</span>
            </span>
            <NavLink to="/privacy" className={styles.footerLink} onClick={handleLinkClick} title="Prywatność">
              <HatGlasses size={18} />
              <span className={styles.footerLabel}>Prywatność</span>
            </NavLink>
            <div className={styles.separator} />
            <button onClick={signInWithGoogle} className={`${styles.footerLink} ${styles.loginLink}`} title="Zaloguj się">
              <LogIn size={18} />
              <span className={styles.footerLabel}>Zaloguj przez Google</span>
            </button>
          </>
        )}
      </div>
      {/* Theme switcher — always rendered, adapts via CSS */}
      <div className={styles.separator} />
      <div className={styles.themeSwitcher}>
        {THEME_CYCLE.map(value => {
          const Icon = THEME_ICONS[value];
          const isActive = themePref === value;
          return (
            <button
              key={value}
              onClick={isActive && !expanded ? cycleTheme : () => setThemePref(value)}
              className={isActive ? styles.themeSwitcherBtnActive : styles.themeSwitcherBtn}
            >
              <Icon size={18} />
              <span className={styles.segmentLabel}>{THEME_LABELS[value]}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
