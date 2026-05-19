# Trackboards — pełna specyfikacja projektu dla Antigravity

## 1. Cel projektu

Zbuduj webową aplikację **Trackboards** — minimalistyczne, nowoczesne narzędzie do tworzenia i zarządzania własnymi "boardami" (trackerami zadań w formie hierarchicznego drzewka z paskami postępu i godzinami). Aplikacja umożliwia tworzenie boardów anonimowo (publiczny link) lub po zalogowaniu (prywatne, z opcją udostępnienia). Pierwszy zarejestrowany użytkownik otrzymuje rolę admina i ma dostęp do pełnego panelu administracyjnego.

**Wizualnie inspiruj się Linear, Notion, oraz claude.ai** — czyste linie, dużo whitespace, jeden akcent kolorystyczny, lewy sidebar z listą boardów do szybkiego przeskakiwania, ciemne tło z opcją przełączenia na jasne.

---

## 2. Stack techniczny (BEZWZGLĘDNIE TE WERSJE I BIBLIOTEKI)

- **React 18 + Vite** (NIE Next.js, NIE Remix)
- **React Router v6** dla routingu klienckiego
- **Supabase JS SDK** (`@supabase/supabase-js`) — auth + Postgres + RLS
- **CSS Modules** (bez Tailwind, bez bibliotek UI typu MUI, Chakra, shadcn)
- Fonty z Google Fonts wczytywane w `index.html`: **Inter** (UI), **JetBrains Mono** (liczby/godziny)
- Deploy: **Firebase Hosting** (`trackboards.web.app`)

**Czego NIE używaj:**
- Żadnego state management (Redux, Zustand) — wystarczy React state + Context dla auth
- Żadnych bibliotek UI ani Tailwind
- Żadnego SSR
- Żadnych testów na tym etapie

---

## 3. Struktura projektu

```
trackboards/
├── src/
│   ├── lib/
│   │   ├── supabase.js          # klient Supabase
│   │   ├── auth.js              # AuthContext + useAuth hook
│   │   └── boards.js            # API operacji na boardach (fetch, create, update, delete, restore...)
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Layout.jsx       # główny layout (sidebar + content)
│   │   │   ├── Layout.module.css
│   │   │   ├── Sidebar.jsx      # lista boardów (skok między nimi)
│   │   │   └── Sidebar.module.css
│   │   ├── BoardFramework/      # framework używany przez KAŻDY board
│   │   │   ├── BoardFramework.jsx
│   │   │   ├── BoardFramework.module.css
│   │   │   ├── Checkbox.jsx
│   │   │   ├── InlineEdit.jsx
│   │   │   └── treeHelpers.js   # helpers (findNode, computeParentState, hToHMM, parseHMM itd.)
│   │   ├── Toast.jsx
│   │   └── ConfirmModal.jsx
│   ├── pages/
│   │   ├── Home.jsx             # /
│   │   ├── Trackboard.jsx       # /trackboard (dashboard zalogowanego)
│   │   ├── Board.jsx            # /board/[guid]
│   │   ├── Profile.jsx          # /profile (hub)
│   │   ├── ProfileBoards.jsx    # /profile/boards
│   │   ├── ProfilePurgatory.jsx # /profile/purgatory
│   │   ├── ProfileEscape.jsx    # /profile/escape
│   │   ├── Admin.jsx            # /admin (hub)
│   │   ├── AdminBoards.jsx      # /admin/boards (anonimowe)
│   │   ├── AdminUsers.jsx       # /admin/users
│   │   ├── AdminUserBoards.jsx  # /admin/users/[id]/boards
│   │   └── AdminUserPurgatory.jsx # /admin/users/[id]/purgatory
│   ├── styles/
│   │   ├── tokens.css           # CSS variables (theme tokens)
│   │   ├── global.css           # reset + globals
│   │   └── theme-dark.css       # alternatywny theme
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── .env.example
├── vite.config.js
├── firebase.json
├── .firebaserc
├── package.json
└── README.md
```

