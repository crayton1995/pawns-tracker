import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const AVATAR_COLORS = ['#4F8EF7', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#DB2777'];
function avatarColor(name = '') {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

const s = {
  nav: {
    background:    '#141824',
    borderBottom:  '1px solid #1e2535',
    padding:       '0 24px',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'space-between',
    height:        '52px',
    position:      'sticky',
    top:           0,
    zIndex:        100,
  },
  left:  { display: 'flex', alignItems: 'center', gap: '24px' },
  brand: { fontWeight: 700, fontSize: '15px', color: '#f0f0f0', textDecoration: 'none', letterSpacing: '0.3px' },
  navLink: (active) => ({
    color:          active ? '#f0f0f0' : '#64748b',
    fontSize:       '13px',
    textDecoration: 'none',
    fontWeight:     active ? '600' : '400',
    borderBottom:   active ? '2px solid #4F8EF7' : '2px solid transparent',
    paddingBottom:  '2px',
  }),
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  myReplaysBtn: {
    background:     '#4F8EF7',
    border:         'none',
    borderRadius:   '6px',
    color:          '#fff',
    cursor:         'pointer',
    fontSize:       '13px',
    fontWeight:     '600',
    padding:        '6px 14px',
    textDecoration: 'none',
  },
  profileBtn: {
    display:        'flex',
    alignItems:     'center',
    gap:            '7px',
    background:     'transparent',
    border:         '1px solid #1e2535',
    borderRadius:   '20px',
    padding:        '4px 10px 4px 4px',
    cursor:         'pointer',
    textDecoration: 'none',
    color:          '#94a3b8',
    fontSize:       '12px',
  },
  avatar: (name) => ({
    width:          '24px',
    height:         '24px',
    borderRadius:   '50%',
    background:     avatarColor(name),
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       '11px',
    fontWeight:     '700',
    color:          '#fff',
    flexShrink:     0,
  }),
  logoutBtn: {
    background:   'transparent',
    border:       '1px solid #2d3548',
    borderRadius: '6px',
    color:        '#64748b',
    cursor:       'pointer',
    fontSize:     '12px',
    padding:      '5px 12px',
  },
};

export default function Navbar({ session }) {
  const navigate = useNavigate();
  const location = useLocation();
  const username = session.user.email.split('@')[0];

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  return (
    <nav style={s.nav}>
      {/* Left: brand + nav links */}
      <div style={s.left}>
        <Link to="/" style={s.brand}>⚡ Pawns Replays</Link>
        <Link to="/"        style={s.navLink(location.pathname === '/')}>Home</Link>
        <Link to="/replays" style={s.navLink(location.pathname === '/replays')}>My Replays</Link>
      </div>

      {/* Right: My Replays CTA + profile pill + logout */}
      <div style={s.right}>
        <Link to="/replays" style={s.myReplaysBtn}>My Replays</Link>
        <Link to="/profile" style={s.profileBtn}>
          <div style={s.avatar(username)}>{username[0].toUpperCase()}</div>
          {username}
        </Link>
        <button onClick={handleLogout} style={s.logoutBtn}>Log out</button>
      </div>
    </nav>
  );
}
