import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { listMyBoards, createBoardAuthenticated, updateBoardMeta, softDeleteBoard } from '../../lib/boards';
import { Globe, GripVertical, Menu, Plus } from 'lucide-react';
import styles from './Sidebar.module.css';

function resolveTheme(pref) {
  if (pref === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function Sidebar({ isMobile, isOpen, onToggle, onClose }) {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const navigate = useNavigate();
  const [themePref, setThemePref] = useState(localStorage.getItem('trackboards_theme') || 'auto');
  const [boards, setBoards] = useState([]);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const menuRef = useRef(null);

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

  // Fetch boards + listen for updates
  const refreshBoards = useCallback(() => {
    if (!user) return;
    listMyBoards()
      .then(data => setBoards(data || []))
      .catch(() => {});
  }, [user]);

  useEffect(() => { refreshBoards(); }, [refreshBoards]);

  useEffect(() => {
    window.addEventListener('boardsUpdated', refreshBoards);
    return () => window.removeEventListener('boardsUpdated', refreshBoards);
  }, [refreshBoards]);

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Close sidebar when a link is clicked (mobile overlay mode)
  const handleLinkClick = () => {
    if (isMobile && isOpen) onClose();
  };

  // Create new board
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

  // Delete board
  const handleDelete = async (id) => {
    try {
      await softDeleteBoard(id);
      setBoards(prev => prev.filter(b => b.id !== id));
      setDeleteConfirm(null);
      setMenuOpen(null);
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Error deleting board:', err);
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

    // Save new positions
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

  // Mobile closed: render only the fixed hamburger button
  if (isMobile && !isOpen) {
    return (
      <button className={styles.hamburgerFixed} onClick={onToggle} aria-label="Menu">
        <Menu size={22} />
      </button>
    );
  }

  return (
    <aside className={`${styles.root} ${isMobile && isOpen ? styles.rootOverlay : ''}`}>
      {/* Header: hamburger (mobile) + logo + new board */}
      <div className={styles.header}>
        {isMobile && (
          <button className={styles.hamburgerInline} onClick={onToggle} aria-label="Zamknij menu">
            <Menu size={20} />
          </button>
        )}
        <NavLink
          to={user ? "/boards" : "/"}
          className={styles.headerLogo}
          onClick={handleLinkClick}
        >Trackboards</NavLink>
        {user && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className={styles.newBoardBtn}
            title="Nowy board"
          >
            <Plus size={14} /> Nowy board
          </button>
        )}
      </div>
      
      {/* Board list */}
      <div className={styles.boardsList}>
        {user && boards.map((b, idx) => (
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
              {b.share_guid && <Globe size={12} style={{ opacity: 0.5, flexShrink: 0, color: 'var(--color-text-info)' }} />}
            </NavLink>
            <div className={styles.boardMenuWrapper} ref={menuOpen === b.id ? menuRef : null}>
              <button
                className={styles.boardMenuBtn}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === b.id ? null : b.id); }}
              >⋮</button>
              {menuOpen === b.id && (
                <div className={styles.boardMenuDropdown}>
                  <button
                    className={styles.boardMenuItemDanger}
                    onClick={() => setDeleteConfirm(b.id)}
                  >Usuń</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <p className={styles.modalText}>Usunąć ten board?</p>
            <p className={styles.modalSubtext}>Tej operacji nie można cofnąć.</p>
            <div className={styles.modalActions}>
              <button onClick={() => { setDeleteConfirm(null); setMenuOpen(null); }} className={styles.modalCancelBtn}>Anuluj</button>
              <button onClick={() => handleDelete(deleteConfirm)} className={styles.modalDeleteBtn}>Usuń</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        {user ? (
          <>
            {profile?.role === 'admin' && (
              <NavLink to="/admin" className={styles.footerLink} onClick={handleLinkClick}>Panel admina</NavLink>
            )}
            <NavLink to="/profile" className={styles.footerLink} onClick={handleLinkClick}>Profil</NavLink>
            <div className={styles.userInfo}>
              <button onClick={signOut} className={styles.footerLink}>Wyloguj</button>
              <span className={styles.email} title={user.email}>({truncateEmail(user.email)})</span>
            </div>
          </>
        ) : (
          <button onClick={signInWithGoogle} className={styles.loginBtn}>Zaloguj się</button>
        )}
        <div style={{ borderTop: '1px solid var(--color-border-primary)', margin: 'var(--space-1) 0' }} />
        <div className={styles.segmentedGroup}>
          {[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Jasny' },
            { value: 'dark', label: 'Ciemny' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setThemePref(opt.value)}
              className={themePref === opt.value ? styles.segmentActive : styles.segment}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
