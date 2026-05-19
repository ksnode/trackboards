import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, RequireAuth, RequireAdmin } from './lib/auth';
import { Layout } from './components/Layout/Layout';
import { BoardLayout } from './components/Layout/BoardLayout';

// Pages
import Home from './pages/Home';
import Trackboard from './pages/Trackboard';
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

          {/* Board — sidebar if logged in, standalone if anon */}
          <Route path="/board/:guid" element={<BoardLayout />}>
            <Route index element={<Board />} />
          </Route>

          {/* Dev test route */}
          <Route path="/test-framework" element={<TestFramework />} />

          {/* Authenticated Layout */}
          <Route element={<Layout />}>
            <Route path="/trackboard" element={<RequireAuth><Trackboard /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/profile/boards" element={<RequireAuth><ProfileBoards /></RequireAuth>} />
            <Route path="/profile/purgatory" element={<RequireAuth><ProfilePurgatory /></RequireAuth>} />
            <Route path="/profile/escape" element={<RequireAuth><ProfileEscape /></RequireAuth>} />
          </Route>

          {/* Admin Layout */}
          <Route element={<Layout />}>
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
