import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Navbar        from './components/Navbar.jsx';
import Login         from './pages/Login.jsx';
import Home          from './pages/Home.jsx';
import Replays       from './pages/Replays.jsx';
import ReplayViewer  from './pages/ReplayViewer.jsx';
import ShareViewer   from './pages/ShareViewer.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Profile       from './pages/Profile.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#64748b' }}>
        Loading...
      </div>
    );
  }

  return (
    <>
      {session && <Navbar session={session} />}
      <Routes>
        {/* Public share link — no auth required */}
        <Route path="/share/:token" element={<ShareViewer />} />

        {/* Auth routes */}
        <Route path="/login"          element={!session ? <Login /> : <Navigate to="/" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route path="/"            element={session ? <Home session={session} />          : <Navigate to="/login" replace />} />
        <Route path="/replays"     element={session ? <Replays session={session} />       : <Navigate to="/login" replace />} />
        <Route path="/replays/:id" element={session ? <ReplayViewer session={session} />  : <Navigate to="/login" replace />} />
        <Route path="/profile"     element={session ? <Profile session={session} />       : <Navigate to="/login" replace />} />

        {/* Default */}
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </>
  );
}
