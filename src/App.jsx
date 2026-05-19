import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, RequireAuth, RequireAdmin } from './lib/auth';
import { Layout } from './components/Layout/Layout';

// Pages
import Home from './pages/Home';
import Boards from './pages/Boards';
import Board from './pages/Board';
import Profile from './pages/Profile';
import ProfileBoards from './pages/ProfileBoards';
import ProfilePurgatory from './pages/ProfilePurgatory';
import ProfileEscape from './pages/ProfileEscape';
import Admin from './pages/Admin';
import AdminBoards from './pages/AdminBoards';
import AdminUsers from './pages/AdminUsers';
import AdminUserBoards from './pages/AdminUserBoards';
import AdminUserPurgatory from './pages/AdminUserPurgatory';
import TestFramework from './pages/TestFramework';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Home */}
          <Route path="/" element={<Home />} />

          {/* Dev test route */}
          <Route path="/test-framework" element={<TestFramework />} />

          {/* Shared Layout — sidebar when logged in, content header always */}
          <Route element={<Layout />}>
            {/* Board — accessible by anyone (anon or auth) */}
            <Route path="/board/:guid" element={<Board />} />

            {/* Authenticated routes */}
            <Route path="/boards" element={<RequireAuth><Boards /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/profile/boards" element={<RequireAuth><ProfileBoards /></RequireAuth>} />
            <Route path="/profile/purgatory" element={<RequireAuth><ProfilePurgatory /></RequireAuth>} />
            <Route path="/profile/escape" element={<RequireAuth><ProfileEscape /></RequireAuth>} />

            {/* Admin routes */}
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route path="/admin/boards" element={<RequireAdmin><AdminBoards /></RequireAdmin>} />
            <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
            <Route path="/admin/users/:id/boards" element={<RequireAdmin><AdminUserBoards /></RequireAdmin>} />
            <Route path="/admin/users/:id/purgatory" element={<RequireAdmin><AdminUserPurgatory /></RequireAdmin>} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
