import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import {
  listMyBoards, createBoardAuthenticated, softDeleteBoard, togglePublic,
} from '../lib/boards';
import { computeParentState } from '../components/BoardFramework/treeHelpers';
import styles from './Trackboard.module.css';

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
    // Check if there are any leaves at all (all-skip case)
    let hasLeaves = false;
    const checkLeaf = (n) => { if (!n.children?.length) hasLeaves = true; else n.children.forEach(checkLeaf); };
    modules.forEach(m => { if (m.tag !== 'placeholder') m.tree.forEach(checkLeaf); });
    return hasLeaves ? 100 : 0;
  }
  return Math.round((doneH / totalH) * 100);
}

export default function Trackboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(null);
  const menuRef = useRef(null);

  const fetchBoards = async () => {
    try {
      const data = await listMyBoards();
      setBoards(data || []);
    } catch (err) {
      console.error('Error loading boards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBoards(); }, []);

  // Close menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(null);
    };
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const board = await createBoardAuthenticated();
      navigate(`/board/${board.id}`);
    } catch (err) {
      console.error('Error creating board:', err);
      setCreating(false);
    }
  };

  const handleSoftDelete = async (id) => {
    try {
      await softDeleteBoard(id);
      setBoards(prev => prev.filter(b => b.id !== id));
      setMenuOpen(null);
    } catch (err) {
      console.error('Error deleting board:', err);
    }
  };

  const handleTogglePublic = async (board) => {
    try {
      await togglePublic(board.id, !board.share_guid);
      await fetchBoards();
    } catch (err) {
      console.error('Error toggling public:', err);
    }
  };

  if (loading) return <div className={styles.loading}>Ładowanie...</div>;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>Twoje boardy</h1>
        <button onClick={handleCreate} disabled={creating} className={styles.addBtn}>
          {creating ? 'Tworzę...' : '+ Nowy board'}
        </button>
      </div>

      {boards.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Nie masz jeszcze żadnych boardów</p>
          <button onClick={handleCreate} disabled={creating} className={styles.addBtn}>
            {creating ? 'Tworzę...' : '+ Utwórz pierwszy board'}
          </button>
        </div>
      ) : (
        <div className={styles.boardsList}>
          {boards.map(board => {
            const pct = calcBoardPct(board);
            return (
              <div key={board.id} className={styles.boardCard}>
                <div className={styles.colorDot} style={{ background: board.color }} />
                <div className={styles.boardInfo}>
                  <Link to={`/board/${board.id}`} className={styles.boardTitle}>
                    {board.title}
                  </Link>
                  <div className={styles.boardMeta}>
                    {new Date(board.updated_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <span className={styles.boardPct}>{pct}%</span>
                <div className={styles.boardProgressBar}>
                  <div
                    className={styles.boardProgressFill}
                    style={{ width: `${pct}%`, background: board.color }}
                  />
                </div>

                <span className={board.share_guid ? styles.publicBadge : styles.privateBadge}>
                  {board.share_guid ? 'PUBLIC' : 'PRIVATE'}
                </span>

                <button
                  className={styles.actionBtn}
                  onClick={() => handleTogglePublic(board)}
                  title={board.share_guid ? 'Ustaw jako prywatny' : 'Ustaw jako publiczny'}
                >
                  {board.share_guid ? '🔗' : '🔒'}
                </button>

                <Link to={`/board/${board.id}`} className={styles.actionBtn}>
                  Otwórz
                </Link>

                <div className={styles.menuWrapper} ref={menuOpen === board.id ? menuRef : null}>
                  <button
                    className={styles.menuBtn}
                    onClick={() => setMenuOpen(menuOpen === board.id ? null : board.id)}
                  >
                    ⋯
                  </button>
                  {menuOpen === board.id && (
                    <div className={styles.menuDropdown}>
                      <button className={styles.menuItemDanger} onClick={() => handleSoftDelete(board.id)}>
                        Usuń board
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}