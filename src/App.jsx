import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, RequireAuth, RequireAdmin } from './lib/auth';
import { Layout } from './components/Layout/Layout';

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
          
          {/* Public or Owner-only Board */}
          <Route path="/board/:guid" element={<Board />} />

          {/* Dev test route */}
          <Route path="/test-framework" element={<TestFramework />} />

          {/* Authenticated Layout */}
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route path="/trackboard" element={<Trackboard />} />
            
            {/* Profile Hub */}
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/boards" element={<ProfileBoards />} />
            <Route path="/profile/purgatory" element={<ProfilePurgatory />} />
            <Route path="/profile/escape" element={<ProfileEscape />} />
          </Route>

          {/* Admin Layout */}
          <Route element={<RequireAdmin><Layout /></RequireAdmin>}>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/boards" element={<AdminBoards />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/:id/boards" element={<AdminUserBoards />} />
            <Route path="/admin/users/:id/purgatory" element={<AdminUserPurgatory />} />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<div>404 - Not Found</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
