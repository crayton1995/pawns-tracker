import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase.js';
import Navbar        from './components/Navbar.jsx';
import Login         from './pages/Login.jsx';
import Replays       from './pages/Replays.jsx';
import ReplayViewer  from './pages/ReplayViewer.jsx';
import ShareViewer   from './pages/ShareViewer.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/replays" replace />} />

        {/* Protected routes */}
        <Route path="/replays"     element={session ? <Replays session={session} />     : <Navigate to="/login" replace />} />
        <Route path="/replays/:id" element={session ? <ReplayViewer session={session} /> : <Navigate to="/login" replace />} />

        {/* Default */}
        <Route path="*" element={<Navigate to={session ? '/replays' : '/login'} replace />} />
      </Routes>
    </>
  );
}
