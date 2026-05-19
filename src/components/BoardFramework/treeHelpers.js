export const MAX_DEPTH = 2; // 0=root, 1=child, 2=grandchild

export function genId() {
  return "s-" + Math.random().toString(36).slice(2, 8);
}

export function hToHMM(h) {
  if (!h && h !== 0) return "0:00";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

export function parseHMM(s) {
  s = String(s).trim();
  if (s.includes(":")) {
    const [h, m] = s.split(":").map(Number);
    return (h || 0) + (m || 0) / 60;
  }
  return parseFloat(s) || 0;
}

export function computeParentState(childStates) {
  const all = childStates.length;
  if (!all) return "todo";
  const doneCount = childStates.filter(s => s === "done").length;
  const skipCount = childStates.filter(s => s === "skip").length;
  const todoCount = childStates.filter(s => s === "todo").length;
  if (doneCount === all) return "done";
  if (skipCount === all) return "skip";
  if (todoCount === all) return "todo";
  if (doneCount + skipCount === all) return "done";
  return "partial";
}

export function cloneTree(nodes) {
  return JSON.parse(JSON.stringify(nodes));
}

export function findNode(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return [nodes[i], nodes, i];
    if (nodes[i].children?.length) {
      const found = findNode(nodes[i].children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getDepth(nodes, targetId, d = 0) {
  for (const n of nodes) {
    if (n.id === targetId) return d;
    if (n.children?.length) {
      const r = getDepth(n.children, targetId, d + 1);
      if (r >= 0) return r;
    }
  }
  return -1;
}

export function findWithParent(nodes, targetId, parent = null, parentArr = null, parentIdx = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === targetId) return { node: nodes[i], arr: nodes, idx: i, parent, parentArr, parentIdx };
    if (nodes[i].children?.length) {
      const r = findWithParent(nodes[i].children, targetId, nodes[i], nodes, i);
      if (r) return r;
    }
  }
  return null;
}
