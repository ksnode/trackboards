import { useState } from 'react';
import { Checkbox } from './Checkbox';
import { InlineEdit } from './InlineEdit';
import {
  genId, hToHMM, parseHMM, computeParentState,
  cloneTree, findNode, getDepth, findWithParent, MAX_DEPTH,
} from './treeHelpers';
import styles from './BoardFramework.module.css';

export default function BoardFramework({
  boardId,
  data,
  progress,
  onChange,
  readOnly = false,
  canEditStructure = true,
}) {
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState(null);

  const modules = data?.modules || [];
  const statesMap = progress?.states || {};
  const collapsedMap = progress?.collapsed || {};

  // Notify parent of changes
  const emitChange = (newModules, newStates, newCollapsed) => {
    onChange(
      { modules: newModules },
      { states: newStates, collapsed: newCollapsed },
    );
  };

  // ── STATE LOGIC ──────────────────────────────────────────
  const getLeafState = (id) => statesMap[id] || 'todo';

  const getNodeState = (node) => {
    if (!node.children?.length) return getLeafState(node.id);
    const cs = node.children.map(c => getNodeState(c));
    return computeParentState(cs);
  };

  const setSubtreeLeaves = (node, val) => {
    const updates = {};
    const recurse = (n) => {
      if (!n.children?.length) { updates[n.id] = val; return; }
      n.children.forEach(recurse);
    };
    recurse(node);
    return updates;
  };

  const handleNodeClick = (node) => {
    if (readOnly || editMode) return;
    const ns = { ...statesMap };
    if (!node.children?.length) {
      const cur = getLeafState(node.id);
      ns[node.id] = cur === 'todo' ? 'done' : cur === 'done' ? 'skip' : 'todo';
    } else {
      const cur = getNodeState(node);
      const target = cur === 'todo' ? 'done' : cur === 'done' ? 'skip' : 'todo';
      Object.assign(ns, setSubtreeLeaves(node, target));
    }
    emitChange(modules, ns, collapsedMap);
  };

  // ── COLLAPSE ─────────────────────────────────────────────
  const toggleCollapse = (id) => {
    const nc = { ...collapsedMap, [id]: !collapsedMap[id] };
    emitChange(modules, statesMap, nc);
  };

  // ── MODULE OPS ───────────────────────────────────────────
  const updateModules = (m) => {
    emitChange(m, statesMap, collapsedMap);
  };

  const updateModuleField = (moduleId, field, value) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const updates = { [field]: value };
      if (field === 'tag') {
        if (value === 'optional' || value === 'placeholder') updates.tagLabel = '';
        else if (!m.tagLabel || ['Opcjonalne', 'Kiedyś'].includes(m.tagLabel)) updates.tagLabel = 'comment';
      }
      return { ...m, ...updates };
    });
    updateModules(next);
  };

  const addModule = () => {
    const newMod = {
      id: genId(),
      title: 'Nowy kurs',
      color: '#888780',
      tag: 'main',
      tagLabel: 'comment',
      tree: [{ id: genId(), label: 'Nowy krok', hours: 1, children: [] }],
    };
    updateModules([...modules, newMod]);
  };

  const deleteModule = (moduleId) => {
    updateModules(modules.filter(m => m.id !== moduleId));
    setDeleteModuleConfirm(null);
  };

  const moveModule = (moduleId, dir) => {
    const idx = modules.findIndex(m => m.id === moduleId);
    if (idx < 0) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= modules.length) return;
    const next = [...modules];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    updateModules(next);
  };

  // ── NODE OPS ─────────────────────────────────────────────
  const updateNode = (moduleId, nodeId, field, value) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      const found = findNode(tree, nodeId);
      if (found) found[0][field] = field === 'hours' ? parseHMM(value) : value;
      return { ...m, tree };
    });
    updateModules(next);
  };

  const deleteNode = (moduleId, nodeId) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      const remove = (nodes) => {
        const i = nodes.findIndex(n => n.id === nodeId);
        if (i >= 0) { nodes.splice(i, 1); return true; }
        return nodes.some(n => n.children?.length && remove(n.children));
      };
      remove(tree);
      return { ...m, tree };
    });
    updateModules(next);
    setDeleteConfirm(null);
  };

  const addNode = (moduleId, parentId = null) => {
    const newNode = { id: genId(), label: 'Nowy krok', hours: 1, children: [] };
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      if (!parentId) { tree.push(newNode); return { ...m, tree }; }
      const found = findNode(tree, parentId);
      if (found) {
        if (!found[0].children.length) found[0].hours = 0;
        found[0].children.push(newNode);
      }
      return { ...m, tree };
    });
    updateModules(next);
  };

  const moveNode = (moduleId, nodeId, dir) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      const found = findNode(tree, nodeId);
      if (!found) return m;
      const [, siblings, idx] = found;
      const ni = idx + dir;
      if (ni < 0 || ni >= siblings.length) return m;
      [siblings[idx], siblings[ni]] = [siblings[ni], siblings[idx]];
      return { ...m, tree };
    });
    updateModules(next);
  };

  const outdentNode = (moduleId, nodeId) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      const r = findWithParent(tree, nodeId);
      if (!r || !r.parent) return m;
      r.arr.splice(r.idx, 1);
      r.parentArr.splice(r.parentIdx + 1, 0, r.node);
      if (r.parent.children.length === 0) r.parent.hours = 0;
      return { ...m, tree };
    });
    updateModules(next);
  };

  const indentNode = (moduleId, nodeId) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      const found = findNode(tree, nodeId);
      if (!found) return m;
      const [node, siblings, idx] = found;
      if (idx === 0) return m;
      const d = getDepth(tree, nodeId);
      if (d >= MAX_DEPTH) return m;
      const sibling = siblings[idx - 1];
      siblings.splice(idx, 1);
      if (!sibling.children.length) sibling.hours = 0;
      sibling.children.push(node);
      return { ...m, tree };
    });
    updateModules(next);
  };

  // ── STATS ────────────────────────────────────────────────
  // skip = excluded from stats (neither numerator nor denominator)
  // If all leaves are skip (total=0 but leaves exist), show 100%
  const calcStats = () => {
    let mainH = 0, mainDoneH = 0, optH = 0, optDoneH = 0;
    let hasMainLeaves = false, hasOptLeaves = false;
    const processNode = (node, moduleTag) => {
      const isLeaf = !node.children?.length;
      if (isLeaf) {
        const h = node.hours || 0;
        const st = getLeafState(node.id);
        if (moduleTag === 'main') hasMainLeaves = true;
        else if (moduleTag === 'optional') hasOptLeaves = true;
        if (st === 'skip') return;
        if (moduleTag === 'main') {
          mainH += h;
          if (st === 'done') mainDoneH += h;
        } else if (moduleTag === 'optional') {
          optH += h;
          if (st === 'done') optDoneH += h;
        }
      } else {
        node.children.forEach(c => processNode(c, moduleTag));
      }
    };
    modules.forEach(m => {
      if (m.tag !== 'placeholder') m.tree.forEach(n => processNode(n, m.tag));
    });
    return { mainH, mainDoneH, optH, optDoneH, hasMainLeaves, hasOptLeaves };
  };

  const s = calcStats();
  const mainPct = s.mainH > 0 ? Math.round((s.mainDoneH / s.mainH) * 100) : (s.hasMainLeaves ? 100 : 0);
  const optPct = s.optH > 0 ? Math.round((s.optDoneH / s.optH) * 100) : (s.hasOptLeaves ? 100 : 0);
  const allH = s.mainH + s.optH, allDoneH = s.mainDoneH + s.optDoneH;
  const hasAnyLeaves = s.hasMainLeaves || s.hasOptLeaves;
  const allPct = allH > 0 ? Math.round((allDoneH / allH) * 100) : (hasAnyLeaves ? 100 : 0);

  const getModStats = (m) => {
    let total = 0, doneH = 0, rootDone = 0, rootTotal = 0;
    const processNode = (node) => {
      if (!node.children?.length) {
        const st = getLeafState(node.id);
        if (st === 'skip') return;
        total += node.hours || 0;
        if (st === 'done') doneH += node.hours || 0;
      } else {
        node.children.forEach(processNode);
      }
    };
    // Root node counter: skip excluded
    const isRootSkipped = (n) => getNodeState(n) === 'skip';
    m.tree.forEach(n => {
      processNode(n);
      if (!isRootSkipped(n)) {
        rootTotal++;
        if (getNodeState(n) === 'done') rootDone++;
      }
    });
    const hasLeaves = m.tree.some(function check(n) { return !n.children?.length || n.children.some(check); });
    return { pct: total > 0 ? Math.round((doneH / total) * 100) : (hasLeaves ? 100 : 0), done: rootDone, total: rootTotal };
  };

  // ── RENDER NODE ──────────────────────────────────────────
  const renderIconBtn = (label, onClick, danger = false) => (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={danger ? styles.iconBtnDanger : styles.iconBtn}
    >
      {label}
    </button>
  );

  const renderNode = (moduleId, node, color, depth, isPlaceholderMod) => {
    const hasChildren = node.children?.length > 0;
    const nodeState = getNodeState(node);
    const isCollapsedNode = !!collapsedMap[node.id];
    const indent = depth * 24;

    // Pick row class based on state
    let rowClass = styles.nodeRow;
    if (isPlaceholderMod) rowClass = styles.nodeRowPlaceholder;
    else if (editMode || readOnly) rowClass = styles.nodeRowEdit;
    else if (nodeState === 'done') rowClass = styles.nodeRowDone;
    else if (nodeState === 'skip') rowClass = styles.nodeRowSkip;

    // Pick label class
    const isChild = depth > 0;
    let labelClass = isChild
      ? (hasChildren ? styles.nodeLabelParentChild : styles.nodeLabelChild)
      : (hasChildren ? styles.nodeLabelParent : styles.nodeLabel);
    if (nodeState === 'done') labelClass += ' ' + styles.nodeLabelDone;
    else if (nodeState === 'skip') labelClass += ' ' + styles.nodeLabelSkip;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (readOnly || editMode) return;
            if (isPlaceholderMod) return;
            if (hasChildren) { toggleCollapse(node.id); return; }
            handleNodeClick(node);
          }}
          className={rowClass}
          style={{ paddingLeft: 16 + indent }}
        >
          {isPlaceholderMod
            ? <div className={styles.placeholderDot} />
            : <Checkbox
                state={nodeState}
                color={color}
                size={depth === 0 ? 18 : 16}
                onClick={() => !readOnly && !editMode && handleNodeClick(node)}
              />
          }

          {editMode && canEditStructure
            ? <InlineEdit
                value={node.label}
                onChange={v => updateNode(moduleId, node.id, 'label', v)}
                className={isChild ? styles.nodeLabelChild : styles.nodeLabel}
              />
            : <span className={labelClass}>{node.label}</span>
          }

          {editMode && canEditStructure && !hasChildren
            ? <>
                <InlineEdit
                  value={hToHMM(node.hours)}
                  onChange={v => updateNode(moduleId, node.id, 'hours', v)}
                  className={styles.nodeHoursEdit}
                />
                <span className={styles.nodeHoursUnit}>h</span>
              </>
            : (!hasChildren && node.hours > 0)
              ? <span className={styles.nodeHours}>{hToHMM(node.hours)}h</span>
              : null
          }

          {hasChildren && !editMode && (
            <span className={styles.collapseArrow}>{isCollapsedNode ? '▸' : '▾'}</span>
          )}

          {editMode && canEditStructure && !isPlaceholderMod && (
            <div className={styles.nodeEditControls} onClick={e => e.stopPropagation()}>
              {renderIconBtn('↑', () => moveNode(moduleId, node.id, -1))}
              {renderIconBtn('↓', () => moveNode(moduleId, node.id, 1))}
              {depth > 0 && renderIconBtn('←', () => outdentNode(moduleId, node.id))}
              {depth < MAX_DEPTH && renderIconBtn('→', () => indentNode(moduleId, node.id))}
              {depth < MAX_DEPTH && renderIconBtn('+', () => addNode(moduleId, node.id))}
              {renderIconBtn('×', () => setDeleteConfirm({ moduleId, nodeId: node.id, label: node.label }), true)}
            </div>
          )}
        </div>

        {hasChildren && !isCollapsedNode && node.children.map(child =>
          renderNode(moduleId, child, color, depth + 1, isPlaceholderMod)
        )}
      </div>
    );
  };

  // ── EMPTY STATE ──────────────────────────────────────────
  if (modules.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.emptyState}>
          <span className={styles.emptyText}>Ten board jest pusty</span>
          {!readOnly && canEditStructure && (
            <button className={styles.emptyAddBtn} onClick={addModule}>
              + Dodaj pierwszy kurs
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── MAIN RENDER ──────────────────────────────────────────
  const globalRows = [
    { label: 'Główne', doneH: s.mainDoneH, totalH: s.mainH, pct: mainPct, barColor: '#639922' },
    { label: 'Opcjonalne', doneH: s.optDoneH, totalH: s.optH, pct: optPct, barColor: '#BA7517' },
    { label: 'Całość', doneH: allDoneH, totalH: allH, pct: allPct, barColor: '#4A90D9' },
  ];

  return (
    <div className={styles.root}>
      {/* Delete node confirm */}
      {deleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <p className={styles.modalText}>Usunąć krok i wszystkie podpunkty?</p>
            <p className={styles.modalSubtext}>„{deleteConfirm.label}"</p>
            <div className={styles.modalActions}>
              <button onClick={() => setDeleteConfirm(null)} className={styles.modalCancelBtn}>Anuluj</button>
              <button onClick={() => deleteNode(deleteConfirm.moduleId, deleteConfirm.nodeId)} className={styles.modalDeleteBtn}>Usuń</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete module confirm */}
      {deleteModuleConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <p className={styles.modalText}>Usunąć cały kurs?</p>
            <p className={styles.modalSubtext}>„{deleteModuleConfirm.title}" — ta operacja jest nieodwracalna.</p>
            <div className={styles.modalActions}>
              <button onClick={() => setDeleteModuleConfirm(null)} className={styles.modalCancelBtn}>Anuluj</button>
              <button onClick={() => deleteModule(deleteModuleConfirm.id)} className={styles.modalDeleteBtn}>Usuń kurs</button>
            </div>
          </div>
        </div>
      )}

      {/* Global progress header */}
      <div className={styles.globalHeader}>
        {globalRows.map((row, idx) => (
          <div key={row.label} className={idx === 2 ? styles.globalRowLast : styles.globalRow}>
            <span className={idx === 2 ? styles.globalRowLabelBold : styles.globalRowLabel}>{row.label}</span>
            <div className={styles.progressBarTrack}>
              <div className={styles.progressBarFill} style={{ width: `${row.pct}%`, background: row.barColor }} />
            </div>
            <span className={styles.globalPct}>{row.pct}%</span>
            <span className={styles.globalHours}>{hToHMM(row.doneH)}h / {hToHMM(row.totalH)}h</span>
          </div>
        ))}
      </div>

      {/* Modules */}
      {modules.map((module) => {
        const isPlaceholder = module.tag === 'placeholder';
        const isOptional = module.tag === 'optional';
        const isCollapsedMod = !!collapsedMap[module.id];
        const { pct, done, total } = getModStats(module);

        const headerClass = editMode
          ? styles.moduleHeaderEdit
          : isCollapsedMod
            ? styles.moduleHeaderCollapsed
            : styles.moduleHeader;

        return (
          <div key={module.id} className={isPlaceholder ? styles.moduleCardPlaceholder : styles.moduleCard}>
            <div
              onClick={() => !editMode && !readOnly && toggleCollapse(module.id)}
              className={headerClass}
            >
              {/* Color dot / picker */}
              {editMode && canEditStructure
                ? <label className={styles.moduleColorPicker} style={{ background: module.color }} title="Zmień kolor">
                    <input
                      type="color"
                      value={module.color}
                      onChange={e => updateModuleField(module.id, 'color', e.target.value)}
                      className={styles.moduleColorInput}
                    />
                  </label>
                : <div className={styles.moduleColorDot} style={{ background: module.color }} />
              }

              {/* Title */}
              {editMode && canEditStructure
                ? <InlineEdit
                    value={module.title}
                    onChange={v => updateModuleField(module.id, 'title', v)}
                    className={styles.moduleTitleInlineEdit}
                  />
                : <span className={styles.moduleTitle}>
                    {module.title}
                    {isOptional && <span className={styles.moduleTagBadge}> (opcjonalne)</span>}
                    {isPlaceholder && <span className={styles.moduleTagBadge}> (placeholder)</span>}
                  </span>
              }

              {/* Tag controls (edit) / Tag label (view) */}
              {editMode && canEditStructure ? (
                <div className={styles.moduleEditControls} onClick={e => e.stopPropagation()}>
                  {module.tag === 'main' && (
                    <InlineEdit
                      value={module.tagLabel || 'comment'}
                      onChange={v => updateModuleField(module.id, 'tagLabel', v)}
                      className={styles.nodeHours}
                    />
                  )}
                  <select
                    value={module.tag}
                    onChange={e => updateModuleField(module.id, 'tag', e.target.value)}
                    className={styles.moduleTagSelect}
                  >
                    <option value="main">main</option>
                    <option value="optional">optional</option>
                    <option value="placeholder">placeholder</option>
                  </select>
                </div>
              ) : (
                module.tag === 'main' && module.tagLabel && (
                  <span className={styles.moduleTagLabel}>{module.tagLabel}</span>
                )
              )}

              {/* Module controls (edit mode) */}
              {editMode && canEditStructure && (
                <div className={styles.nodeEditControls} onClick={e => e.stopPropagation()}>
                  {renderIconBtn('↑', () => moveModule(module.id, -1))}
                  {renderIconBtn('↓', () => moveModule(module.id, 1))}
                  {renderIconBtn('×', () => setDeleteModuleConfirm({ id: module.id, title: module.title }), true)}
                </div>
              )}

              {/* Module stats (view) */}
              {!isPlaceholder && !editMode && <span className={styles.moduleStats}>{done}/{total}</span>}
              {!isPlaceholder && !editMode && (
                <div className={styles.moduleProgressBar}>
                  <div className={styles.moduleProgressFill} style={{ width: `${pct}%`, background: module.color }} />
                </div>
              )}
              {!isPlaceholder && !editMode && <span className={styles.modulePct}>{pct}%</span>}
              {!editMode && <span className={styles.collapseArrow}>{isCollapsedMod ? '▸' : '▾'}</span>}
            </div>

            {!isCollapsedMod && (
              <div className={styles.moduleBody}>
                {module.tree.map(node => renderNode(module.id, node, module.color, 0, isPlaceholder))}
                {editMode && canEditStructure && !isPlaceholder && (
                  <div className={styles.addStepRow}>
                    <button onClick={() => addNode(module.id)} className={styles.addStepBtn}>+ Dodaj krok</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add module button (edit mode) */}
      {editMode && canEditStructure && (
        <div className={styles.addModuleWrapper}>
          <button onClick={addModule} className={styles.addModuleBtn}>+ Dodaj kurs</button>
        </div>
      )}

      {/* Footer with edit toggle */}
      {!readOnly && (
        <div className={styles.footer}>
          Postęp zapisywany automatycznie · Kliknij nagłówek modułu aby zwinąć ·{' '}
          {canEditStructure && (
            <span
              onClick={() => setEditMode(e => !e)}
              className={editMode ? styles.editToggleActive : styles.editToggle}
            >
              {editMode ? '✓ Zakończ edycję' : 'Kliknij TU, żeby edytować'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
