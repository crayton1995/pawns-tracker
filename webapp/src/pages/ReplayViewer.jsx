import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { format } from 'date-fns';
import Comments from '../components/Comments.jsx';

const s = {
  page:      { display:'flex', gap:'0', minHeight:'calc(100vh - 52px)' },
  main:      { flex:1, padding:'28px 32px', overflowY:'auto' },
  sidebar:   { width:'360px', borderLeft:'1px solid #1e2535', display:'flex', flexDirection:'column', overflowY:'auto' },
  back:      { color:'#64748b', fontSize:'12px', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'4px', marginBottom:'16px' },
  h1:        { fontSize:'18px', fontWeight:'700', color:'#f0f0f0', marginBottom:'4px' },
  meta:      { fontSize:'12px', color:'#64748b', marginBottom:'20px' },
  players:   { display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'12px', alignItems:'center', background:'#141824', border:'1px solid #1e2535', borderRadius:'10px', padding:'16px', marginBottom:'20px' },
  player:    { display:'flex', flexDirection:'column', gap:'2px' },
  pname:     { fontWeight:'700', fontSize:'14px', color:'#f0f0f0' },
  pleader:   { fontSize:'12px', color:'#94a3b8' },
  pbase:     { fontSize:'11px', color:'#64748b' },
  vs:        { color:'#64748b', fontWeight:'700', textAlign:'center' },
  winner:    { textAlign:'center', fontSize:'12px', color:'#4ade80', fontWeight:'600', marginBottom:'20px' },
  // Timeline controls
  controls:  { display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px', background:'#141824', padding:'12px 16px', borderRadius:'8px', border:'1px solid #1e2535' },
  ctrlBtn:   { background:'#1e2535', border:'none', color:'#e2e8f0', cursor:'pointer', borderRadius:'6px', padding:'6px 12px', fontSize:'13px' },
  progress:  { flex:1, height:'4px', background:'#1e2535', borderRadius:'2px', cursor:'pointer', position:'relative' },
  progFill:  (pct) => ({ width:`${pct}%`, height:'100%', background:'#4F8EF7', borderRadius:'2px', transition:'width 0.1s' }),
  counter:   { fontSize:'12px', color:'#64748b', whiteSpace:'nowrap' },
  // Action log
  logWrap:   { background:'#141824', border:'1px solid #1e2535', borderRadius:'8px', maxHeight:'380px', overflowY:'auto' },
  action:    (active) => ({ padding:'8px 12px', borderBottom:'1px solid #1e2535', cursor:'pointer', background: active ? '#1a2540' : 'transparent', transition:'background 0.1s' }),
  aEvent:    { fontSize:'11px', color:'#4F8EF7', fontWeight:'600', marginBottom:'2px' },
  aTime:     { fontSize:'10px', color:'#4a5568' },
  aData:     { fontSize:'11px', color:'#94a3b8', marginTop:'2px', fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:'80px', overflowY:'auto' },
  // Share
  shareRow:  { display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px' },
  shareBtn:  { background:'#1e2535', border:'1px solid #2d3548', borderRadius:'6px', color:'#94a3b8', cursor:'pointer', fontSize:'12px', padding:'6px 12px' },
};

export default function ReplayViewer({ session }) {
  const { id } = useParams();
  const [replay,       setReplay]       = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [shareMsg,     setShareMsg]     = useState('');
  const intervalRef = useRef(null);
  const logRef = useRef(null);

  useEffect(() => {
    loadReplay();
    return () => clearInterval(intervalRef.current);
  }, [id]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(i => {
          if (i >= (replay?.actions?.length ?? 0) - 1) {
            setPlaying(false);
            clearInterval(intervalRef.current);
            return i;
          }
          return i + 1;
        });
      }, 800);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, replay]);

  // Auto-scroll log to current action
  useEffect(() => {
    if (!logRef.current) return;
    const el = logRef.current.querySelector(`[data-index="${currentIndex}"]`);
    el?.scrollIntoView({ block:'nearest', behavior:'smooth' });
  }, [currentIndex]);

  async function loadReplay() {
    setLoading(true);
    const { data, error } = await supabase
      .from('replays')
      .select('*')
      .eq('id', id)
      .single();
    if (!error) setReplay(data);
    setLoading(false);
  }

  function copyShareLink() {
    if (!replay) return;
    const url = `${window.location.origin}/share/${replay.share_token}`;
    navigator.clipboard.writeText(url);
    setShareMsg('Link copied!');
    setTimeout(() => setShareMsg(''), 2000);
  }

  async function togglePublic() {
    if (!replay) return;
    const { data } = await supabase
      .from('replays')
      .update({ is_public: !replay.is_public })
      .eq('id', replay.id)
      .select()
      .single();
    if (data) setReplay(data);
  }

  if (loading) return <div style={{ padding:'40px', color:'#64748b' }}>Loading...</div>;
  if (!replay) return <div style={{ padding:'40px', color:'#f87171' }}>Replay not found.</div>;

  const actions = replay.actions || [];
  const total   = actions.length;
  const current = actions[currentIndex];
  const pct     = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;

  return (
    <div style={s.page}>
      {/* ── Main Column ── */}
      <div style={s.main}>
        <Link to="/replays" style={s.back}>← Back to My Replays</Link>

        <h1 style={s.h1}>
          {replay.player1_username} vs {replay.player2_username}
        </h1>
        <div style={s.meta}>
          {format(new Date(replay.created_at), 'MMMM d, yyyy · h:mm a')}
          {replay.game_format && ` · ${replay.game_format}`}
          {` · ${total} events recorded`}
        </div>

        {/* Player Cards */}
        <div style={s.players}>
          <div style={s.player}>
            <div style={s.pname}>{replay.player1_username}</div>
            {replay.player1_leader && <div style={s.pleader}>{replay.player1_leader}</div>}
            {replay.player1_base   && <div style={s.pbase}>{replay.player1_base}</div>}
          </div>
          <div style={s.vs}>VS</div>
          <div style={{ ...s.player, alignItems:'flex-end', textAlign:'right' }}>
            <div style={s.pname}>{replay.player2_username}</div>
            {replay.player2_leader && <div style={s.pleader}>{replay.player2_leader}</div>}
            {replay.player2_base   && <div style={s.pbase}>{replay.player2_base}</div>}
          </div>
        </div>

        {replay.winner_username && (
          <div style={s.winner}>🏆 Winner: {replay.winner_username}</div>
        )}

        {/* Share Controls */}
        <div style={s.shareRow}>
          <button style={s.shareBtn} onClick={togglePublic}>
            {replay.is_public ? '🌐 Public' : '🔒 Private'} — click to toggle
          </button>
          <button style={s.shareBtn} onClick={copyShareLink}>
            🔗 Copy Share Link
          </button>
          {shareMsg && <span style={{ fontSize:'12px', color:'#4ade80' }}>{shareMsg}</span>}
        </div>

        {/* ─ Playback Controls ─ */}
        {total > 0 ? (
          <>
            <div style={s.controls}>
              <button style={s.ctrlBtn} onClick={() => setCurrentIndex(0)} title="First">⏮</button>
              <button style={s.ctrlBtn} onClick={() => setCurrentIndex(i => Math.max(0, i - 1))} title="Back">◀</button>
              <button style={s.ctrlBtn} onClick={() => setPlaying(p => !p)}>
                {playing ? '⏸ Pause' : '▶ Play'}
              </button>
              <button style={s.ctrlBtn} onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))} title="Next">▶</button>
              <button style={s.ctrlBtn} onClick={() => setCurrentIndex(total - 1)} title="Last">⏭</button>

              {/* Scrubber */}
              <div style={s.progress} onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                setCurrentIndex(Math.round(ratio * (total - 1)));
              }}>
                <div style={s.progFill(pct)} />
              </div>

              <span style={s.counter}>{currentIndex + 1} / {total}</span>
            </div>

            {/* Current Action Detail */}
            {current && (
              <div style={{ background:'#141824', border:'1px solid #1e2535', borderRadius:'8px', padding:'14px 16px', marginBottom:'16px' }}>
                <div style={{ fontSize:'11px', color:'#4F8EF7', fontWeight:'700', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  Event: {current.event}
                </div>
                <pre style={{ fontSize:'11px', color:'#94a3b8', fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:'200px', overflowY:'auto' }}>
                  {JSON.stringify(current.data, null, 2)}
                </pre>
                <div style={{ fontSize:'10px', color:'#4a5568', marginTop:'8px' }}>
                  {current.t ? format(new Date(current.t), 'h:mm:ss a') : ''}
                </div>
              </div>
            )}

            {/* Full Action Log */}
            <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'8px' }}>All events</div>
            <div style={s.logWrap} ref={logRef}>
              {actions.map((action, i) => (
                <div
                  key={i}
                  data-index={i}
                  style={s.action(i === currentIndex)}
                  onClick={() => setCurrentIndex(i)}
                >
                  <div style={s.aEvent}>{action.event}</div>
                  {action.t && <div style={s.aTime}>{format(new Date(action.t), 'h:mm:ss a')}</div>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ color:'#64748b', fontSize:'13px' }}>No actions recorded in this replay.</div>
        )}
      </div>

      {/* ── Comments Sidebar ── */}
      <div style={s.sidebar}>
        <Comments replayId={replay.id} session={session} currentActionIndex={currentIndex} />
      </div>
    </div>
  );
}
