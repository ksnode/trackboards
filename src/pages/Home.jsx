import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { loading } = useAuth();

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Ładowanie...</div>;

  // Both logged-in and anonymous go to /boards — content differs in Boards.jsx
  return <Navigate to="/boards" replace />;
}