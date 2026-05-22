import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useHeader } from '../lib/headerContext';
import {
  listUsers, updateUserRole, updateUserStatus, forceSignOutUser,
  hardDeleteUser, removeUser, reassignAllBoards,
} from '../lib/boards';
import { ChevronDown } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import pageStyles from '../components/Layout/PageContent.module.css';
import s from './ProfileAdmin.module.css';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', btnClass: 'toggleBtnSuccess' },
  { value: 'blocked', label: 'Blocked', btnClass: 'toggleBtnDanger' },
  { value: 'soft_deleted', label: 'Soft deleted', btnClass: 'toggleBtnWarning' },
  { value: 'hard_deleted', label: 'Hard deleted', btnClass: '' },
];

const FILTER_KEY = 'trackboards_admin_filter';
function loadFilter() {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return JSON.parse(raw);
  } catch { }
  return ['active', 'blocked'];
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { setHeader } = useHeader();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signoutConfirm, setSignoutConfirm] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  // Filter
  const [statusFilter, setStatusFilter] = useState(loadFilter);

  // Role dropdown (portal)
  const [roleOpenId, setRoleOpenId] = useState(null);
  const [rolePos, setRolePos] = useState({ top: 0, left: 0 });
  const roleBtnRefs = useRef({});
  // Status dropdown (portal)
  const [statusOpenId, setStatusOpenId] = useState(null);
  const [statusPos, setStatusPos] = useState({ top: 0, left: 0 });
  const statusBtnRefs = useRef({});
  // Delete dropdown (portal)
  const [deleteOpenId, setDeleteOpenId] = useState(null);
  const [deletePos, setDeletePos] = useState({ top: 0, left: 0 });
  const deleteBtnRefs = useRef({});

  // Confirm modals
  const [softDeleteConfirm, setSoftDeleteConfirm] = useState(null);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState(null);
  const [removeConfirm, setRemoveConfirm] = useState(null);


  // Reassign modal
  const [reassignModal, setReassignModal] = useState(null);
  const [reassignSearch, setReassignSearch] = useState('');
  const [reassignSelected, setReassignSelected] = useState(null);

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

  // Save filter to localStorage
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(statusFilter));
  }, [statusFilter]);

  // Close portals on outside click
  useEffect(() => {
    if (!statusOpenId && !roleOpenId && !deleteOpenId) return;
    const handler = () => {
      setStatusOpenId(null);
      setRoleOpenId(null);
      setDeleteOpenId(null);
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [statusOpenId, roleOpenId, deleteOpenId]);

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

  const openDelete = useCallback((userId) => {
    if (deleteOpenId === userId) { setDeleteOpenId(null); return; }
    const btn = deleteBtnRefs.current[userId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDeletePos({ top: rect.bottom + 4, left: rect.right - 180 });
    }
    setDeleteOpenId(userId);
  }, [deleteOpenId]);

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

  const handleStatusChange = async (userId, newStatus) => {
    try {
      await updateUserStatus(userId, newStatus);
      if (newStatus === 'blocked' || newStatus === 'soft_deleted') {
        try { await forceSignOutUser(userId); } catch (err) {
          console.error('Force signout error:', err);
        }
      }
      setUsers(prev => prev.map(u =>
        u.user_id === userId ? { ...u, status: newStatus } : u
      ));
    } catch (err) {
      console.error('Status change error:', err);
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

  const handleSoftDelete = async () => {
    if (!softDeleteConfirm) return;
    try {
      await updateUserStatus(softDeleteConfirm.userId, 'soft_deleted');
      setUsers(prev => prev.map(u =>
        u.user_id === softDeleteConfirm.userId ? { ...u, status: 'soft_deleted' } : u
      ));
    } catch (err) {
      console.error('Soft delete error:', err);
    } finally {
      setSoftDeleteConfirm(null);
    }
  };

  const handleHardDelete = async () => {
    if (!hardDeleteConfirm) return;
    try {
      await hardDeleteUser(hardDeleteConfirm.userId, hardDeleteConfirm.email);
      setUsers(prev => prev.map(u =>
        u.user_id === hardDeleteConfirm.userId ? { ...u, status: 'hard_deleted', email: '(zamaskowany)' } : u
      ));
    } catch (err) {
      console.error('Hard delete error:', err);
    } finally {
      setHardDeleteConfirm(null);
    }
  };

  const handleRemove = async () => {
    if (!removeConfirm) return;
    try {
      await removeUser(removeConfirm.userId);
      setUsers(prev => prev.filter(u => u.user_id !== removeConfirm.userId));
    } catch (err) {
      console.error('Remove error:', err);
    } finally {
      setRemoveConfirm(null);
    }
  };

  const handleReassign = async () => {
    if (!reassignModal || !reassignSelected) return;
    try {
      await reassignAllBoards(reassignModal.userId, reassignSelected.userId);
      window.dispatchEvent(new Event('boardsUpdated'));
    } catch (err) {
      console.error('Reassign error:', err);
    } finally {
      setReassignModal(null);
      setReassignSelected(null);
      setReassignSearch('');
    }
  };

  const getBoardCount = (u) => {
    if (Array.isArray(u.boards) && u.boards.length > 0) return u.boards[0].count ?? 0;
    return 0;
  };

  const toggleFilter = (value) => {
    setStatusFilter(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  if (loading) return <div className={s.loading}>Ładowanie...</div>;

  const filteredUsers = users
    .filter(u => statusFilter.includes(u.status || 'active'))
    .filter(u => u.email.toLowerCase().includes(searchQuery.toLowerCase()));

  const reassignFilteredUsers = users.filter(u =>
    (u.status === 'active') && u.email.toLowerCase().includes(reassignSearch.toLowerCase())
  );

  const getStatusOption = (status) => STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];

  return (
    <div className={pageStyles.root}>
      <div className={s.breadcrumb}>
        <Link to="/admin" className={s.breadcrumbLink}>Admin</Link>
        <span className={s.breadcrumbSep}>›</span>
        <span className={s.breadcrumbCurrent}>Użytkownicy</span>
      </div>

      {/* Filters */}
      <div className={s.filterRow}>
        <input
          type="text"
          className={s.searchInput}
          placeholder="Szukaj po emailu..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ marginBottom: 0 }}
        />
        <div className={s.filterChecks}>
          {STATUS_OPTIONS.map(opt => (
            <label key={opt.value} className={s.filterCheckLabel}>
              <input
                type="checkbox"
                checked={statusFilter.includes(opt.value)}
                onChange={() => toggleFilter(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className={s.emptyState}>
          {users.length === 0 ? 'Brak użytkowników' : 'Brak użytkowników pasujących do filtrów'}
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
                const statusOpt = getStatusOption(u.status);
                const isHardDeleted = u.status === 'hard_deleted';
                const isSoftDeleted = u.status === 'soft_deleted';
                const isActiveOrBlocked = u.status === 'active' || u.status === 'blocked';
                return (
                  <tr key={u.user_id} className={s.tableRow}>
                    <td className={s.tableCell}>{u.email}</td>
                    <td className={s.tableCell}>
                      {isHardDeleted ? (
                        <button className={s.toggleBtn} disabled style={{ opacity: 0.5 }}>
                          deleted
                        </button>
                      ) : (
                        <>
                          <button
                            className={u.role === 'admin'
                              ? `${s.toggleBtn} ${s.toggleBtnInfo}`
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
                        </>
                      )}
                    </td>
                    <td className={s.tableCell}>
                      <button
                        className={`${s.toggleBtn} ${statusOpt.btnClass ? s[statusOpt.btnClass] : ''}`}
                        ref={el => { statusBtnRefs.current[u.user_id] = el; }}
                        onClick={() => !isSelf && !isHardDeleted && openStatus(u.user_id)}
                        disabled={isSelf || isHardDeleted}
                        title={isSelf ? 'Nie możesz zmienić własnego statusu' : isHardDeleted ? 'Konto trwale usunięte' : ''}
                      >
                        {statusOpt.label}
                        {!isSelf && !isHardDeleted && <ChevronDown size={10} className={statusOpenId === u.user_id ? s.chevronOpen : ''} />}
                      </button>
                      {statusOpenId === u.user_id && createPortal(
                        <div
                          className={s.optionsDropdownPortal}
                          style={{ top: statusPos.top, left: statusPos.left, minWidth: 100 }}
                          onMouseDown={e => e.stopPropagation()}
                        >
                          {STATUS_OPTIONS.filter(o => o.value !== 'hard_deleted' && o.value !== 'soft_deleted').map(opt => (
                            <button
                              key={opt.value}
                              className={u.status === opt.value ? s.shareModeMenuItemActive : s.shareModeMenuItem}
                              onClick={() => {
                                if (u.status !== opt.value) handleStatusChange(u.user_id, opt.value);
                                setStatusOpenId(null);
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
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
                          {isActiveOrBlocked && (
                            <button
                              className={isSelf ? s.btnDisabled : s.btnInfoFixed}
                              disabled={isSelf}
                              title={isSelf ? 'Nie możesz wylogować siebie' : ''}
                              onClick={() => !isSelf && setSignoutConfirm({ userId: u.user_id, email: u.email })}
                            >
                              Wyloguj
                            </button>
                          )}
                          {(isSoftDeleted || isHardDeleted) && (
                            <button
                              className={s.btnInfoFixed}
                              onClick={() => {
                                setReassignModal({ userId: u.user_id, email: u.email });
                                setReassignSelected(null);
                                setReassignSearch('');
                              }}
                            >
                              Przepisz
                            </button>
                          )}
                          {/* Delete dropdown */}
                          <button
                            className={isSelf ? s.btnDisabled : s.btnDangerFixed}
                            ref={el => { deleteBtnRefs.current[u.user_id] = el; }}
                            disabled={isSelf}
                            onClick={() => !isSelf && openDelete(u.user_id)}
                          >
                            Usuń… <ChevronDown size={10} className={deleteOpenId === u.user_id ? s.chevronOpen : ''} />
                          </button>
                          {deleteOpenId === u.user_id && createPortal(
                            <div
                              className={s.optionsDropdownPortal}
                              style={{ top: deletePos.top, left: deletePos.left, minWidth: 160 }}
                              onMouseDown={e => e.stopPropagation()}
                            >
                              {isActiveOrBlocked && (
                                <button
                                  className={s.optionsItem}
                                  onClick={() => {
                                    setSoftDeleteConfirm({ userId: u.user_id, email: u.email });
                                    setDeleteOpenId(null);
                                  }}
                                >
                                  Soft delete
                                </button>
                              )}
                              {!isHardDeleted && (
                                <button
                                  className={s.optionsItem}
                                  onClick={() => {
                                    setHardDeleteConfirm({ userId: u.user_id, email: u.email });
                                    setDeleteOpenId(null);
                                  }}
                                >
                                  Hard delete
                                </button>
                              )}
                              <div className={s.optionsSep} />
                              <button
                                className={s.optionsItemDanger}
                                onClick={() => {
                                  setRemoveConfirm({ userId: u.user_id, email: u.email });
                                  /*setRemoveInput('');*/
                                  setDeleteOpenId(null);
                                }}
                              >
                                Remove
                              </button>
                            </div>,
                            document.body
                          )}
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

      {/* Soft delete confirm */}
      <ConfirmModal
        open={!!softDeleteConfirm}
        title="Dezaktywować konto?"
        description="Konto zostanie dezaktywowane. User może się zalogować żeby reaktywować."
        cancelLabel="Anuluj"
        confirmLabel="Dezaktywuj"
        variant="danger"
        onCancel={() => setSoftDeleteConfirm(null)}
        onConfirm={handleSoftDelete}
      />

      {/* Hard delete confirm */}
      <ConfirmModal
        open={!!hardDeleteConfirm}
        title="Hard delete konta?"
        description="Email zostanie zamaskowany. Operacja nieodwracalna."
        cancelLabel="Anuluj"
        confirmLabel="Hard delete"
        variant="danger"
        onCancel={() => setHardDeleteConfirm(null)}
        onConfirm={handleHardDelete}
      />

      {/* Remove confirm */}
      <ConfirmModal
        open={!!removeConfirm}
        title="Usunąć konto na zawsze?"
        description="Tej operacji nie można cofnąć."
        cancelLabel="Anuluj"
        confirmLabel="Usuń na zawsze"
        variant="danger"
        onCancel={() => setRemoveConfirm(null)}
        onConfirm={handleRemove}
      />

      {/* Reassign modal */}
      <ConfirmModal
        open={!!reassignModal}
        title="Przepisz wszystkie boardy"
        description={reassignModal ? `Z: ${reassignModal.email}` : ''}
        cancelLabel="Anuluj"
        confirmLabel="Przepisz"
        variant="primary"
        disabled={!reassignSelected}
        onCancel={() => { setReassignModal(null); setReassignSelected(null); setReassignSearch(''); }}
        onConfirm={handleReassign}
      >
        <input
          type="text"
          className={s.userPickerSearch}
          placeholder="Szukaj po emailu…"
          value={reassignSearch}
          onChange={(e) => { setReassignSearch(e.target.value); setReassignSelected(null); }}
          autoFocus
          style={{ borderRadius: 'var(--border-radius-md)', border: '1px solid var(--color-border-primary)', marginBottom: 'var(--space-2)' }}
        />
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          {reassignFilteredUsers.length === 0 ? (
            <div className={s.userPickerEmpty}>Brak wyników</div>
          ) : (
            reassignFilteredUsers.map(u => (
              <button
                key={u.user_id}
                className={s.userPickerItem}
                style={reassignSelected?.userId === u.user_id
                  ? { background: 'var(--color-accent)', color: 'white' }
                  : {}}
                onClick={() => setReassignSelected({ userId: u.user_id, email: u.email })}
              >
                {u.email}
              </button>
            ))
          )}
        </div>
        {reassignSelected && (
          <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--font-size-sm)', color: 'var(--color-accent)' }}>
            Do: {reassignSelected.email}
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}