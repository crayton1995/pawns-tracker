import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';

const s = {
  page:  { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'24px' },
  card:  { background:'#141824', border:'1px solid #1e2535', borderRadius:'12px', padding:'32px', width:'100%', maxWidth:'360px' },
  title: { fontSize:'20px', fontWeight:'700', color:'#f0f0f0', marginBottom:'6px' },
  sub:   { fontSize:'13px', color:'#64748b', marginBottom:'24px' },
  label: { display:'block', fontSize:'12px', color:'#94a3b8', marginBottom:'5px' },
  input: { width:'100%', background:'#0f1117', border:'1px solid #2d3548', borderRadius:'7px', color:'#e2e8f0', fontSize:'13px', padding:'9px 12px', outline:'none', marginBottom:'14px', boxSizing:'border-box' },
  btn:   { width:'100%', background:'#4F8EF7', border:'none', borderRadius:'7px', color:'#fff', cursor:'pointer', fontSize:'14px', fontWeight:'600', padding:'10px', marginTop:'4px' },
  error: { color:'#f87171', fontSize:'12px', marginTop:'10px' },
  ok:    { color:'#4ade80', fontSize:'13px', textAlign:'center', padding:'12px 0' },
};

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return; }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => navigate('/replays', { replace: true }), 2000);
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.title}>⚡ Pawns Replays</div>
        <div style={s.sub}>Set a new password</div>
        {done ? (
          <div style={s.ok}>Password updated — redirecting...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label style={s.label}>New Password</label>
            <input
              style={s.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required autoFocus
            />
            <label style={s.label}>Confirm Password</label>
            <input
              style={s.input} type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" required
            />
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Set New Password'}
            </button>
          </form>
        )}
        {error && <div style={s.error}>{error}</div>}
      </div>
    </div>
  );
}
