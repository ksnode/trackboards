import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import {
  listUsers, updateUserRole, toggleUserActive, forceSignOutUser,
} from '../lib/boards';
import { ChevronDown } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { setHeader } = useHeader();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleConfirm, setRoleConfirm] = useState(null);
  const [signoutConfirm, setSignoutConfirm] = useState(null);
  const [blockConfirm, setBlockConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Status dropdown (portal)
  const [statusOpenId, setStatusOpenId] = useState(null);
  const [statusPos, setStatusPos] = useState({ top: 0, left: 0 });
  const statusBtnRefs = useRef({});

  useEffect(() => {
    setHeader({ title: 'Użytkownicy', editable: false, showBack: true, backLabel: '← Admin', backTo: '/admin' });
  }, [setHeader]);

  const fetchUsers = async () => {
    try {
      const data = await listUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  // Close status dropdown on outside click
  useEffect(() => {
    if (!statusOpenId) return;
    const handler = () => setStatusOpenId(null);
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [statusOpenId]);

  const openStatus = useCallback((userId) => {
    if (statusOpenId === userId) { setStatusOpenId(null); return; }
    const btn = statusBtnRefs.current[userId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setStatusPos({ top: rect.bottom + 4, left: rect.left });
    }
    setStatusOpenId(userId);
  }, [statusOpenId]);

  const handleRoleChange = (userId, newRole, email) => {
    setRoleConfirm({ userId, newRole, email });
  };

  const confirmRoleChange = async () => {
    if (!roleConfirm) return;
    try {
      await updateUserRole(roleConfirm.userId, roleConfirm.newRole);
      setUsers(prev => prev.map(u =>
        u.user_id === roleConfirm.userId ? { ...u, role: roleConfirm.newRole } : u
      ));
    } catch (err) {
      console.error('Role change error:', err);
    } finally {
      setRoleConfirm(null);
    }
  };

  const handleStatusChange = (userId, currentlyActive, email) => {
    if (currentlyActive) {
      // Blocking — needs confirm
      setBlockConfirm({ userId, email });
    } else {
      // Unblocking — immediate
      doToggleActive(userId, true);
    }
  };

  const doToggleActive = async (userId, currentlyActive) => {
    try {
      await toggleUserActive(userId, !currentlyActive);
      if (currentlyActive) {
        try { await forceSignOutUser(userId); } catch (err) {
          console.error('Force signout error:', err);
        }
      }
      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, is_active: !currentlyActive } : u
      ));
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const confirmBlock = async () => {
    if (!blockConfirm) return;
    await doToggleActive(blockConfirm.userId, true);
    setBlockConfirm(null);
  };

  const handleForceSignout = async () => {
    if (!signoutConfirm) return;
    try {
      await forceSignOutUser(signoutConfirm.userId);
    } catch (err) {
      console.error('Force signout error:', err);
    } finally {
      setSignoutConfirm(null);
    }
  };

  const getBoardCount = (u) => {
    if (Array.isArray(u.boards) && u.boards.length > 0) return u.boards[0].count ?? 0;
    return 0;
  };

  if (loading) return <div className={s.loading}>Ładowanie...</div>;

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <Link to="/admin" className={s.breadcrumbLink}>Admin</Link>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Użytkownicy</span>
      </div>

      <input
        type="text"
        className={s.searchInput}
        placeholder="Szukaj po emailu..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      {filteredUsers.length === 0 ? (
        <div className={s.emptyState}>
          {users.length === 0 ? 'Brak użytkowników' : 'Brak użytkowników pasujących do wyszukiwania'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className={s.table}>
            <thead className={s.tableHead}>
              <tr>
                <th className={s.tableHeadCell}>Email</th>
                <th className={s.tableHeadCell}>Rola</th>
                <th className={s.tableHeadCell}>Status</th>
                <th className={s.tableHeadCell}>Boardy</th>
                <th className={s.tableHeadCell}>Rejestracja</th>
                <th className={s.tableHeadCell}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const isSelf = currentUser && u.user_id === currentUser.id;
                const boardCount = getBoardCount(u);
                return (
                  <tr key={u.user_id} className={s.tableRow}>
                    <td className={s.tableCell}>{u.email}</td>
                    <td className={s.tableCell}>
                      <select
                        className={s.selectSmall}
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => handleRoleChange(u.user_id, e.target.value, u.email)}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className={s.tableCell}>
                      {/* Status dropdown */}
                      <button
                        className={u.is_active ? s.statusToggleActive : s.statusToggleBlocked}
                        ref={el => { statusBtnRefs.current[u.user_id] = el; }}
                        onClick={() => !isSelf && openStatus(u.user_id)}
                        disabled={isSelf}
                        title={isSelf ? 'Nie możesz zablokować siebie' : ''}
                        style={isSelf ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                      >
                        {u.is_active ? 'Aktywny' : 'Zablokowany'}
                        {!isSelf && <ChevronDown size={10} className={statusOpenId === u.user_id ? s.chevronOpen : ''} />}
                      </button>
                      {statusOpenId === u.user_id && createPortal(
                        <div
                          className={s.optionsDropdownPortal}
                          style={{ top: statusPos.top, left: statusPos.left, minWidth: 110 }}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          <button
                            className={u.is_active ? s.shareModeMenuItemActive : s.shareModeMenuItem}
                            onClick={() => {
                              if (!u.is_active) handleStatusChange(u.user_id, u.is_active, u.email);
                              setStatusOpenId(null);
                            }}
                          >
                            Aktywny
                          </button>
                          <button
                            className={!u.is_active ? s.shareModeMenuItemActive : s.shareModeMenuItem}
                            onClick={() => {
                              if (u.is_active) handleStatusChange(u.user_id, u.is_active, u.email);
                              setStatusOpenId(null);
                            }}
                          >
                            Zablokowany
                          </button>
                        </div>,
                        document.body
                      )}
                    </td>
                    <td className={`${s.tableCell} ${s.tableCellMono}`}>
                      {boardCount}
                    </td>
                    <td className={`${s.tableCell} ${s.tableCellMono}`}>
                      {new Date(u.created_at).toLocaleDateString('pl-PL', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className={s.tableCellActions}>
                      <div className={s.actionsPanel}>
                        <div className={s.actionsPanelGroup}>
                          <button className={s.btnGhostFixed} onClick={() => navigate(`/admin/users/${u.user_id}/boards`)}>
                            Boardy
                          </button>
                          <button className={s.btnGhostFixed} onClick={() => navigate(`/admin/users/${u.user_id}/purgatory`)}>
                            Czyściec
                          </button>
                        </div>
                        <div className={s.actionsPanelSep} />
                        <div className={s.actionsPanelGroup}>
                          <button
                            className={s.btnGhostFixed}
                            disabled={isSelf}
                            style={isSelf
                              ? { opacity: 0.4, cursor: 'not-allowed' }
                              : { color: 'var(--color-danger)' }}
                            onClick={() => !isSelf && setSignoutConfirm({ userId: u.user_id, email: u.email })}
                          >
                            Wyloguj
                          </button>
                          <span className={s.tooltipWrapper}>
                            <button className={s.btnGhostFixed} disabled style={{ opacity: 0.4, cursor: 'not-allowed' }}>
                              Usuń konto
                            </button>
                            <span className={s.tooltipText}>Wkrótce</span>
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role change confirm */}
      <ConfirmModal
        open={!!roleConfirm}
        title="Zmienić rolę?"
        description={roleConfirm
          ? `Ustawić rolę „${roleConfirm.newRole}" dla ${roleConfirm.email}?`
          : ''}
        cancelLabel="Anuluj"
        confirmLabel="Zmień rolę"
        variant="primary"
        onCancel={() => setRoleConfirm(null)}
        onConfirm={confirmRoleChange}
      />

      {/* Force signout confirm */}
      <ConfirmModal
        open={!!signoutConfirm}
        title="Wylogować użytkownika?"
        description="Użytkownik zostanie natychmiast wylogowany ze wszystkich sesji."
        cancelLabel="Anuluj"
        confirmLabel="Wyloguj"
        variant="danger"
        onCancel={() => setSignoutConfirm(null)}
        onConfirm={handleForceSignout}
      />

      {/* Block user confirm */}
      <ConfirmModal
        open={!!blockConfirm}
        title="Zablokować użytkownika?"
        description={blockConfirm
          ? `Użytkownik ${blockConfirm.email} zostanie zablokowany i natychmiast wylogowany ze wszystkich sesji.`
          : ''}
        cancelLabel="Anuluj"
        confirmLabel="Zablokuj"
        variant="danger"
        onCancel={() => setBlockConfirm(null)}
        onConfirm={confirmBlock}
      />
    </div>
  );
}