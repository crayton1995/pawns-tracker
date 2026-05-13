import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { format } from 'date-fns';

const s = {
  page:    { padding:'28px 32px', maxWidth:'1100px', margin:'0 auto' },
  header:  { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' },
  h1:      { fontSize:'20px', fontWeight:'700', color:'#f0f0f0' },
  table:   { width:'100%', borderCollapse:'collapse' },
  th:      { textAlign:'left', fontSize:'11px', color:'#64748b', fontWeight:'600', letterSpacing:'0.5px', padding:'8px 12px', borderBottom:'1px solid #1e2535', textTransform:'uppercase' },
  td:      { padding:'12px 12px', borderBottom:'1px solid #1e2535', fontSize:'13px', color:'#e2e8f0', verticalAlign:'middle' },
  badge:   (won) => ({ display:'inline-block', padding:'2px 8px', borderRadius:'4px', fontSize:'11px', fontWeight:'600', background: won ? '#1a2e1a' : '#2e1a1a', color: won ? '#4ade80' : '#f87171' }),
  link:    { color:'#4F8EF7', textDecoration:'none', fontSize:'12px' },
  empty:   { textAlign:'center', padding:'60px', color:'#4a5568' },
  actions: { display:'flex', gap:'8px', alignItems:'center' },
  iconBtn: { background:'transparent', border:'none', cursor:'pointer', color:'#64748b', fontSize:'14px', padding:'4px 6px', borderRadius:'4px' },
};

export default function Replays({ session }) {
  const [replays,  setReplays]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    loadReplays();
  }, []);

  async function loadReplays() {
    setLoading(true);
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', session.user.id)
      .single();

    if (profile) setUsername(profile.username);

    const { data, error } = await supabase
      .from('replays')
      .select('id, player1_username, player1_leader, player1_base, player2_username, player2_leader, player2_base, winner_username, game_format, created_at, share_token, is_public, actions')
      .eq('player1_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error) setReplays(data || []);
    setLoading(false);
  }

  async function togglePublic(replay) {
    await supabase.from('replays').update({ is_public: !replay.is_public }).eq('id', replay.id);
    setReplays(prev => prev.map(r => r.id === replay.id ? { ...r, is_public: !r.is_public } : r));
  }

  async function deleteReplay(id) {
    if (!confirm('Delete this replay?')) return;
    await supabase.from('replays').delete().eq('id', id);
    setReplays(prev => prev.filter(r => r.id !== id));
  }

  function copyShareLink(token) {
    const url = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(url);
  }

  if (loading) return <div style={s.empty}>Loading replays...</div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.h1}>My Replays</h1>
        <span style={{ fontSize:'13px', color:'#64748b' }}>{replays.length} games recorded</span>
      </div>

      {replays.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize:'32px', marginBottom:'12px' }}>🎮</div>
          <div>No replays yet — play a game on Karabast with the extension running!</div>
        </div>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Date</th>
              <th style={s.th}>Player 1</th>
              <th style={s.th}>Player 2</th>
              <th style={s.th}>Winner</th>
              <th style={s.th}>Actions recorded</th>
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {replays.map(r => {
              const won = r.winner_username === r.player1_username;
              const actionCount = Array.isArray(r.actions) ? r.actions.length : 0;
              return (
                <tr key={r.id}>
                  <td style={s.td}>
                    <div>{format(new Date(r.created_at), 'MMM d, yyyy')}</div>
                    <div style={{ fontSize:'11px', color:'#64748b' }}>{format(new Date(r.created_at), 'h:mm a')}</div>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight:'600' }}>{r.player1_username}</div>
                    {r.player1_leader && <div style={{ fontSize:'11px', color:'#94a3b8' }}>{r.player1_leader}</div>}
                    {r.player1_base   && <div style={{ fontSize:'11px', color:'#64748b' }}>{r.player1_base}</div>}
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight:'600' }}>{r.player2_username}</div>
                    {r.player2_leader && <div style={{ fontSize:'11px', color:'#94a3b8' }}>{r.player2_leader}</div>}
                    {r.player2_base   && <div style={{ fontSize:'11px', color:'#64748b' }}>{r.player2_base}</div>}
                  </td>
                  <td style={s.td}>
                    {r.winner_username
                      ? <span style={s.badge(won)}>{won ? 'Win' : 'Loss'}</span>
                      : <span style={{ color:'#64748b', fontSize:'12px' }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <span style={{ color:'#94a3b8' }}>{actionCount} events</span>
                  </td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <Link to={`/replays/${r.id}`} style={s.link} title="View replay">▶ View</Link>
                      <button style={s.iconBtn} onClick={() => copyShareLink(r.share_token)} title={r.is_public ? 'Copy share link' : 'Make public first'}>
                        🔗
                      </button>
                      <button style={s.iconBtn} onClick={() => togglePublic(r)} title={r.is_public ? 'Make private' : 'Make public'}>
                        {r.is_public ? '🌐' : '🔒'}
                      </button>
                      <button style={{ ...s.iconBtn, color:'#f87171' }} onClick={() => deleteReplay(r.id)} title="Delete">
                        🗑
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
