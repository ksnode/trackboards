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
  const [signoutConfirm, setSignoutConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const [roleOpenId, setRoleOpenId] = useState(null);
  const [rolePos, setRolePos] = useState({ top: 0, left: 0 });
  const roleBtnRefs = useRef({});
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

  useEffect(() => {
    if (!statusOpenId && !roleOpenId) return;
    const handler = () => {
      setStatusOpenId(null);
      setRoleOpenId(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [statusOpenId, roleOpenId]);

  const openRole = useCallback((userId) => {
    if (roleOpenId === userId) { setRoleOpenId(null); return; }
    const btn = roleBtnRefs.current[userId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setRolePos({ top: rect.bottom + 4, left: rect.left });
    }
    setRoleOpenId(userId);
  }, [roleOpenId]);

  const openStatus = useCallback((userId) => {
    if (statusOpenId === userId) { setStatusOpenId(null); return; }
    const btn = statusBtnRefs.current[userId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setStatusPos({ top: rect.bottom + 4, left: rect.left });
    }
    setStatusOpenId(userId);
  }, [statusOpenId]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
    } catch (err) {
      console.error('Role change error:', err);
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
                      <button
                        className={u.role === 'admin'
                          ? `${s.toggleBtn} ${s.toggleBtnWarning}`
                          : s.toggleBtn}
                        ref={el => { roleBtnRefs.current[u.user_id] = el; }}
                        onClick={() => !isSelf && openRole(u.user_id)}
                        disabled={isSelf}
                        title={isSelf ? 'Nie możesz zmienić własnej roli' : ''}
                      >
                        {u.role} {!isSelf && <ChevronDown size={10} />}
                      </button>
                      {roleOpenId === u.user_id && createPortal(
                        <div
                          className={s.optionsDropdownPortal}
                          style={{ top: rolePos.top, left: rolePos.left, minWidth: 75 }}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          {['admin', 'user'].map(role => (
                            <button
                              key={role}
                              className={u.role === role ? s.shareModeMenuItemActive : s.shareModeMenuItem}
                              onClick={() => { handleRoleChange(u.user_id, role); setRoleOpenId(null); }}
                            >
                              {role}
                            </button>
                          ))}
                        </div>,
                        document.body
                      )}
                    </td>
                    <td className={s.tableCell}>
                      <button
                        className={`${s.toggleBtn} ${u.is_active ? s.toggleBtnSuccess : s.toggleBtnDanger}`}
                        ref={el => { statusBtnRefs.current[u.user_id] = el; }}
                        onClick={() => !isSelf && openStatus(u.user_id)}
                        disabled={isSelf}
                        title={isSelf ? 'Nie możesz zablokować siebie' : ''}
                      >
                        {u.is_active ? 'Active' : 'Blocked'}
                        {!isSelf && <ChevronDown size={10} className={statusOpenId === u.user_id ? s.chevronOpen : ''} />}
                      </button>
                      {statusOpenId === u.user_id && createPortal(
                        <div
                          className={s.optionsDropdownPortal}
                          style={{ top: statusPos.top, left: statusPos.left, minWidth: 75 }}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          {['Active', 'Blocked'].map(label => {
                            const isActive = label === 'Active';
                            return (
                              <button
                                key={label}
                                className={u.is_active === isActive ? s.shareModeMenuItemActive : s.shareModeMenuItem}
                                onClick={() => {
                                  if (u.is_active !== isActive) doToggleActive(u.user_id, u.is_active);
                                  setStatusOpenId(null);
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>,
                        document.body
                      )}
                    </td>
                    <td className={`${s.tableCell} ${s.tableCellMono}`}>{boardCount}</td>
                    <td className={`${s.tableCell} ${s.tableCellMono}`}>
                      {new Date(u.created_at).toLocaleDateString('pl-PL', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className={s.tableCellActions}>
                      <div className={s.actionsPanel}>
                        <div className={s.actionsPanelGroup}>
                          <button
                            className={s.btnGhostFixed}
                            onClick={() => navigate(`/admin/users/${u.user_id}/boards`)}
                          >
                            Boardy
                          </button>
                          <button
                            className={s.btnGhostFixed}
                            onClick={() => navigate(`/admin/users/${u.user_id}/purgatory`)}
                          >
                            Czyściec
                          </button>
                        </div>
                        <div className={s.actionsPanelSep} />
                        <div className={s.actionsPanelGroup}>
                          <button
                            className={isSelf ? s.btnDisabled : s.btnInfoFixed}
                            disabled={isSelf}
                            title={isSelf ? 'Nie możesz wylogować siebie' : ''}
                            onClick={() => !isSelf && setSignoutConfirm({ userId: u.user_id, email: u.email })}
                          >
                            Wyloguj
                          </button>
                          <span className={s.tooltipWrapper}>
                            <button className={isSelf ? s.btnDisabled : s.btnDangerFixed} disabled>

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
    </div>
  );
}