---

## 4. Zmienne środowiskowe (.env.local)

```
VITE_SUPABASE_URL=https://oqesvssviunschgybver.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_key_z_supabase>
```

W `.env.example` umieść klucze bez wartości jako template.

---

## 5. Supabase — schemat bazy (uruchom w SQL Editor Supabase)

### Tabele

```sql
-- 5.1 PROFILES — rozszerzenie auth.users
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 5.2 BOARDS — wszystkie boardy
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(user_id) on delete set null,
  share_guid text unique,
  title text not null default 'Nowy board',
  color text not null default '#888780',
  data jsonb not null default '{"modules":[]}'::jsonb,
  progress jsonb not null default '{"states":{},"collapsed":{}}'::jsonb,
  position int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index boards_owner_id_idx on public.boards(owner_id);
create index boards_share_guid_idx on public.boards(share_guid);
create index boards_deleted_at_idx on public.boards(deleted_at);
```

### Trigger — pierwszy user dostaje rolę admin, kolejni user

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count int;
  new_role text;
begin
  select count(*) into user_count from public.profiles;
  if user_count = 0 then
    new_role := 'admin';
  else
    new_role := 'user';
  end if;

  insert into public.profiles (user_id, email, role)
  values (new.id, new.email, new_role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Trigger — automatyczny update `updated_at` na boards

```sql
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger boards_touch_updated_at
  before update on public.boards
  for each row execute function public.touch_updated_at();
```

### RLS (Row Level Security)

**WŁĄCZ RLS dla wszystkich tabel.**

```sql
alter table public.profiles enable row level security;
alter table public.boards enable row level security;
```

### Helper function — sprawdzanie roli admina

```sql
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and role = 'admin'
      and is_active = true
  );
$$;
```

### Policies — PROFILES

```sql
-- każdy zalogowany może czytać własny profil
create policy "profiles_select_self"
  on public.profiles for select
  using (user_id = auth.uid());

-- admin czyta wszystkie profile
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());

-- admin może update'ować profile (rola, is_active)
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
```

### Policies — BOARDS

```sql
-- SELECT: właściciel widzi swoje + każdy widzi publiczne (share_guid IS NOT NULL) + admin widzi wszystko
create policy "boards_select"
  on public.boards for select
  using (
    (owner_id = auth.uid() and (select is_active from public.profiles where user_id = auth.uid()))
    or share_guid is not null
    or public.is_admin()
  );

-- INSERT: zalogowany tworzy własny board, anonim tworzy publiczny (owner_id NULL + share_guid)
create policy "boards_insert_authenticated"
  on public.boards for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and (select is_active from public.profiles where user_id = auth.uid())
  );

create policy "boards_insert_anonymous"
  on public.boards for insert
  to anon
  with check (
    owner_id is null
    and share_guid is not null
  );

-- UPDATE: właściciel update'uje swoje + każdy z share_guid update'uje publiczne + admin wszystko
create policy "boards_update"
  on public.boards for update
  using (
    (owner_id = auth.uid() and (select is_active from public.profiles where user_id = auth.uid()))
    or (share_guid is not null and owner_id is null)
    or public.is_admin()
  )
  with check (
    (owner_id = auth.uid() and (select is_active from public.profiles where user_id = auth.uid()))
    or (share_guid is not null and owner_id is null)
    or public.is_admin()
  );

-- DELETE: tylko admin (zwykły user używa soft delete = update deleted_at)
create policy "boards_delete_admin"
  on public.boards for delete
  using (public.is_admin());
```

---

## 6. Architektura frontu

### 6.1 Routing (React Router v6)

```
/                           Home               public
/board/:guid                Board              public (jeśli share_guid) lub owner-only
/trackboard                 Trackboard         wymaga auth
/profile                    Profile            wymaga auth
/profile/boards             ProfileBoards      wymaga auth
/profile/purgatory          ProfilePurgatory   wymaga auth
/profile/escape             ProfileEscape      wymaga auth (ukryte dla admina)
/admin                      Admin              wymaga auth + role=admin
/admin/boards               AdminBoards        wymaga auth + role=admin
/admin/users                AdminUsers         wymaga auth + role=admin
/admin/users/:id/boards     AdminUserBoards    wymaga auth + role=admin
/admin/users/:id/purgatory  AdminUserPurgatory wymaga auth + role=admin
*                           404
```

Zaimplementuj komponenty `<RequireAuth>` i `<RequireAdmin>` które robią redirect na `/` jeśli warunki nie są spełnione.

### 6.2 Layout

Dwukolumnowy:
- **Lewy sidebar** (szerokość 260px, collapsable do 60px) — logo "Trackboards" na górze, lista boardów użytkownika (klik = przeskok do `/board/:guid`), na dole avatar + email + dropdown (Profile, Logout) jeśli zalogowany, lub przycisk "Zaloguj" jeśli nie.
- **Główny content** — strony.

Anonim nie ma sidebara — widzi tylko Home albo bezpośrednio Board przez URL.

### 6.3 Auth (Supabase Google OAuth)

`src/lib/auth.js`:
- `AuthContext` providujący: `user`, `profile` (z tabeli profiles), `loading`, `signInWithGoogle()`, `signOut()`
- Po zalogowaniu sprawdzaj `profile.is_active` — jeśli `false`, automatycznie `signOut()` i pokaż toast "Twoje konto zostało zablokowane".
- Listener `supabase.auth.onAuthStateChange` aktualizuje stan.

### 6.4 Klient Supabase (`src/lib/supabase.js`)

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  }
)
```

### 6.5 Boards API (`src/lib/boards.js`)

Eksportuj funkcje:
- `listMyBoards()` — boardy zalogowanego (`deleted_at IS NULL`)
- `listMyPurgatory()` — usunięte (`deleted_at IS NOT NULL`)
- `getBoard(idOrGuid)` — pojedynczy board (sprawdza najpierw po `id`, potem po `share_guid`)
- `createBoardAuthenticated()` — nowy prywatny board dla zalogowanego
- `createBoardAnonymous()` — nowy publiczny board (generuje `share_guid`, `owner_id = NULL`)
- `updateBoardData(id, data, progress)` — debounce'owany zapis stanu drzewka
- `updateBoardMeta(id, fields)` — title, color, position
- `softDeleteBoard(id)` — set `deleted_at = now()`
- `restoreBoard(id)` — set `deleted_at = NULL`
- `hardDeleteBoard(id)` — DELETE (admin only)
- `togglePublic(id, makePublic)` — generuje/usuwa `share_guid`
- `adoptOrphanBoard(boardId)` — przypisuje publiczny board (owner_id NULL) do aktualnego usera
- Admin: `listAnonymousBoards()`, `listUsers()`, `listUserBoards(userId)`, `listUserPurgatory(userId)`, `updateUserRole(userId, role)`, `toggleUserActive(userId)`, `assignOrphanToUser(boardId, userId)`

**Debouncing zapisu**: każda funkcja `updateBoardData` powinna mieć debouncing po stronie wywołującego komponentu (300ms) żeby nie spamować bazy.

### 6.6 LocalStorage dla anonimów

Jeśli user nie jest zalogowany i tworzy publiczny board lub edytuje board przez `share_guid`, zapisz do `localStorage`:

```js
{
  "trackboards_recent": [
    { guid: "...", title: "...", lastVisited: "ISO date" },
    ...
  ]
}
```

Na stronie głównej (Home) dla niezalogowanych — pokaż sekcję "Ostatnio odwiedzane boardy" z listą z localStorage (max 10, sortowane po `lastVisited` desc).

### 6.7 Adopcja publicznego boardu

Jeśli user wszedł na `/board/:guid` jako anonim i potem się zaloguje (a board ma `owner_id IS NULL`), pokaż mu w nagłówku boardu przycisk **"Zaadoptuj ten board"** — po kliknięciu wywołaj `adoptOrphanBoard()`. Board pojawi się w `/profile/boards`.

---

## 7. Framework boardu — `BoardFramework.jsx`

To **najważniejsza** część projektu. Każdy board (na stronach `/board/:guid`, podgląd w `/admin/users/:id/boards`) używa tego samego komponentu `<BoardFramework>`.

**Dane wejściowe (props):**
- `boardId` — UUID boardu
- `data` — obiekt `{ modules: [...] }`
- `progress` — obiekt `{ states: {...}, collapsed: {...} }`
- `onChange(newData, newProgress)` — callback przy każdej zmianie
- `readOnly` — bool (np. dla podglądu admina lub usera zablokowanego)
- `canEditStructure` — bool (czy może edytować strukturę modułów i kroków)

**Wewnętrzny model danych:**

```js
// data.modules
[
  {
    id: "string",          // generowany przez genId()
    title: "string",
    color: "#hex",
    tag: "main" | "optional" | "placeholder",
    tagLabel: "string",    // krótki opis np. "Czerwiec"
    tree: [
      {
        id: "string",
        label: "string",
        hours: number,     // może być float (np. 1.5 = 1h30min)
        children: [        // max depth = 2 (root=0, child=1, grandchild=2)
          { id, label, hours, children: [] }
        ]
      }
    ]
  }
]

