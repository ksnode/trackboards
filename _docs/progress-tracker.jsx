import { useState, useEffect } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const MAX_DEPTH = 2; // 0=root, 1=child, 2=grandchild
const STORAGE_KEY = "devops-progress-v6";
const DATA_KEY = "devops-curriculum-v4";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function genId() { return "s-" + Math.random().toString(36).slice(2, 8); }

function hToHMM(h) {
  if (!h && h !== 0) return "0:00";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, "0")}`;
}
function parseHMM(s) {
  s = String(s).trim();
  if (s.includes(":")) { const [h, m] = s.split(":").map(Number); return (h || 0) + (m || 0) / 60; }
  return parseFloat(s) || 0;
}

// ─── TREE HELPERS ─────────────────────────────────────────────────────────────
function computeParentState(childStates) {
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

function cloneTree(nodes) { return JSON.parse(JSON.stringify(nodes)); }

function findNode(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === id) return [nodes[i], nodes, i];
    if (nodes[i].children?.length) {
      const found = findNode(nodes[i].children, id);
      if (found) return found;
    }
  }
  return null;
}

function getDepth(nodes, targetId, d = 0) {
  for (const n of nodes) {
    if (n.id === targetId) return d;
    if (n.children?.length) { const r = getDepth(n.children, targetId, d + 1); if (r >= 0) return r; }
  }
  return -1;
}

function findWithParent(nodes, targetId, parent = null, parentArr = null, parentIdx = null) {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].id === targetId) return { node: nodes[i], arr: nodes, idx: i, parent, parentArr, parentIdx };
    if (nodes[i].children?.length) {
      const r = findWithParent(nodes[i].children, targetId, nodes[i], nodes, i);
      if (r) return r;
    }
  }
  return null;
}

// ─── CURRICULUM DATA ──────────────────────────────────────────────────────────
const curriculumDefault = [
  { id: "git-basics", title: "Git & GitHub — Basics", color: "#E24B4A", tag: "main", tagLabel: "5-6 maja — 1-2 dni",
    tree: [
      { id: "git-b1", label: "Instalacja Git + konto GitHub (ksnode)", hours: 0.5, children: [] },
      { id: "git-b2", label: "Konfiguracja Git (user.name, user.email, private email)", hours: 0.25, children: [] },
      { id: "git-b3", label: "Pierwsze repo — init, add, commit, push", hours: 0.5, children: [] },
      { id: "git-b4", label: "Clone istniejącego repo, pull, status, log", hours: 0.5, children: [] },
      { id: "git-b5", label: "Pierwsze pliki .tf wrzucone na GitHub", hours: 0.25, children: [] },
    ]},
  { id: "terraform-cert", title: "Terraform Associate 004 — Certyfikat", color: "#7F77DD", tag: "main", tagLabel: "7-31 maja — 3 tygodnie",
    tree: [
      { id: "tf-cert-1", label: "Instalacja Terraform CLI na Windows/WSL2", hours: 0.5, children: [] },
      { id: "tf-cert-2", label: "Sekcja 1 — Introduction (53min)", hours: 1, children: [] },
      { id: "tf-cert-3", label: "Sekcja 2 — Getting Started & Setting Up Labs (53min)", hours: 1, children: [] },
      { id: "tf-cert-4", label: "Sekcja 3 — Deploying Infrastructure with Terraform (2h 5min)", hours: 2, children: [] },
      { id: "tf-cert-5", label: "Sekcja 4 — Read, Generate, Modify Configurations (10h 9min)", hours: 10, children: [] },
      { id: "tf-cert-6", label: "Sekcja 5 — Terraform Provisioners (56min)", hours: 1, children: [] },
      { id: "tf-cert-7", label: "Sekcja 6 — Terraform Modules & Workspaces (2h 17min)", hours: 2, children: [] },
      { id: "tf-cert-8", label: "Sekcja 7 — Remote State Management (2h 4min)", hours: 2, children: [] },
      { id: "tf-cert-9", label: "Sekcja 8 — Security Primer (1h 6min)", hours: 1, children: [] },
      { id: "tf-cert-10", label: "Sekcja 9 — Terraform Cloud & Enterprise Capabilities (1h 58min)", hours: 2, children: [] },
      { id: "tf-cert-11", label: "Sekcja 10 — Terraform Challenges (1h 34min)", hours: 1.5, children: [] },
      { id: "tf-cert-12", label: "Sekcja 11 — Exam Preparation Section (1h 33min)", hours: 1.5, children: [] },
      { id: "tf-cert-13", label: "Powtórka błędów i słabych obszarów", hours: 2, children: [] },
      { id: "tf-cert-14", label: "Egzamin Terraform Associate 004 (~$70)", hours: 1, children: [] },
      { id: "tf-cert-15", label: "Dodaj do CV i LinkedIn", hours: 0.5, children: [] },
    ]},
  { id: "sc-730", title: "SC-730 — Cybersecurity Business Professional (beta)", color: "#1A6B9A", tag: "main", tagLabel: "27 maja",
    tree: [
      { id: "sc-730-1", label: "Egzamin SC-730 beta (27 maja)", hours: 1, children: [] },
      { id: "sc-730-2", label: "Dodaj do LinkedIn", hours: 0, children: [] },
    ]},
  { id: "umiejetnosci-jutra", title: "Umiejętności Jutra 3.0 (w tle)", color: "#2E8B57", tag: "main", tagLabel: "W tle",
    tree: [
      { id: "uj-w1", label: "Tydzień 1 — Fundamenty AI i produktywność osobista", hours: 0, children: [
        { id: "uj-w1-webinar", label: "Webinar", hours: 1, children: [] },
        { id: "uj-w1-obow", label: "Obowiązkowe (4:30h)", hours: 4.5, children: [] },
        { id: "uj-w1-nieobow", label: "Nieobowiązkowe (0:15h)", hours: 0.25, children: [] },
      ]},
      { id: "uj-w2", label: "Tydzień 2 — Tworzenie treści i rozwój biznesu z AI", hours: 0, children: [
        { id: "uj-w2-webinar", label: "Webinar", hours: 1, children: [] },
        { id: "uj-w2-obow", label: "Obowiązkowe (4:30h)", hours: 4.5, children: [] },
        { id: "uj-w2-nieobow", label: "Nieobowiązkowe (4:30h)", hours: 4.5, children: [] },
      ]},
      { id: "uj-w3", label: "Tydzień 3 — Automatyzacja pracy z asystentami i agentami AI", hours: 0, children: [
        { id: "uj-w3-webinar", label: "Webinar", hours: 1, children: [] },
        { id: "uj-w3-obow", label: "Obowiązkowe (1:30h)", hours: 1.5, children: [] },
        { id: "uj-w3-nieobow", label: "Nieobowiązkowe (4:00h)", hours: 4, children: [] },
      ]},
      { id: "uj-w4", label: "Tydzień 4 — Decyzje oparte na danych i planowanie wdrożeń AI", hours: 0, children: [
        { id: "uj-w4-webinar", label: "Webinar", hours: 1, children: [] },
        { id: "uj-w4-obow", label: "Obowiązkowe (TBC)", hours: 2, children: [] },
        { id: "uj-w4-nieobow", label: "Nieobowiązkowe (TBC)", hours: 0, children: [] },
      ]},
      { id: "uj-w5", label: "Tydzień 5 — Transformacja i zarządzanie projektami AI", hours: 0, children: [
        { id: "uj-w5-webinar", label: "Webinar", hours: 1, children: [] },
        { id: "uj-w5-obow", label: "Obowiązkowe (TBC)", hours: 2, children: [] },
        { id: "uj-w5-nieobow", label: "Nieobowiązkowe (TBC)", hours: 0, children: [] },
      ]},
      { id: "uj-final", label: "Finał", hours: 0, children: [
        { id: "uj-podsumowanie", label: "Podsumowanie", hours: 1, children: [] },
        { id: "uj-egzamin", label: "Egzamin", hours: 1, children: [] },
      ]},
    ]},
  { id: "git-advanced", title: "Git & GitHub — Advanced", color: "#C03535", tag: "optional", tagLabel: "",
    tree: [
      { id: "git-a1", label: "learngitbranching.js.org — poziomy 1–8", hours: 3, children: [] },
      { id: "git-a2", label: "GitHub Skills — Introduction to GitHub", hours: 2, children: [] },
      { id: "git-a3", label: "Branching, PRs, merge conflicts", hours: 2, children: [] },
      { id: "git-a4", label: "GitHub Actions — podstawowy CI/CD pipeline", hours: 2, children: [] },
    ]},
  { id: "gh-900", title: "GH-900 — GitHub Foundations", color: "#444444", tag: "optional", tagLabel: "",
    tree: [
      { id: "gh-900-1", label: "Microsoft Learn — GitHub Foundations learning path", hours: 4, children: [] },
      { id: "gh-900-2", label: "Practice testy", hours: 1, children: [] },
      { id: "gh-900-3", label: "Egzamin GH-900 (~$59 USD w Polsce)", hours: 1, children: [] },
      { id: "gh-900-4", label: "Dodaj do LinkedIn", hours: 0, children: [] },
    ]},
  { id: "ai-901", title: "AI-901 — Azure AI Fundamentals", color: "#0078D4", tag: "optional", tagLabel: "",
    tree: [
      { id: "ai-901-1", label: "John Savill — AI-901 Study Cram (YouTube, ~1h)", hours: 1, children: [] },
      { id: "ai-901-2", label: "Microsoft Learn — Course AI-901T00", hours: 3, children: [] },
      { id: "ai-901-3", label: "Egzamin AI-901 (~$59 USD w Polsce)", hours: 1, children: [] },
      { id: "ai-901-4", label: "Dodaj do LinkedIn", hours: 0, children: [] },
    ]},
  { id: "docker", title: "Docker", color: "#1D9E75", tag: "main", tagLabel: "Czerwiec",
    tree: [
      { id: "docker-1", label: "Instalacja Docker Desktop + WSL2", hours: 0.5, children: [] },
      { id: "docker-2", label: "Udemy — sekcje 1–3 (overview, komendy)", hours: 1.5, children: [] },
      { id: "docker-3", label: "Udemy — sekcje 4–5 (images, Dockerfile)", hours: 1.5, children: [] },
      { id: "docker-4", label: "Udemy — sekcje 6–7 (volumes, networking)", hours: 1.5, children: [] },
      { id: "docker-5", label: "Udemy — Docker Compose", hours: 1, children: [] },
      { id: "docker-6", label: "Praktyka — własny Dockerfile od zera", hours: 2, children: [] },
      { id: "docker-7", label: "Praktyka — multi-container Compose stack", hours: 3, children: [] },
      { id: "docker-8", label: "Portfolio projekt — push na GitHub z README", hours: 4, children: [] },
    ]},
  { id: "k8s", title: "Kubernetes", color: "#BA7517", tag: "main", tagLabel: "Czerwiec/Lipiec",
    tree: [
      { id: "k8s-1", label: "Włącz Kubernetes w Docker Desktop", hours: 0.5, children: [] },
      { id: "k8s-2", label: "Udemy — sekcje 1–3 (overview, pods)", hours: 2, children: [] },
      { id: "k8s-3", label: "Udemy — sekcje 4–5 (deployments, services)", hours: 2, children: [] },
      { id: "k8s-4", label: "Udemy — sekcje 6–7 (storage, config)", hours: 2, children: [] },
      { id: "k8s-5", label: "kubectl hands-on — deploy, scale, rollback", hours: 3, children: [] },
      { id: "k8s-6", label: "Praktyka — deploy Docker projektu na lokalny K8s", hours: 4, children: [] },
      { id: "k8s-7", label: "Helm basics — instalacja chart, explore values", hours: 3, children: [] },
    ]},
  { id: "ansible", title: "Ansible", color: "#D85A30", tag: "main", tagLabel: "Lipiec",
    tree: [
      { id: "ans-1", label: "Udemy — inventory, playbooks, modules basics", hours: 2.5, children: [] },
      { id: "ans-2", label: "Variables, conditionals, loops", hours: 1.5, children: [] },
      { id: "ans-3", label: "Roles and templates", hours: 2, children: [] },
      { id: "ans-4", label: "Praktyka — automate server config with playbook", hours: 2, children: [] },
    ]},
  { id: "clf", title: "AWS CLF-C02 — Cloud Practitioner", color: "#854F0B", tag: "main", tagLabel: "Lipiec",
    tree: [
      { id: "clf-1", label: "Kurs Stephane Maarek Udemy — CLF-C02", hours: 6, children: [] },
      { id: "clf-2", label: "Practice testy — minimum 2 pełne testy", hours: 3, children: [] },
      { id: "clf-3", label: "Powtórka błędów i słabych obszarów", hours: 2, children: [] },
      { id: "clf-4", label: "Egzamin CLF-C02 (~$100) → voucher 50% na SAA", hours: 0.5, children: [] },
    ]},
  { id: "saa", title: "AWS SAA-C03 — Solutions Architect", color: "#0C447C", tag: "main", tagLabel: "Sierpień",
    tree: [
      { id: "saa-1", label: "Kurs Stephane Maarek Udemy — SAA-C03", hours: 18, children: [] },
      { id: "saa-2", label: "Practice testy — minimum 4-6 pełnych testów", hours: 8, children: [] },
      { id: "saa-3", label: "Powtórka — EC2, S3, VPC, IAM, RDS, Lambda", hours: 5, children: [] },
      { id: "saa-4", label: "Egzamin SAA-C03 (~$75 z voucherem)", hours: 0.5, children: [] },
      { id: "saa-5", label: "Dodaj do CV i LinkedIn", hours: 0.5, children: [] },
    ]},
  { id: "cka", title: "CKA — Certified Kubernetes Administrator", color: "#0F6E56", tag: "main", tagLabel: "Po sierpniu",
    tree: [
      { id: "cka-1", label: "KodeKloud CKA course (Mumshad)", hours: 15, children: [] },
      { id: "cka-2", label: "Hands-on labs — killer.sh lub KodeKloud", hours: 20, children: [] },
      { id: "cka-3", label: "Practice exams — minimum 2 full mock exams", hours: 10, children: [] },
      { id: "cka-4", label: "Egzamin CKA (~$395)", hours: 2, children: [] },
      { id: "cka-5", label: "Dodaj do CV i LinkedIn", hours: 0.5, children: [] },
    ]},
  { id: "az-104", title: "AZ-104 — Azure Administrator Associate", color: "#0078D4", tag: "placeholder", tagLabel: "Kiedyś",
    tree: [
      { id: "az104-1", label: "John Savill — AZ-104 Study Cram v2 (YouTube, 4h)", hours: 4, children: [] },
      { id: "az104-3", label: "Microsoft Learn — AZ-104 learning path (~10h)", hours: 10, children: [] },
      { id: "az104-4", label: "Practice testy (MeasureUp lub Whizlabs)", hours: 4, children: [] },
      { id: "az104-5", label: "Egzamin AZ-104 (~$99 USD w Polsce)", hours: 1, children: [] },
      { id: "az104-6", label: "Dodaj do CV i LinkedIn", hours: 0, children: [] },
    ]},
  { id: "sc-300", title: "SC-300 — Identity and Access Administrator", color: "#6B2D8B", tag: "placeholder", tagLabel: "Kiedyś",
    tree: [
      { id: "sc300-1", label: "John Savill — SC-300 Study Cram (YouTube, ~3h)", hours: 3, children: [] },
      { id: "sc300-3", label: "Microsoft Learn — SC-300 learning path (~10h)", hours: 10, children: [] },
      { id: "sc300-4", label: "Practice testy", hours: 3, children: [] },
      { id: "sc300-5", label: "Egzamin SC-300 (~$99 USD w Polsce)", hours: 1, children: [] },
      { id: "sc300-6", label: "Dodaj do CV i LinkedIn", hours: 0, children: [] },
    ]},
  { id: "sc-500", title: "SC-500 — Cloud and AI Security Engineer Associate", color: "#C41E3A", tag: "placeholder", tagLabel: "Kiedyś",
    tree: [
      { id: "az500-1", label: "John Savill — SC-500 Study Cram (YouTube, TBD ~Q4 2026)", hours: 3, children: [] },
      { id: "az500-3", label: "Microsoft Learn — SC-500 learning path (TBD)", hours: 15, children: [] },
      { id: "az500-4", label: "Lab environment — Azure trial / sandbox", hours: 5, children: [] },
      { id: "az500-5", label: "Practice testy", hours: 4, children: [] },
      { id: "az500-6", label: "Egzamin SC-500 (~$99 USD w Polsce, beta maj 2026)", hours: 1, children: [] },
      { id: "az500-7", label: "Dodaj do CV i LinkedIn", hours: 0, children: [] },
    ]},
  { id: "placeholder-mod", title: "Placeholder / długoterminowe", color: "#888780", tag: "placeholder", tagLabel: "Kiedyś",
    tree: [
      { id: "opt-1", label: "Bash & Linux — podstawy skryptowania", hours: 8, children: [] },
      { id: "opt-2", label: "Python PCEP/PCAP — automatyzacja DevOps", hours: 30, children: [] },
      { id: "opt-4", label: "AZ-400 — DevOps Engineer Expert (po 1-2 latach exp)", hours: 40, children: [] },
      { id: "opt-5", label: "Podyplomowe SGH/Koźmiński — Management/PM", hours: 0, children: [] },
    ]},
];

// ─── INLINE EDIT ──────────────────────────────────────────────────────────────
function InlineEdit({ value, onChange, style = {} }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  if (!editing) return (
    <span onClick={() => { setVal(value); setEditing(true); }}
      style={{ ...style, cursor: "text", borderBottom: "1px dashed var(--color-border-secondary)", minWidth: 20 }}>
      {value || "—"}
    </span>
  );
  return <input autoFocus value={val}
    onChange={e => setVal(e.target.value)}
    onBlur={() => { onChange(val); setEditing(false); }}
    onKeyDown={e => { if (e.key === "Enter") { onChange(val); setEditing(false); } }}
    style={{ ...style, border: "1px solid var(--color-border-secondary)", borderRadius: 3, padding: "2px 4px", background: "var(--color-background-primary)", color: "var(--color-text-primary)", fontFamily: "inherit" }} />;
}

// ─── CHECKBOX ─────────────────────────────────────────────────────────────────
function Checkbox({ state, color, size = 18, onClick }) {
  const isDone = state === "done";
  const isSkip = state === "skip";
  const isPartial = state === "partial";
  const bg = isDone ? color : isSkip ? "#999" : isPartial ? color : "var(--color-background-primary)";
  const border = (isDone || isSkip || isPartial) ? "none" : "2px solid #888";
  return (
    <div onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ width: size, height: size, borderRadius: 4, border, background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", cursor: "pointer" }}>
      {isDone && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {isSkip && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>}
      {isPartial && <svg width="10" height="2" viewBox="0 0 10 2" fill="none"><path d="M1 1H9" stroke="white" strokeWidth="2" strokeLinecap="round" /></svg>}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ProgressTracker() {
  const [states, setStates] = useState({});
  const [collapsed, setCollapsed] = useState({ "placeholder-mod": true });
  const [modules, setModules] = useState(curriculumDefault);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r1 = await window.storage.get(STORAGE_KEY);
        if (r1?.value) { const d = JSON.parse(r1.value); setStates(d.states || {}); setCollapsed(d.collapsed || { "placeholder-mod": true }); }
        const r2 = await window.storage.get(DATA_KEY);
        if (r2?.value) setModules(JSON.parse(r2.value));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = async (ns, nc) => {
    try { await window.storage.set(STORAGE_KEY, JSON.stringify({ states: ns, collapsed: nc })); } catch {}
  };
  const saveModules = async (m) => {
    try { await window.storage.set(DATA_KEY, JSON.stringify(m)); } catch {}
  };

  // ── STATE LOGIC ──
  const getLeafState = (id) => states[id] || "todo";

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
    if (editMode) return;
    const ns = { ...states };
    if (!node.children?.length) {
      const cur = getLeafState(node.id);
      ns[node.id] = cur === "todo" ? "done" : cur === "done" ? "skip" : "todo";
    } else {
      const cur = getNodeState(node);
      const target = cur === "todo" ? "done" : "todo";
      Object.assign(ns, setSubtreeLeaves(node, target));
    }
    setStates(ns);
    save(ns, collapsed);
  };

  // ── COLLAPSE ──
  const toggleCollapse = (id) => {
    const nc = { ...collapsed, [id]: !collapsed[id] };
    setCollapsed(nc);
    save(states, nc);
  };

  // ── MODULE OPS ──
  const updateModules = (m) => { setModules(m); saveModules(m); };

  const updateModuleField = (moduleId, field, value) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const updates = { [field]: value };
      if (field === "tag") {
        if (value === "optional" || value === "placeholder") updates.tagLabel = "";
        else if (!m.tagLabel || ["Opcjonalne", "Kiedyś"].includes(m.tagLabel)) updates.tagLabel = "comment";
      }
      return { ...m, ...updates };
    });
    updateModules(next);
  };

  const addModule = () => {
    const newMod = { id: genId(), title: "Nowy kurs", color: "#888780", tag: "main", tagLabel: "comment", tree: [{ id: genId(), label: "Nowy krok", hours: 1, children: [] }] };
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

  // ── NODE OPS ──
  const updateNode = (moduleId, nodeId, field, value) => {
    const next = modules.map(m => {
      if (m.id !== moduleId) return m;
      const tree = cloneTree(m.tree);
      const found = findNode(tree, nodeId);
      if (found) found[0][field] = field === "hours" ? parseHMM(value) : value;
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
    const newNode = { id: genId(), label: "Nowy krok", hours: 1, children: [] };
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

  // ── STATS ──
  const calcStats = () => {
    let mainH = 0, mainDoneH = 0, optH = 0, optDoneH = 0;
    const processNode = (node, moduleTag) => {
      const isLeaf = !node.children?.length;
      if (isLeaf) {
        const h = node.hours || 0;
        const st = getLeafState(node.id);
        const isSkipped = st === "skip";
        if (moduleTag === "main") {
          if (isSkipped) { optH += h; optDoneH += h; }
          else { mainH += h; if (st === "done") mainDoneH += h; }
        } else if (moduleTag === "optional") {
          optH += h; if (st === "done" || st === "skip") optDoneH += h;
        }
      } else {
        node.children.forEach(c => processNode(c, moduleTag));
      }
    };
    modules.forEach(m => { if (m.tag !== "placeholder") m.tree.forEach(n => processNode(n, m.tag)); });
    return { mainH, mainDoneH, optH, optDoneH };
  };

  const s = calcStats();
  const mainPct = s.mainH > 0 ? Math.round((s.mainDoneH / s.mainH) * 100) : 0;
  const optPct = s.optH > 0 ? Math.round((s.optDoneH / s.optH) * 100) : 0;
  const allH = s.mainH + s.optH, allDoneH = s.mainDoneH + s.optDoneH;
  const allPct = allH > 0 ? Math.round((allDoneH / allH) * 100) : 0;

  const getModStats = (m) => {
    let total = 0, doneH = 0, rootDone = 0, rootTotal = 0;
    const processNode = (node) => {
      if (!node.children?.length) { total += node.hours || 0; if (getLeafState(node.id) === "done") doneH += node.hours || 0; }
      else node.children.forEach(processNode);
    };
    m.tree.forEach(n => { processNode(n); rootTotal++; const st = getNodeState(n); if (st === "done" || st === "skip") rootDone++; });
    return { pct: total > 0 ? Math.round((doneH / total) * 100) : 0, done: rootDone, total: rootTotal };
  };

  // ── RENDER NODE ──
  const iconBtn = (label, onClick, danger = false) => (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3, border: `1px solid ${danger ? "var(--color-border-danger)" : "var(--color-border-tertiary)"}`, background: "transparent", color: danger ? "var(--color-text-danger)" : "var(--color-text-secondary)", cursor: "pointer", lineHeight: 1.4 }}>
      {label}
    </button>
  );

  const renderNode = (moduleId, node, color, depth, isPlaceholderMod) => {
    const hasChildren = node.children?.length > 0;
    const nodeState = getNodeState(node);
    const isCollapsedNode = !!collapsed[node.id];
    const indent = depth * 20;
    const bgColor = nodeState === "done" ? "var(--color-background-success)" : nodeState === "skip" ? "var(--color-background-secondary)" : "transparent";

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (editMode) return;
            if (isPlaceholderMod) return;
            if (hasChildren) { toggleCollapse(node.id); return; }
            handleNodeClick(node);
          }}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: `6px 16px 6px ${16 + indent}px`, cursor: isPlaceholderMod || editMode ? "default" : "pointer", background: bgColor, transition: "background 0.1s", minHeight: 32 }}
          onMouseEnter={(e) => { if (!isPlaceholderMod && !editMode && nodeState === "todo") e.currentTarget.style.background = "var(--color-background-secondary)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = bgColor; }}
        >
          {isPlaceholderMod
            ? <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-border-secondary)", flexShrink: 0 }} />
            : <Checkbox state={nodeState} color={color} size={depth === 0 ? 18 : 16} onClick={() => !editMode && handleNodeClick(node)} />
          }

          {editMode
            ? <InlineEdit value={node.label} onChange={v => updateNode(moduleId, node.id, "label", v)} style={{ fontSize: depth === 0 ? 13 : 12, flex: 1, fontWeight: hasChildren ? 500 : 400 }} />
            : <span style={{ fontSize: depth === 0 ? 13 : 12, fontWeight: hasChildren ? 500 : 400, flex: 1, color: nodeState === "done" ? "var(--color-text-success)" : nodeState === "skip" ? "var(--color-text-secondary)" : "var(--color-text-primary)", textDecoration: nodeState === "done" || nodeState === "skip" ? "line-through" : "none", opacity: nodeState === "done" || nodeState === "skip" ? 0.7 : 1 }}>
                {node.label}
              </span>
          }

          {editMode && !hasChildren
            ? <><InlineEdit value={hToHMM(node.hours)} onChange={v => updateNode(moduleId, node.id, "hours", v)} style={{ fontSize: 11, width: 40, textAlign: "right" }} /><span style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>h</span></>
            : (!hasChildren && node.hours > 0)
              ? <span style={{ fontSize: 11, color: "var(--color-text-secondary)", whiteSpace: "nowrap" }}>{hToHMM(node.hours)}h</span>
              : null
          }

          {hasChildren && !editMode && <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flexShrink: 0 }}>{isCollapsedNode ? "▸" : "▾"}</span>}

          {editMode && !isPlaceholderMod && (
            <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              {iconBtn("↑", () => moveNode(moduleId, node.id, -1))}
              {iconBtn("↓", () => moveNode(moduleId, node.id, 1))}
              {depth > 0 && iconBtn("←", () => outdentNode(moduleId, node.id))}
              {depth < MAX_DEPTH && iconBtn("→", () => indentNode(moduleId, node.id))}
              {iconBtn("+", () => addNode(moduleId, node.id))}
              {iconBtn("×", () => setDeleteConfirm({ moduleId, nodeId: node.id, label: node.label }), true)}
            </div>
          )}
        </div>

        {hasChildren && !isCollapsedNode && node.children.map(child => renderNode(moduleId, child, color, depth + 1, isPlaceholderMod))}
      </div>
    );
  };

  const btnStyle = (active) => ({ fontSize: 11, padding: "3px 10px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--color-border-secondary)", background: active ? "var(--color-background-warning)" : "var(--color-background-secondary)", color: active ? "var(--color-text-warning)" : "var(--color-text-secondary)", cursor: "pointer" });

  if (!loaded) return <div style={{ padding: "2rem", color: "var(--color-text-secondary)", fontSize: 14 }}>Loading...</div>;

  return (
    <div style={{ fontFamily: "var(--font-sans)", padding: "1.5rem 0", maxWidth: 680 }}>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", maxWidth: 360, width: "90%" }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>Usunąć krok i wszystkie podpunkty?</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>„{deleteConfirm.label}"</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ ...btnStyle(false), padding: "4px 12px" }}>Anuluj</button>
              <button onClick={() => deleteNode(deleteConfirm.moduleId, deleteConfirm.nodeId)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--color-border-danger)", background: "var(--color-background-danger)", color: "var(--color-text-danger)", cursor: "pointer" }}>Usuń</button>
            </div>
          </div>
        </div>
      )}

      {deleteModuleConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--color-background-primary)", border: "1px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-lg)", padding: "1.5rem", maxWidth: 360, width: "90%" }}>
            <p style={{ fontSize: 14, marginBottom: 12 }}>Usunąć cały kurs?</p>
            <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 16 }}>„{deleteModuleConfirm.title}" — ta operacja jest nieodwracalna.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteModuleConfirm(null)} style={{ ...btnStyle(false), padding: "4px 12px" }}>Anuluj</button>
              <button onClick={() => deleteModule(deleteModuleConfirm.id)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--color-border-danger)", background: "var(--color-background-danger)", color: "var(--color-text-danger)", cursor: "pointer" }}>Usuń kurs</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ marginBottom: "1.5rem", border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", overflow: "hidden" }}>
        {[
          { label: "Główne", doneH: s.mainDoneH, totalH: s.mainH, pct: mainPct, barColor: "#639922" },
          { label: "Opcjonalne", doneH: s.optDoneH, totalH: s.optH, pct: optPct, barColor: "#BA7517" },
          { label: "Całość", doneH: allDoneH, totalH: allH, pct: allPct, barColor: "#4A90D9" },
        ].map(({ label, doneH, totalH, pct, barColor }, idx, arr) => (
          <div key={label} style={{ display: "grid", gridTemplateColumns: "88px 1fr 40px 110px", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: idx < arr.length - 1 ? "0.5px solid var(--color-border-tertiary)" : "none", background: idx === 2 ? "var(--color-background-secondary)" : "transparent" }}>
            <span style={{ fontSize: 12, fontWeight: idx === 2 ? 600 : 400 }}>{label}</span>
            <div style={{ position: "relative", height: 5, background: "#ccc", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right" }}>{pct}%</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "right", whiteSpace: "nowrap" }}>{hToHMM(doneH)}h / {hToHMM(totalH)}h</span>
          </div>
        ))}
      </div>

      {/* Modules */}
      {modules.map((module) => {
        const isPlaceholder = module.tag === "placeholder";
        const isOptional = module.tag === "optional";
        const isCollapsedMod = !!collapsed[module.id];
        const { pct, done, total } = getModStats(module);

        return (
          <div key={module.id} style={{ border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)", marginBottom: "0.75rem", overflow: "hidden", opacity: isPlaceholder ? 0.65 : 1 }}>
            <div onClick={() => !editMode && toggleCollapse(module.id)}
              style={{ padding: "12px 16px", background: "var(--color-background-secondary)", borderBottom: isCollapsedMod ? "none" : "0.5px solid var(--color-border-tertiary)", display: "flex", alignItems: "center", gap: 10, cursor: editMode ? "default" : "pointer", userSelect: "none" }}>
              {editMode
                ? <label style={{ width: 10, height: 10, borderRadius: "50%", background: module.color, flexShrink: 0, cursor: "pointer", display: "block" }} title="Zmień kolor">
                    <input type="color" value={module.color} onChange={e => updateModuleField(module.id, "color", e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                  </label>
                : <div style={{ width: 10, height: 10, borderRadius: "50%", background: module.color, flexShrink: 0 }} />
              }

              {editMode
                ? <InlineEdit value={module.title} onChange={v => updateModuleField(module.id, "title", v)} style={{ fontWeight: 500, fontSize: 14, flex: 1 }} />
                : <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>
                    {module.title}
                    {isOptional && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)", fontSize: 12 }}> (opcjonalne)</span>}
                    {isPlaceholder && <span style={{ fontWeight: 400, color: "var(--color-text-secondary)", fontSize: 12 }}> (placeholder)</span>}
                  </span>
              }

              {editMode ? (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }} onClick={e => e.stopPropagation()}>
                  {module.tag === "main" && (
                    <InlineEdit value={module.tagLabel || "comment"} onChange={v => updateModuleField(module.id, "tagLabel", v)} style={{ fontSize: 11, minWidth: 40, color: "var(--color-text-secondary)" }} />
                  )}
                  <select value={module.tag} onChange={e => updateModuleField(module.id, "tag", e.target.value)}
                    style={{ fontSize: 11, padding: "2px 6px", borderRadius: "var(--border-radius-md)", border: "1px solid var(--color-border-secondary)", background: "var(--color-background-primary)", color: "var(--color-text-primary)", cursor: "pointer" }}>
                    <option value="main">main</option>
                    <option value="optional">optional</option>
                    <option value="placeholder">placeholder</option>
                  </select>
                </div>
              ) : (
                module.tag === "main" && module.tagLabel && (
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: "var(--border-radius-md)", background: "var(--color-background-info)", color: "var(--color-text-info)", whiteSpace: "nowrap" }}>
                    {module.tagLabel}
                  </span>
                )
              )}

              {editMode && (
                <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  {iconBtn("↑", () => moveModule(module.id, -1))}
                  {iconBtn("↓", () => moveModule(module.id, 1))}
                  {iconBtn("×", () => setDeleteModuleConfirm({ id: module.id, title: module.title }), true)}
                </div>
              )}
              {!isPlaceholder && !editMode && <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{done}/{total}</span>}
              {!isPlaceholder && !editMode && (
                <div style={{ width: 60, height: 4, background: "#ccc", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: module.color, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              )}
              {!isPlaceholder && !editMode && <span style={{ fontSize: 12, color: "var(--color-text-secondary)", minWidth: 28, textAlign: "right" }}>{pct}%</span>}
              {!editMode && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{isCollapsedMod ? "▸" : "▾"}</span>}
            </div>

            {!isCollapsedMod && (
              <div style={{ padding: "8px 0" }}>
                {module.tree.map(node => renderNode(module.id, node, module.color, 0, isPlaceholder))}
                {editMode && !isPlaceholder && (
                  <div style={{ padding: "6px 16px" }}>
                    <button onClick={() => addNode(module.id)} style={{ fontSize: 12, padding: "4px 12px", borderRadius: "var(--border-radius-md)", border: "1px dashed var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", width: "100%" }}>+ Dodaj krok</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {editMode && (
        <div style={{ padding: "6px 0", marginBottom: 8 }}>
          <button onClick={addModule} style={{ fontSize: 12, padding: "6px 16px", borderRadius: "var(--border-radius-md)", border: "1px dashed var(--color-border-secondary)", background: "transparent", color: "var(--color-text-secondary)", cursor: "pointer", width: "100%" }}>+ Dodaj kurs</button>
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--color-text-secondary)", textAlign: "center", marginTop: 8 }}>
        Postęp zapisywany automatycznie · Kliknij nagłówek modułu aby zwinąć ·{" "}
        <span onClick={() => setEditMode(e => !e)} style={{ cursor: "pointer", textDecoration: "underline", color: editMode ? "var(--color-text-warning)" : "var(--color-text-secondary)" }}>
          {editMode ? "✓ Zakończ edycję" : "Kliknij TU, żeby edytować"}
        </span>
      </div>
    </div>
  );
}
