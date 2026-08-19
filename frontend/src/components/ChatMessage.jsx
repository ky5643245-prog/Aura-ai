import { useState } from "react";
import { Copy, Check, RotateCcw, ThumbsUp, ThumbsDown, MoreHorizontal, Pencil, X } from "lucide-react";
import MarkdownMessage from "./MarkdownMessage";

export default function ChatMessage({ message, onRegenerate, onEdit, streaming }) {
  const [copied,setCopied]=useState(false);
  const [vote,setVote]=useState(null);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(message.content);

  async function copy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true); setTimeout(()=>setCopied(false),1200);
  }

  if (message.role === "user") return <article className="message user-message">
    <div className="message-avatar">Y</div>
    <div className="message-body">
      {editing ? <div className="edit-box"><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={4}/><div className="edit-actions"><button className="secondary-btn" onClick={()=>setEditing(false)}><X size={14}/>Cancel</button><button className="primary-btn" onClick={()=>{setEditing(false);onEdit(message.id, draft)}}>Send again</button></div></div> : <div className="user-bubble">{message.content}</div>}
      {!editing && <div className="message-actions"><button onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"Copied":"Copy"}</button><button onClick={()=>setEditing(true)}><Pencil size={14}/>Edit</button></div>}
    </div>
  </article>;

  return <article className="message assistant-message">
    <div className="message-avatar ai">✦</div>
    <div className="message-body">
      {message.content ? <MarkdownMessage content={message.content}/> : <div className="thinking"><span/><span/><span/>AI is thinking…</div>}
      {streaming && <span className="stream-cursor"/>}
      {!streaming && message.content && <div className="message-actions">
        <button onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>} {copied?"Copied":"Copy"}</button>
        <button onClick={onRegenerate}><RotateCcw size={14}/>Regenerate</button>
        <button className={vote==="up"?"selected":""} onClick={()=>setVote(vote==="up"?null:"up")}><ThumbsUp size={14}/></button>
        <button className={vote==="down"?"selected":""} onClick={()=>setVote(vote==="down"?null:"down")}><ThumbsDown size={14}/></button>
        <button aria-label="More"><MoreHorizontal size={15}/></button>
      </div>}
    </div>
  </article>;
}