// progress
{
  states: { [nodeId]: "todo" | "done" | "skip" },   // tylko liście mają state
  collapsed: { [moduleId]: boolean }                 // collapsed modules
}
```

**Funkcjonalność (musi być 1:1 z istniejącym JSX który ci podam jako referencję):**

1. **Stany checkboxa** — leaf: kliknięcie cykluje `todo → done → skip → todo`. Parent: pokazuje state agregowany z dzieci (`done` jeśli wszystkie done, `skip` jeśli wszystkie skip, `todo` jeśli wszystkie todo, `partial` w przeciwnym wypadku). Kliknięcie parenta ustawia wszystkie leaf-dzieci na `done` lub `todo` (toggle).

2. **Render checkboxa** — kwadrat 18×18 px, border-radius 4px. `done` = wypełniony kolorem modułu z ikoną check. `skip` = wypełniony szary z ikoną X. `partial` = wypełniony kolorem modułu z dashem. `todo` = pusty z border szarym.

3. **Paski postępu** —
   - **Global header**: trzy wiersze (Główne / Opcjonalne / Całość) — każdy z paskiem i licznikiem `Xh / Yh` oraz procentem.
   - **Per module**: w nagłówku modułu pasek + procent + `done/total` (liczba zadań, nie godzin).

4. **Liczenie godzin i procentów:**
   - Suma godzin leafów które są `done`
   - Suma godzin leafów które są `skip` traktuj jako "zaliczone" (done) do liczenia procentów (bo użytkownik świadomie pominął)
   - **Główne** = moduły z `tag === "main"`, **Opcjonalne** = `tag === "optional"`. **Placeholdery** są wyłączone z liczenia.

5. **Hierarchia drzewa** — max 3 poziomy. Każdy node ma label edytowalny inline, hours edytowalne (format `h:mm` lub liczba dziesiętna). Indent 24px per poziom.

6. **Collapse** — kliknięcie nagłówka modułu zwija/rozwija drzewo. Stan zapisywany w `progress.collapsed`.

7. **Edit mode** — toggle "Kliknij TU, żeby edytować" na dole. Po włączeniu edycji:
   - Tytuł modułu, tagLabel, kolor → edytowalne inline
   - Tag (main/optional/placeholder) → select
   - Przyciski ↑↓× przy każdym module (move up, move down, delete)
   - Przyciski ↑↓× przy każdym node (move up, move down, delete)
   - "+ Dodaj krok" pod każdym modułem
   - "+ Dodaj kurs" na dole listy
   - W każdym nodzie (niebędącym grandchild) opcja "+ podkrok" dodająca dziecko

8. **Confirmation modals** — dla `delete node` i `delete module` zawsze potwierdzenie ("Usunąć krok?" / "Usunąć cały kurs?").

9. **InlineEdit komponent** — span który po kliknięciu zamienia się w input. Enter / blur zatwierdza. Esc anuluje.

10. **Auto-save** — `onChange` wywoływany po każdej zmianie. Komponent rodzic robi debounce 300ms i zapisuje do Supabase.

**Plik `treeHelpers.js`** powinien zawierać dokładnie te helpery:

```js
export function genId() { return "s-" + Math.random().toString(36).slice(2, 8); }

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

