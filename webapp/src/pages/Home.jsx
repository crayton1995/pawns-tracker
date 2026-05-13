import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { format, formatDistanceToNow, startOfMonth, addMonths } from 'date-fns';

const AVATAR_COLORS = ['#4F8EF7', '#7C3AED', '#059669', '#DC2626', '#D97706', '#0891B2', '#DB2777'];
function avatarColor(name = '') {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}

// Build filter options once: "Recent" + last 7 months
const FILTERS = [
  { label: 'Recent', value: 'recent' },
  ...Array.from({ length: 7 }, (_, i) => {
    const d = startOfMonth(addMonths(new Date(), -i));
    return {
      label: format(d, 'MMM yyyy'),
      value: format(d, 'yyyy-MM'),
      start: d.toISOString(),
      end:   addMonths(d, 1).toISOString(),
    };
  }),
];

const s = {
  page:   { maxWidth: '820px', margin: '0 auto', padding: '36px 24px' },

  header: { marginBottom: '20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' },
  h1:     { fontSize: '22px', fontWeight: '700', color: '#f0f0f0', margin: 0 },
  sub:    { fontSize: '13px', color: '#4a5568', marginTop: '4px' },
  seeAll: { fontSize: '12px', color: '#4F8EF7', textDecoration: 'none', flexShrink: 0 },

  filterBar: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '20px' },
  chip: (active) => ({
    background:   active ? '#4F8EF7'     : '#141824',
    border:       active ? '1px solid #4F8EF7' : '1px solid #1e2535',
    borderRadius: '20px',
    color:        active ? '#fff'        : '#94a3b8',
    cursor:       'pointer',
    fontSize:     '12px',
    fontWeight:   active ? '600' : '400',
    padding:      '5px 13px',
    whiteSpace:   'nowrap',
    transition:   'all 0.12s',
  }),

  count: { fontSize: '12px', color: '#4a5568', marginBottom: '16px' },

  card: {
    background:   '#141824',
    border:       '1px solid #1e2535',
    borderRadius: '10px',
    padding:      '14px 18px',
    marginBottom: '8px',
    display:      'flex',
    alignItems:   'center',
    gap:          '14px',
  },
  avatar: (name) => ({
    width:          '40px',
    height:         '40px',
    borderRadius:   '50%',
    background:     avatarColor(name),
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       '16px',
    fontWeight:     '700',
    color:          '#fff',
    flexShrink:     0,
  }),
  body:  { flex: 1, minWidth: 0 },

  row1: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '5px' },
  name: { fontSize: '14px', fontWeight: '600', color: '#f0f0f0' },
  vs:   { fontSize: '10px', color: '#4a5568', fontWeight: '700', letterSpacing: '0.5px' },
  deck: { fontSize: '11px', color: '#64748b', background: '#1e2535', borderRadius: '4px', padding: '1px 6px' },
  ownerTag: {
    fontSize: '10px', color: '#4a5568', borderRadius: '4px',
    border: '1px solid #1e2535', padding: '1px 6px', fontWeight: '600',
    letterSpacing: '0.4px', textTransform: 'uppercase',
  },

  row2: { display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' },
  badge: (won) => ({
    display: 'inline-block', padding: '2px 7px', borderRadius: '4px',
    fontSize: '11px', fontWeight: '600',
    background: won ? '#1a2e1a' : '#2e1a1a',
    color:      won ? '#4ade80' : '#f87171',
  }),
  dot:  { width: '3px', height: '3px', borderRadius: '50%', background: '#2d3548', flexShrink: 0 },
  meta: { fontSize: '11px', color: '#4a5568' },
  date: { fontSize: '11px', color: '#64748b', fontWeight: '500' },

  right: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 },
  viewBtn: {
    background:     '#1a2035',
    border:         '1px solid #2d3548',
    borderRadius:   '7px',
    color:          '#4F8EF7',
    cursor:         'pointer',
    fontSize:       '12px',
    fontWeight:     '600',
    padding:        '6px 14px',
    textDecoration: 'none',
    whiteSpace:     'nowrap',
  },

  empty:   { textAlign: 'center', padding: '60px 0', color: '#4a5568' },
  loading: { textAlign: 'center', padding: '60px 0', color: '#4a5568', fontSize: '13px' },
};

