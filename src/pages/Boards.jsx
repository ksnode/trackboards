import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { listMyBoards, updateBoardMeta, togglePublic } from '../lib/boards';
import { useHeader } from '../lib/headerContext';
import { Globe, Lock } from 'lucide-react';
import styles from './Boards.module.css';

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
  const { setHeader } = useHeader();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const colorInputRef = useRef(null);

  // Set content header
  useEffect(() => {
    setHeader({ title: 'Lista boardów', editable: false, showBack: false });
  }, [setHeader]);

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

  useEffect(() => {
    window.addEventListener('boardsUpdated', fetchBoards);
    return () => window.removeEventListener('boardsUpdated', fetchBoards);
  }, []);

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

  // Toggle public/private from card badge
  const handleTogglePublic = async (e, board) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await togglePublic(board.id, !board.share_guid);
      await fetchBoards();
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Toggle public error:', err);
    }
  };

  if (loading) return <div className={styles.loading}>Ładowanie...</div>;

  return (
    <div className={styles.root}>
      {boards.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Nie masz jeszcze żadnych boardów</p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            Użyj przycisku „+ Nowy board" w sidebarze
          </p>
        </div>
      ) : (
        <div className={styles.boardsList}>
          {boards.map(board => {
            const pct = calcBoardPct(board);
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

                <button
                  className={styles.badgeBtn}
                  onClick={(e) => handleTogglePublic(e, board)}
                  title={board.share_guid ? 'Kliknij aby ustawić prywatny' : 'Kliknij aby udostępnić'}
                  style={{
                    borderColor: board.share_guid ? 'var(--color-text-info, #1a6b9a)' : 'var(--color-border-primary)',
                    color: board.share_guid ? 'var(--color-text-info, #1a6b9a)' : 'var(--color-text-tertiary)',
                  }}
                >
                  {board.share_guid ? <Globe size={11} /> : <Lock size={11} />}
                  {board.share_guid ? 'PUBLIC' : 'PRIVATE'}
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}