export function cloneTree(nodes) { return JSON.parse(JSON.stringify(nodes)); }

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

// + dowolne inne helpery z oryginalnego JSX
```

**Referencja**: użytkownik załączy `progress-tracker.jsx` — przepisz jego logikę do `BoardFramework.jsx`, ale:
- Zamiast `window.storage` → callback `onChange` do rodzica
- Zamiast hardkodowanego `curriculumDefault` → przyjmuj `data` przez props
- Zamiast inline styles → CSS Modules
- Pusta inicjalna `data` = `{ modules: [] }` — board startuje pusty z guziem "+ Dodaj pierwszy kurs"

---

## 8. Strony — szczegóły każdej

### 8.1 Home (`/`)

Dla niezalogowanego:
- Hero: logo + tagline ("Trackuj swoje cele. Jakkolwiek chcesz.")
- Dwie duże karty (CTA):
  - **"Utwórz board bez logowania"** → POST `createBoardAnonymous()`, redirect do `/board/:guid`
  - **"Zaloguj się przez Google"** → `signInWithGoogle()`
- Sekcja "Ostatnio odwiedzane" (jeśli localStorage ma wpisy) — karty z linkami do `/board/:guid`

Dla zalogowanego: redirect do `/trackboard`

### 8.2 Trackboard (`/trackboard`)

Dashboard zalogowanego. Lista własnych boardów (`deleted_at IS NULL`), w postaci kart z:
- Tytuł
- Kolor (kropka po lewej)
- Procent ukończenia (policzony z `progress.states`)
- Data ostatniej aktualizacji
- Drag handle (do zmiany kolejności przez `position`)
- Toggle public/private (ikona kłódki/linku)
- Przycisk "Otwórz" → `/board/:id`
- Przycisk ⋯ (menu): Soft delete

Na dole "+ Nowy board" — tworzy pusty board z `title="Nowy board"`, redirect do `/board/:id`.

### 8.3 Board (`/board/:guid`)

Pobierz board po `id` lub `share_guid`. Jeśli nie znaleziony lub brak dostępu (RLS) — pokaż "Brak dostępu" z przyciskiem powrotu.

Layout:
- Header: tytuł boardu (InlineEdit jeśli ma uprawnienia), kolor (color picker), badge "PUBLIC" / "PRIVATE", toggle public/private (jeśli zalogowany właściciel), przycisk "Skopiuj link" (jeśli public), przycisk "Zaadoptuj" (jeśli anonim board + zalogowany user)
- Główna treść: `<BoardFramework>`

Anonimowy user edytujący publiczny board → zapisuje do localStorage info o boardzie (do "Ostatnio odwiedzane").

### 8.4 Profile (`/profile`)

Hub: dwie karty obok siebie (responsywnie pod sobą na mobile):
- **Czyściec** — opis "Twoje usunięte boardy. Możesz je przywrócić lub usunąć na zawsze." → `/profile/purgatory`
- **Wyjście** — opis "Usuń swoje konto na stałe." → `/profile/escape` (ukryte dla admina)

Plus sekcja "Twoje konto" na górze: avatar, email, data rejestracji, rola.

### 8.5 ProfileBoards (`/profile/boards`)

Lista aktywnych boardów (jak w `/trackboard`) ale w widoku tabelarycznym z więcej szczegółów:
- Tytuł | Kolor | Public/Private | Ostatnia aktywność | Akcje (otwórz / soft delete / kopiuj link jeśli public)

### 8.6 ProfilePurgatory (`/profile/purgatory`)

Lista soft-deleted boardów własnych. Akcje:
- **Przywróć** → `restoreBoard()`
- **Usuń na zawsze** (wyszarzony, placeholder — zostawić nieaktywny przycisk z tooltipem "Wkrótce")

Sortowanie po `deleted_at DESC`.

### 8.7 ProfileEscape (`/profile/escape`)

Strona usunięcia konta. Wyszarzony przycisk "Usuń konto" — bez akcji, tooltip "Wkrótce dostępne". Pełen flow zostanie zaimplementowany później (wymaga Supabase Edge Function).

Tekst: "Wpisz **potwierdzam** aby usunąć konto" + input + przycisk (zablokowany).

### 8.8 Admin (`/admin`)

Hub admina. Karty:
- **Anonimowe boardy** → `/admin/boards`
- **Użytkownicy** → `/admin/users`

Dostępny tylko dla `role=admin`.

### 8.9 AdminBoards (`/admin/boards`)

Lista boardów z `owner_id IS NULL`. Kolumny:
- Tytuł
- `share_guid` (do skopiowania)
- Data utworzenia
- Data ostatniej aktywności (`updated_at`)
- Akcje:
  - **Otwórz** → `/board/:guid`
  - **Przypisz** — dropdown z listą zarejestrowanych userów + button "Przypisz" → `assignOrphanToUser()`
  - **Usuń na zawsze** → `hardDeleteBoard()` z potwierdzeniem

### 8.10 AdminUsers (`/admin/users`)

Lista wszystkich userów. Kolumny:
- Email
- Rola (dropdown user/admin — zablokowany dla samego siebie żeby admin nie mógł sobie zabrać roli)
- Status (Active / Blocked) — toggle
- Liczba boardów (aktywnych)
- Data rejestracji
- Akcje:
  - **Otwórz boardy** → `/admin/users/:id/boards`
  - **Czyściec** → `/admin/users/:id/purgatory`
  - **Wyloguj** — placeholder (wyszarzony)
  - **Usuń konto** — placeholder (wyszarzony)

### 8.11 AdminUserBoards (`/admin/users/:id/boards`)

Lista aktywnych boardów konkretnego usera. Header: "Boardy użytkownika [email]" + breadcrumb. Kolumny i akcje jak w `ProfileBoards`, dodatkowo:
- **Otwórz** → `/board/:id` (admin może otworzyć każdy board, RLS to umożliwia)
- **Soft delete** → `softDeleteBoard()` (przeniesie do `/admin/users/:id/purgatory`)
- **Toggle public/private**
- **Hard delete** → `hardDeleteBoard()` z potwierdzeniem

### 8.12 AdminUserPurgatory (`/admin/users/:id/purgatory`)

Lista soft-deleted boardów usera. Akcje:
- **Przywróć**
- **Usuń na zawsze**

---

## 9. Design system — CSS variables i wygląd

`src/styles/tokens.css`:

```css
:root {
  /* Theme — light by default */
  --color-bg: #ffffff;
  --color-bg-secondary: #fafafa;
  --color-bg-tertiary: #f4f4f5;
  --color-text-primary: #18181b;
  --color-text-secondary: #71717a;
  --color-text-tertiary: #a1a1aa;
  --color-border-primary: #e4e4e7;
  --color-border-secondary: #d4d4d8;
  --color-border-tertiary: #f4f4f5;

  --color-accent: #6366f1;        /* indygo — single accent */
  --color-accent-hover: #4f46e5;

  --color-success: #16a34a;
  --color-warning: #ca8a04;
  --color-danger: #dc2626;
  --color-info: #2563eb;

  --color-background-danger: #fef2f2;
  --color-text-danger: #b91c1c;
  --color-border-danger: #fecaca;

  --color-background-info: #eff6ff;
  --color-text-info: #1e40af;

  /* Typography */
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Menlo', monospace;

  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 20px;
  --font-size-2xl: 28px;

  /* Radii */
  --border-radius-sm: 4px;
  --border-radius-md: 6px;
  --border-radius-lg: 10px;
  --border-radius-xl: 14px;

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);

  /* Layout */
  --sidebar-width: 260px;
  --sidebar-collapsed-width: 60px;
  --transition-fast: 0.15s ease;
}

