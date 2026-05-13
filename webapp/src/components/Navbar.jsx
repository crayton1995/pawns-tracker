import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const s = {
  nav: {
    background: '#141824',
    borderBottom: '1px solid #1e2535',
    padding: '0 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '52px',
  },
  brand: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#f0f0f0',
    textDecoration: 'none',
    letterSpacing: '0.3px',
  },
  right: { display: 'flex', alignItems: 'center', gap: '16px' },
  link: { color: '#94a3b8', fontSize: '13px', textDecoration: 'none' },
  btn: {
    background: 'transparent',
    border: '1px solid #2d3548',
    borderRadius: '6px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '5px 12px',
  },
};

export default function Navbar({ session }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <nav style={s.nav}>
      <Link to="/replays" style={s.brand}>⚡ Pawns Replays</Link>
      <div style={s.right}>
        <Link to="/replays" style={s.link}>My Replays</Link>
        <span style={{ color: '#4a5568', fontSize: '12px' }}>
          {session.user.email}
        </span>
        <button onClick={handleLogout} style={s.btn}>Log out</button>
      </div>
    </nav>
  );
}
