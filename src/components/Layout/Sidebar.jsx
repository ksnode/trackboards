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
  Shield, User, LogOut, Monitor, Sun, Moon,
  Globe, Unplug,
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

  const ThemeIcon = THEME_ICONS[themePref];


  return (
    <aside className={[
      styles.root,
      expanded ? styles.rootExpanded : styles.rootCollapsed,
      isMobile && expanded ? styles.rootOverlay : '',
    ].filter(Boolean).join(' ')}>

      {/* ── EXPANDED view ── */}
      {expanded && (
        <>
          {/* Header: [☰] [Trackboards] */}
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

          {/* New board button */}
          <button
            onClick={user ? handleCreate : handleCreateAnonymous}
            disabled={creating}
            className={styles.newBoardBtnFull}
            title={user ? "Nowy board" : "Nowy anonim board"}
          >
            <Plus size={14} /> {user ? 'Nowy board' : 'Nowy anonim board'}
          </button>

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
                        <GripVertical size={14} />
                      </span>
                      <NavLink
                        to={`/board/${b.id}`}
                        className={({ isActive }) => isActive ? `${styles.boardItem} ${styles.active}` : styles.boardItem}
                        onClick={handleLinkClick}
                      >
                        <span className={styles.boardDot} style={{ background: b.color }} />
                        <span className={styles.boardItemTitle}>{b.title}</span>
                        {b.share_mode != null && (
                          <Globe size={14} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.6 }} />
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
                  <Plus size={12} />
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
                    <GripVertical size={14} />
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
                        <Globe size={14} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.6 }} />
                      ) : (
                        <span className={styles.anonBadge}>A</span>
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
                  <Plus size={12} />
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
                            <Globe size={14} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.5 }} />
                          ) : (
                            <span className={styles.anonBadge}>A</span>
                          )}
                        </>
                      ) : (
                        <>
                          <Unplug size={14} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
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
                              >{copiedExtId === sub.id ? '✓ Skopiowano' : 'Skopiuj do moich'}</button>
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
                              >{copiedExtId === sub.id ? '✓ Skopiowano' : 'Skopiuj do moich'}</button>
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
                          <Globe size={12} style={{ flexShrink: 0, color: 'var(--color-text-info)', opacity: 0.5 }} />
                        ) : (
                          <span className={styles.anonBadge}>A</span>
                        )
                      ) : null
                    ) : (
                      <Unplug size={12} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
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
                  const updated = JSON.parse(raw).filter(r => r.guid !== anonRemoveConfirm);
                  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
                }
              } catch { }
              setAnonRemoveConfirm(null);
              window.dispatchEvent(new Event('boardsUpdated'));
              navigate('/boards');
            }}
          />

          {/* Footer */}
          <div className={styles.footer}>
            {user ? (
              <>
                {profile?.role === 'admin' && (
                  <NavLink to="/admin" className={styles.footerLink} onClick={handleLinkClick}>
                    <Shield size={14} /> Admin
                  </NavLink>
                )}
                <NavLink to="/profile" className={styles.footerLink} onClick={handleLinkClick}>
                  <User size={14} /> Profil
                </NavLink>
                <div className={styles.userInfo}>
                  <button onClick={() => setSignOutConfirm(true)} className={`${styles.footerLink} ${styles.logoutLink}`}>
                    <LogOut size={14} /> Wyloguj
                  </button>
                  <span className={styles.email} title={user.email}>({truncateEmail(user.email)})</span>
                </div>
              </>
            ) : (
              <>
                <span className={styles.anonLabel}>Anonim</span>
                <button onClick={signInWithGoogle} className={styles.loginBtnAccent}>
                  Zaloguj przez Google
                </button>
              </>
            )}
            <div className={styles.separator} />
            <div className={styles.segmentedGroup}>
              {THEME_CYCLE.map(value => {
                const Icon = THEME_ICONS[value];
                return (
                  <button
                    key={value}
                    onClick={() => setThemePref(value)}
                    className={themePref === value ? styles.segmentActive : styles.segment}
                  >
                    <Icon size={12} /> {THEME_LABELS[value]}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── COLLAPSED view (icons only) ── */}
      {!expanded && (
        <>
          {/* Hamburger at top */}
          <div className={styles.collapsedHeader}>
            <button className={styles.hamburger} onClick={onToggle} aria-label="Menu" title="Rozwiń">
              <Menu size={20} />
            </button>
          </div>

          {/* New board icon */}
          <button
            onClick={user ? handleCreate : handleCreateAnonymous}
            disabled={creating}
            className={styles.newBoardBtnIcon}
            title={user ? "Nowy board" : "Nowy anonim board"}
          >
            <Plus size={18} />
          </button>

          {/* Spacer pushes footer icons to bottom */}
          <div className={styles.collapsedSpacer} />

          {/* Footer icons at bottom */}
          <div className={styles.collapsedFooter}>
            <div className={styles.separator} />
            {user ? (
              <>
                {profile?.role === 'admin' && (
                  <NavLink to="/admin" className={styles.iconBtn} title="Panel admina" onClick={handleLinkClick}>
                    <Shield size={18} />
                  </NavLink>
                )}
                <NavLink to="/profile" className={styles.iconBtn} title="Profil" onClick={handleLinkClick}>
                  <User size={18} />
                </NavLink>
                <button onClick={() => setSignOutConfirm(true)} className={`${styles.iconBtn} ${styles.iconBtnDanger}`} title="Wyloguj">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button onClick={signInWithGoogle} className={styles.iconBtn} title="Zaloguj się">
                <User size={18} />
              </button>
            )}
            <div className={styles.separator} />
            <button onClick={cycleTheme} className={styles.iconBtn} title={THEME_LABELS[themePref]}>
              <ThemeIcon size={18} />
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
