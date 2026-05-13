/**
 * ShareViewer.jsx — Public replay view (no login required)
 * Accessible at /share/:token
 */
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { format } from 'date-fns';

const s = {
  page:    { maxWidth:'900px', margin:'0 auto', padding:'32px 24px' },
  brand:   { fontSize:'13px', color:'#64748b', marginBottom:'24px', display:'block' },
  h1:      { fontSize:'20px', fontWeight:'700', color:'#f0f0f0', marginBottom:'4px' },
  meta:    { fontSize:'12px', color:'#64748b', marginBottom:'20px' },
  players: { display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'12px', alignItems:'center', background:'#141824', border:'1px solid #1e2535', borderRadius:'10px', padding:'16px', marginBottom:'20px' },
  pname:   { fontWeight:'700', fontSize:'14px', color:'#f0f0f0' },
  pleader: { fontSize:'12px', color:'#94a3b8' },
  vs:      { color:'#64748b', fontWeight:'700', textAlign:'center' },
  winner:  { textAlign:'center', fontSize:'13px', color:'#4ade80', fontWeight:'600', marginBottom:'20px' },
  controls:{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', background:'#141824', padding:'12px 16px', borderRadius:'8px', border:'1px solid #1e2535' },
  ctrlBtn: { background:'#1e2535', border:'none', color:'#e2e8f0', cursor:'pointer', borderRadius:'6px', padding:'6px 12px', fontSize:'13px' },
  progress:{ flex:1, height:'4px', background:'#1e2535', borderRadius:'2px', cursor:'pointer' },
  progFill:(pct) => ({ width:`${pct}%`, height:'100%', background:'#4F8EF7', borderRadius:'2px' }),
  counter: { fontSize:'12px', color:'#64748b', whiteSpace:'nowrap' },
  logWrap: { background:'#141824', border:'1px solid #1e2535', borderRadius:'8px', maxHeight:'360px', overflowY:'auto' },
  action:  (active) => ({ padding:'8px 12px', borderBottom:'1px solid #1e2535', cursor:'pointer', background: active ? '#1a2540' : 'transparent' }),
  aEvent:  { fontSize:'11px', color:'#4F8EF7', fontWeight:'600' },
  aTime:   { fontSize:'10px', color:'#4a5568' },
  error:   { textAlign:'center', padding:'60px', color:'#f87171' },
};

export default function ShareViewer() {
  const { token } = useParams();
  const [replay,       setReplay]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [notFound,     setNotFound]     = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => { loadReplay(); }, [token]);

  async function loadReplay() {
    setLoading(true);
    // Use the public RPC function — no auth needed
    const { data, error } = await supabase
      .rpc('get_replay_by_token', { token })
      .single();

    if (error || !data) setNotFound(true);
    else setReplay(data);
    setLoading(false);
  }

  if (loading) return <div style={{ padding:'60px', textAlign:'center', color:'#64748b' }}>Loading...</div>;
  if (notFound) return (
    <div style={s.error}>
      <div style={{ fontSize:'32px', marginBottom:'12px' }}>🔒</div>
      <div>This replay is private or doesn't exist.</div>
      <div style={{ marginTop:'12px' }}><Link to="/" style={{ color:'#4F8EF7' }}>Go to Pawns Replays</Link></div>
    </div>
  );

  const actions = replay.actions || [];
  const total   = actions.length;
  const current = actions[currentIndex];
  const pct     = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  return (
    <div style={s.page}>
      <span style={s.brand}>⚡ Pawns Replays — Shared Game</span>

      <h1 style={s.h1}>{replay.player1_username} vs {replay.player2_username}</h1>
      <div style={s.meta}>
        {format(new Date(replay.created_at), 'MMMM d, yyyy')}
        {replay.game_format && ` · ${replay.game_format}`}
        {` · ${total} events`}
      </div>

      <div style={s.players}>
        <div>
          <div style={s.pname}>{replay.player1_username}</div>
          {replay.player1_leader && <div style={s.pleader}>{replay.player1_leader}</div>}
        </div>
        <div style={s.vs}>VS</div>
        <div style={{ textAlign:'right' }}>
          <div style={s.pname}>{replay.player2_username}</div>
          {replay.player2_leader && <div style={s.pleader}>{replay.player2_leader}</div>}
        </div>
      </div>

      {replay.winner_username && <div style={s.winner}>🏆 {replay.winner_username} wins</div>}

      {total > 0 ? (
        <>
          <div style={s.controls}>
            <button style={s.ctrlBtn} onClick={() => setCurrentIndex(0)}>⏮</button>
            <button style={s.ctrlBtn} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}>◀</button>
            <button style={s.ctrlBtn} onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}>▶</button>
            <button style={s.ctrlBtn} onClick={() => setCurrentIndex(total - 1)}>⏭</button>
            <div style={s.progress} onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCurrentIndex(Math.round(((e.clientX - rect.left) / rect.width) * (total - 1)));
            }}>
              <div style={s.progFill(pct)} />
            </div>
            <span style={s.counter}>{currentIndex + 1} / {total}</span>
          </div>

          {current && (
            <div style={{ background:'#141824', border:'1px solid #1e2535', borderRadius:'8px', padding:'14px 16px', marginBottom:'16px' }}>
              <div style={{ fontSize:'11px', color:'#4F8EF7', fontWeight:'700', marginBottom:'6px', textTransform:'uppercase' }}>
                {current.event}
              </div>
              <pre style={{ fontSize:'11px', color:'#94a3b8', fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:'160px', overflowY:'auto' }}>
                {JSON.stringify(current.data, null, 2)}
              </pre>
            </div>
          )}

          <div style={s.logWrap}>
            {actions.map((a, i) => (
              <div key={i} style={s.action(i === currentIndex)} onClick={() => setCurrentIndex(i)}>
                <div style={s.aEvent}>{a.event}</div>
                {a.t && <div style={s.aTime}>{format(new Date(a.t), 'h:mm:ss a')}</div>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ color:'#64748b' }}>No events recorded.</div>
      )}

      <div style={{ marginTop:'24px', textAlign:'center', fontSize:'12px', color:'#4a5568' }}>
        <Link to="/" style={{ color:'#4F8EF7' }}>⚡ Pawns Replays</Link> — Star Wars Unlimited game recorder
      </div>
    </div>
  );
}
