import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { format } from 'date-fns';

const AVATAR_COLORS = ['#4F8EF7', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#DB2777'];
function avatarColor(name = '') {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

const s = {
  page:    { maxWidth: '720px', margin: '0 auto', padding: '36px 24px' },
  hero:    { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' },
  avatar:  (name) => ({
    width: '64px', height: '64px', borderRadius: '50%',
    background: avatarColor(name),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '26px', fontWeight: '700', color: '#fff', flexShrink: 0,
  }),
  username: { fontSize: '22px', fontWeight: '700', color: '#f0f0f0', marginBottom: '4px' },
  email:    { fontSize: '13px', color: '#4a5568' },

  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px', marginBottom: '32px',
  },
  statCard:  { background: '#141824', border: '1px solid #1e2535', borderRadius: '10px', padding: '16px', textAlign: 'center' },
  statVal:   { fontSize: '28px', fontWeight: '700', color: '#f0f0f0', marginBottom: '4px' },
  statLabel: { fontSize: '11px', color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' },

  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  h2:     { fontSize: '15px', fontWeight: '600', color: '#94a3b8', margin: 0 },
  seeAll: { fontSize: '12px', color: '#4F8EF7', textDecoration: 'none' },

  row: {
    background: '#141824', border: '1px solid #1e2535', borderRadius: '8px',
    padding: '12px 16px', marginBottom: '6px',
    display: 'flex', alignItems: 'center', gap: '12px',
  },
  badge: (won) => ({
    flexShrink: 0, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
    background: won ? '#1a2e1a' : '#2e1a1a',
    color:      won ? '#4ade80' : '#f87171',
  }),
  rowBody: { flex: 1, minWidth: 0 },
  rowMain: { fontSize: '13px', color: '#e2e8f0', marginBottom: '2px' },
  rowSub:  { fontSize: '11px', color: '#4a5568' },
  viewBtn: { flexShrink: 0, color: '#4F8EF7', textDecoration: 'none', fontSize: '12px', fontWeight: '600' },

  loading: { textAlign: 'center', padding: '60px 0', color: '#4a5568', fontSize: '13px' },
};

export default function Profile({ session }) {
  const [profile, setProfile] = useState(null);
  const [recent,  setRecent]  = useState([]);
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: prof }, { data: allReps }, { data: recentReps }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('replays')
          .select('winner_username, player1_username')
          .eq('player1_id', session.user.id),
        supabase.from('replays')
          .select('id, player1_username, player1_leader, player2_username, player2_leader, winner_username, created_at, actions')
          .eq('player1_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setProfile(prof);
      setRecent(recentReps || []);

      if (allReps) {
        const total  = allReps.length;
        const wins   = allReps.filter(r => r.winner_username === r.player1_username).length;
        const losses = allReps.filter(r => r.winner_username && r.winner_username !== r.player1_username).length;
        const rate   = total > 0 ? Math.round((wins / total) * 100) : 0;
        setStats({ total, wins, losses, rate });
      }

      setLoading(false);
    }
    load();
  }, [session]);

  if (loading) return <div style={s.loading}>Loading profile...</div>;

  const username    = profile?.username    || session.user.email.split('@')[0];
  const displayName = profile?.display_name || username;

  return (
    <div style={s.page}>
      {/* Hero */}
      <div style={s.hero}>
        <div style={s.avatar(username)}>{username[0].toUpperCase()}</div>
        <div>
          <div style={s.username}>{displayName}</div>
          <div style={s.email}>{session.user.email}</div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={s.stats}>
          <div style={s.statCard}>
            <div style={s.statVal}>{stats.total}</div>
            <div style={s.statLabel}>Games</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#4ade80' }}>{stats.wins}</div>
            <div style={s.statLabel}>Wins</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: '#f87171' }}>{stats.losses}</div>
            <div style={s.statLabel}>Losses</div>
          </div>
          <div style={s.statCard}>
            <div style={{ ...s.statVal, color: stats.rate >= 50 ? '#4ade80' : '#f87171' }}>{stats.rate}%</div>
            <div style={s.statLabel}>Win Rate</div>
          </div>
        </div>
      )}

      {/* Recent games */}
      <div>
        <div style={s.sectionHeader}>
          <div style={s.h2}>Recent Games</div>
          <Link to="/replays" style={s.seeAll}>View all →</Link>
        </div>

        {recent.length === 0 ? (
          <div style={{ color: '#4a5568', fontSize: '13px', padding: '20px 0' }}>
            No games recorded yet.
          </div>
        ) : recent.map(r => {
          const won         = r.winner_username === r.player1_username;
          const noResult    = !r.winner_username;
          const actionCount = Array.isArray(r.actions) ? r.actions.length : 0;
          return (
            <div key={r.id} style={s.row}>
              <span style={s.badge(won)}>{noResult ? '—' : won ? 'W' : 'L'}</span>
              <div style={s.rowBody}>
                <div style={s.rowMain}>
                  vs {r.player2_username}
                  {r.player2_leader && (
                    <span style={{ color: '#4a5568', marginLeft: '6px', fontSize: '12px' }}>
                      {r.player2_leader}
                    </span>
                  )}
                </div>
                <div style={s.rowSub}>
                  {r.player1_leader && `${r.player1_leader} · `}
                  {actionCount} actions · {format(new Date(r.created_at), 'MMM d, yyyy')}
                </div>
              </div>
              <Link to={`/replays/${r.id}`} style={s.viewBtn}>View →</Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