[data-theme="dark"] {
  --color-bg: #0a0a0a;
  --color-bg-secondary: #141414;
  --color-bg-tertiary: #1c1c1c;
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-tertiary: #71717a;
  --color-border-primary: #262626;
  --color-border-secondary: #404040;
  --color-border-tertiary: #1c1c1c;

  --color-background-danger: #2a1212;
  --color-text-danger: #fca5a5;
  --color-border-danger: #7f1d1d;

  --color-background-info: #0f1f3a;
  --color-text-info: #93c5fd;
}
```

Theme toggle (light/dark) w sidebarze na dole. Stan zapisywany w `localStorage` (`trackboards_theme`).

**Estetyka:**
- Brak gradientów, brak skeumorfizmu
- Subtelne hover states (background change, nie border)
- Animacje tylko na opacity, transform i background — żadnego "wow" effect
- Przyciski: tylko outline / ghost / primary (accent solid). Tylko 3 warianty.
- Spacing oddychający — minimum 24px paddings na kontenerach
- Border-radius spójny: `--border-radius-md` dla małych elementów, `--border-radius-lg` dla kart/modali
- Cienie używaj OSZCZĘDNIE — głównie modale i dropdowny

---

## 10. Bezpieczeństwo — must have

- **Wszystkie operacje przez Supabase SDK** — nigdy nie eksponuj kluczy w kodzie, używaj env vars.
- **RLS po stronie bazy** — frontend tylko reaguje na błędy. Nigdy nie polegaj na sprawdzaniu po stronie klienta.
- **Walidacja inputów** —
  - `title` max 200 znaków
  - `label` max 200 znaków
  - `hours` >= 0 i <= 1000
  - `data` zawsze waliduj strukturę przed save (że to obiekt z `modules: []`)
- **XSS** — nigdy nie używaj `dangerouslySetInnerHTML`. Wszystkie teksty userów renderuj jako text content.
- **Sprawdzanie `is_active` na każdym requeście** — jeśli user jest zablokowany, RLS odrzuci. Front też powinien sprawdzić i wylogować.
- **CSRF nie dotyczy** — Supabase JS używa JWT w nagłówkach, nie ciasteczek.
- **Adopcja boardów** — tylko jeśli `owner_id IS NULL` i `share_guid IS NOT NULL`. Sprawdź w funkcji RPC po stronie bazy:

```sql
create or replace function public.adopt_orphan_board(board_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  is_active_user boolean;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_active into is_active_user from public.profiles where user_id = current_user_id;
  if not coalesce(is_active_user, false) then
    raise exception 'User is not active';
  end if;

  update public.boards
  set owner_id = current_user_id,
      share_guid = null
  where id = board_id
    and owner_id is null
    and share_guid is not null;
end;
$$;
```

- **Assign orphan to user (admin only)** — analogicznie RPC z sprawdzaniem `is_admin()`.

---

## 11. Firebase Hosting konfiguracja

`firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }],
    "headers": [
      {
        "source": "**/*.@(js|css|png|jpg|jpeg|svg|woff|woff2)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache" }
        ]
      }
    ]
  }
}
```

`.firebaserc`:

```json
{
  "projects": {
    "default": "trackboards"
  }
}
```

`package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && firebase deploy --only hosting"
  }
}
```

---

## 12. README.md — wygeneruj zawartość

Sekcje:
- Co to jest Trackboards (1 akapit)
- Stack (lista)
- Setup lokalny (clone, `npm install`, kopiowanie `.env.example` → `.env.local`, `npm run dev`)
- Setup Supabase (kroki: stworzenie projektu, odpalenie SQL ze schematem, włączenie Google OAuth)
- Setup Firebase (kroki: `firebase login`, `firebase init hosting`, `npm run deploy`)
- Struktura projektu (drzewo katalogów)

---

## 13. Plan implementacji — kolejność

Implementuj w tej kolejności (każdy krok niech będzie commitable):

1. **Scaffold Vite + React** + zainstaluj zależności (`@supabase/supabase-js`, `react-router-dom`)
2. **Tokens + global styles** (`tokens.css`, `global.css`, theme switcher)
3. **Supabase client + AuthContext** + komponenty `RequireAuth` / `RequireAdmin`
4. **Layout + Sidebar** (z mock data)
5. **Routing** — wszystkie ścieżki z placeholder stronami
6. **Boards API** (`src/lib/boards.js`)
7. **BoardFramework** — pełna implementacja na podstawie załączonego JSX (najważniejszy moduł, daj mu najwięcej uwagi)
8. **Home + auth flow** (logowanie Google, tworzenie anonimowego boardu)
9. **Trackboard (dashboard)** + tworzenie własnych boardów
10. **Board page** — pełna z toggle public/private, kopiowanie linku, adopcja
11. **Profile + Purgatory + Escape**
12. **Admin: boards, users, user boards, user purgatory**
13. **localStorage dla anonimów** (ostatnio odwiedzane)
14. **Firebase hosting config** + deploy test

---

## 14. Zasady jakości kodu

- **Spójność nazewnictwa** — wszystkie strony jako PascalCase, funkcje jako camelCase, CSS classes jako kebab-case
- **Komentarze** — TYLKO przy logice nieoczywistej (RLS, agregacje stanu). Nie komentuj oczywistego kodu.
- **Brak `any` / brak `// @ts-ignore`** — projekt jest w JSX, nie TS, więc to nie problem, ale staraj się o czysty kod
- **Małe pliki** — żaden plik > 400 linii. Jeśli się rozrasta, wydziel komponent.
- **CSS Modules — jedna konwencja**: nazwa pliku = nazwa komponentu (`Sidebar.module.css` dla `Sidebar.jsx`). Klasy w plikach: `.root`, `.item`, `.active` (semantyczne, nie wizualne).
- **Brak inline stylów** poza wyjątkami: dynamiczne wartości jak `style={{ background: color }}`.
- **Wszystkie modale i dropdowny** — używaj jednego komponentu `<Modal>` i `<Dropdown>` dla spójności.
- **Wszystkie przyciski** — jeden komponent `<Button variant="primary|secondary|ghost|danger" size="sm|md">`.
- **Toast notyfikacje** — jeden `<Toast>` na całą aplikację (np. po akcji "skopiowano link", "zapisano", "błąd").

---

## 15. Załącznik

Użytkownik załączył plik `progress-tracker.jsx` zawierający aktualną implementację frameworku trackera. Przeanalizuj go DOKŁADNIE i przenieś logikę 1:1 do `BoardFramework.jsx`, modyfikując tylko:
- Storage layer (window.storage → callback do rodzica)
- Inline styles → CSS Modules
- Hardcoded curriculum → przyjmowane props
- Pusty stan początkowy = `{ modules: [] }`

---

## 16. Co dostarczyć na końcu

1. Pełny projekt w Vite + React, gotowy do `npm run dev`
2. SQL ze schematem bazy do uruchomienia w Supabase SQL Editor (jeden plik `supabase/schema.sql`)
3. `README.md` z instrukcją krok po kroku
4. `firebase.json` i `.firebaserc`
5. `.env.example`

**Nie hostuj automatycznie. Nie commituj `.env.local`. Nie zmieniaj wersji Reacta ani Vite samowolnie.**

Po zakończeniu pracy zrób krótki podsumowujący komentarz: co zaimplementowane, co działa, co wymaga ode mnie ręcznych kroków (np. odpalenie SQL w Supabase, dodanie redirect URL do Google OAuth dla nowego portu Vite).