export default function Home({ session }) {
  const [replays,    setReplays]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeFilter, setActive]  = useState('recent');

  const load = useCallback(async (filterValue) => {
    setLoading(true);
    const filter = FILTERS.find(f => f.value === filterValue);

    let q = supabase
      .from('replays')
      .select('id, player1_id, player1_username, player1_leader, player1_base, player2_username, player2_leader, player2_base, winner_username, created_at, actions')
      .order('created_at', { ascending: false });

    if (filterValue === 'recent') {
      q = q.limit(10);
    } else {
      q = q.gte('created_at', filter.start).lt('created_at', filter.end);
    }

    const { data, error } = await q;
    if (!error) setReplays(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load('recent'); }, [load]);

  function selectFilter(value) {
    setActive(value);
    load(value);
  }

  const isRecent = activeFilter === 'recent';
  const activeLabel = FILTERS.find(f => f.value === activeFilter)?.label ?? '';

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.h1}>Recent Activity</div>
          <div style={s.sub}>Replays across all profiles</div>
        </div>
        <Link to="/replays" style={s.seeAll}>My Replays →</Link>
      </div>

      {/* Month filter chips */}
      <div style={s.filterBar}>
        {FILTERS.map(f => (
          <button
            key={f.value}
            style={s.chip(activeFilter === f.value)}
            onClick={() => selectFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Result count */}
      {!loading && (
        <div style={s.count}>
          {isRecent
            ? `${replays.length} most recent`
            : `${replays.length} game${replays.length !== 1 ? 's' : ''} in ${activeLabel}`}
        </div>
      )}

      {loading ? (
        <div style={s.loading}>Loading...</div>
      ) : replays.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎮</div>
          <div>{isRecent ? 'No replays yet — play a game on Karabast!' : `No games recorded in ${activeLabel}.`}</div>
        </div>
      ) : replays.map(r => {
        const name1       = r.player1_username || 'Unknown';
        const name2       = r.player2_username || 'Unknown';
        const isOwn       = r.player1_id === session?.user?.id;
        const winnerIsP1  = r.winner_username && r.winner_username === r.player1_username;
        const actionCount = Array.isArray(r.actions) ? r.actions.length : 0;
        const createdAt   = new Date(r.created_at);

        return (
          <div key={r.id} style={s.card}>
            <div style={s.avatar(name1)} title={name1}>
              {name1[0].toUpperCase()}
            </div>

            <div style={s.body}>
              {/* Player matchup */}
              <div style={s.row1}>
                <span style={s.name}>{name1}</span>
                {isOwn && <span style={s.ownerTag}>you</span>}
                {r.player1_leader && <span style={s.deck}>{r.player1_leader}</span>}
                <span style={s.vs}>VS</span>
                <span style={s.name}>{name2}</span>
                {r.player2_leader && <span style={s.deck}>{r.player2_leader}</span>}
              </div>

              {/* Meta: winner · actions · date */}
              <div style={s.row2}>
                {r.winner_username && (
                  <>
                    <span style={s.badge(winnerIsP1)}>{r.winner_username} won</span>
                    <div style={s.dot} />
                  </>
                )}
                <span style={s.meta}>{actionCount} actions</span>
                <div style={s.dot} />
                <span style={s.date}>{format(createdAt, 'MMM d, yyyy')}</span>
                <div style={s.dot} />
                <span style={s.meta}>{formatDistanceToNow(createdAt, { addSuffix: true })}</span>
              </div>
            </div>

            <Link to={`/replays/${r.id}`} style={s.viewBtn}>View →</Link>
          </div>
        );
      })}
    </div>
  );
}
