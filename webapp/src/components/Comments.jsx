import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { format } from 'date-fns';

const s = {
  wrap:      { display:'flex', flexDirection:'column', height:'100%' },
  header:    { padding:'16px', borderBottom:'1px solid #1e2535', fontSize:'13px', fontWeight:'600', color:'#f0f0f0' },
  list:      { flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:'12px' },
  comment:   { background:'#141824', border:'1px solid #1e2535', borderRadius:'8px', padding:'10px 12px' },
  cTop:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' },
  cAuthor:   { fontSize:'12px', fontWeight:'600', color:'#a5b4fc' },
  cTime:     { fontSize:'10px', color:'#4a5568' },
  cBody:     { fontSize:'12px', color:'#e2e8f0', lineHeight:'1.5' },
  cAnchor:   { fontSize:'10px', color:'#4F8EF7', marginTop:'4px', cursor:'pointer', display:'inline-block' },
  replyBtn:  { background:'transparent', border:'none', color:'#64748b', cursor:'pointer', fontSize:'11px', marginTop:'4px' },
  // Reply indent
  replies:   { marginTop:'8px', paddingLeft:'12px', borderLeft:'2px solid #1e2535', display:'flex', flexDirection:'column', gap:'8px' },
  // Input area
  inputArea: { padding:'12px 16px', borderTop:'1px solid #1e2535' },
  anchorTip: { fontSize:'11px', color:'#4F8EF7', marginBottom:'6px' },
  textarea:  { width:'100%', background:'#0f1117', border:'1px solid #2d3548', borderRadius:'6px', color:'#e2e8f0', fontSize:'12px', padding:'8px 10px', resize:'vertical', minHeight:'72px', outline:'none', fontFamily:'inherit' },
  submitRow: { display:'flex', justifyContent:'flex-end', marginTop:'6px', gap:'8px', alignItems:'center' },
  submit:    { background:'#4F8EF7', border:'none', borderRadius:'6px', color:'#fff', cursor:'pointer', fontSize:'12px', fontWeight:'600', padding:'6px 14px' },
  cancel:    { background:'transparent', border:'none', color:'#64748b', cursor:'pointer', fontSize:'12px' },
};

export default function Comments({ replayId, session, currentActionIndex }) {
  const [comments,    setComments]    = useState([]);
  const [body,        setBody]        = useState('');
  const [anchorIndex, setAnchorIndex] = useState(null);
  const [replyTo,     setReplyTo]     = useState(null); // comment id
  const [profiles,    setProfiles]    = useState({});
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    if (!replayId) return;
    loadComments();

    // Real-time subscription for new comments
    const channel = supabase
      .channel(`comments:${replayId}`)
      .on('postgres_changes', {
        event:  '*',
        schema: 'public',
        table:  'comments',
        filter: `replay_id=eq.${replayId}`,
      }, () => loadComments())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [replayId]);

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('replay_id', replayId)
      .order('created_at', { ascending: true });

    if (!data) return;
    setComments(data);

    // Load profiles for authors we haven't fetched yet
    const ids = [...new Set(data.map(c => c.author_id))].filter(id => !profiles[id]);
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', ids);
      if (profs) {
        setProfiles(prev => {
          const next = { ...prev };
          profs.forEach(p => { next[p.id] = p; });
          return next;
        });
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);

    const row = {
      replay_id:    replayId,
      author_id:    session.user.id,
      body:         body.trim(),
      parent_id:    replyTo || null,
      action_index: anchorIndex,
    };

    await supabase.from('comments').insert(row);
    setBody('');
    setAnchorIndex(null);
    setReplyTo(null);
    setSubmitting(false);
  }

  function startReply(commentId) {
    setReplyTo(commentId);
    setAnchorIndex(null);
  }

  function anchorToCurrentAction() {
    setAnchorIndex(currentActionIndex);
    setReplyTo(null);
  }

  // Build tree: top-level comments + their replies
  const topLevel = comments.filter(c => !c.parent_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_id === parentId);

  const authorName = (id) => profiles[id]?.display_name || profiles[id]?.username || 'Unknown';

  function CommentItem({ c, depth = 0 }) {
    const replies = getReplies(c.id);
    return (
      <div style={depth > 0 ? {} : s.comment}>
        <div style={s.cTop}>
          <span style={s.cAuthor}>{authorName(c.author_id)}</span>
          <span style={s.cTime}>{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
        </div>
        {c.action_index != null && (
          <div style={s.cAnchor}>📍 Event #{c.action_index + 1}</div>
        )}
        <div style={s.cBody}>{c.body}</div>
        <button style={s.replyBtn} onClick={() => startReply(c.id)}>↩ Reply</button>

        {replies.length > 0 && (
          <div style={s.replies}>
            {replies.map(r => <CommentItem key={r.id} c={r} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        💬 Comments {comments.length > 0 && `(${comments.length})`}
      </div>

      <div style={s.list}>
        {topLevel.length === 0 && (
          <div style={{ color:'#4a5568', fontSize:'12px', textAlign:'center', marginTop:'24px' }}>
            No comments yet. Be the first!
          </div>
        )}
        {topLevel.map(c => <CommentItem key={c.id} c={c} />)}
      </div>

      <div style={s.inputArea}>
        {replyTo && (
          <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'6px' }}>
            Replying to a comment —{' '}
            <button style={s.cancel} onClick={() => setReplyTo(null)}>cancel</button>
          </div>
        )}
        {anchorIndex != null && (
          <div style={s.anchorTip}>
            📍 Linked to event #{anchorIndex + 1}
            <button style={s.cancel} onClick={() => setAnchorIndex(null)}>✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <textarea
            style={s.textarea}
            placeholder="Add a comment..."
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <div style={s.submitRow}>
            <button type="button" style={{ ...s.cancel, fontSize:'11px', color:'#4F8EF7' }} onClick={anchorToCurrentAction}>
              📍 Link to event #{currentActionIndex + 1}
            </button>
            <button type="submit" style={s.submit} disabled={submitting || !body.trim()}>
              {submitting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
