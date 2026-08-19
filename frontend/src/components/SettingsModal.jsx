import { useEffect, useState } from "react";
import { X, SlidersHorizontal, MessageCircle, Shield, Info, Settings2 } from "lucide-react";
import { api } from "../services/api";

export default function SettingsModal({ open, onClose, settings, onSave, onLogout }) {
  const [s, setS] = useState(settings || {});
  useEffect(()=>setS(settings || {}),[settings]);
  if (!open) return null;

  async function update(patch) {
    const next = {...s,...patch};
    setS(next);
    await onSave(patch);
  }

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
      <header className="modal-head"><div><p className="eyebrow">WORKSPACE</p><h2>Settings</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X/></button></header>
      <div className="settings-scroll">
        <div className="setting-section"><h3><Settings2 size={17}/>General</h3>
          <label className="setting-row">Theme <select value={s.theme||"dark"} onChange={e=>update({theme:e.target.value})}><option value="dark">Dark</option><option value="light">Light</option></select></label>
          <label className="setting-row">Language <select value={s.language||"English"} onChange={e=>update({language:e.target.value})}><option>English</option><option>Hinglish</option><option>Hindi</option></select></label>
          <Toggle label="Compact mode" value={!!s.compact_mode} onChange={v=>update({compact_mode:v})}/>
          <Toggle label="Enter to send" value={!!s.enter_to_send} onChange={v=>update({enter_to_send:v})}/>
        </div>
        <div className="setting-section"><h3><SlidersHorizontal size={17}/>AI</h3>
          <label className="setting-row">Model <input value={s.model||""} onChange={e=>setS({...s,model:e.target.value})} onBlur={()=>update({model:s.model})} placeholder="Provider default"/></label>
          <label className="setting-row">Temperature <input type="range" min="0" max="2" step=".1" value={s.temperature ?? .7} onChange={e=>update({temperature:Number(e.target.value)})}/><span>{Number(s.temperature ?? .7).toFixed(1)}</span></label>
          <p className="muted small">Model and temperature are forwarded only by the server-side AI provider configuration.</p>
        </div>
        <div className="setting-section"><h3><MessageCircle size={17}/>Chat</h3>
          <Toggle label="Conversation history" value={!!s.history_enabled} onChange={v=>update({history_enabled:v})}/>
          <Toggle label="Auto-scroll" value={!!s.auto_scroll} onChange={v=>update({auto_scroll:v})}/>
          <Toggle label="Markdown rendering" value={!!s.markdown} onChange={v=>update({markdown:v})}/>
        </div>
        <div className="setting-section"><h3><Shield size={17}/>Privacy</h3>
          <p className="muted">Your conversations are stored in the local SQLite database for this installation.</p>
          <button className="secondary-btn danger-outline" onClick={()=>window.confirm("Delete all conversations? This action cannot be undone.") && window.dispatchEvent(new CustomEvent("aura-clear-history"))}>Clear conversation history</button>
          <button className="secondary-btn danger-outline" onClick={onLogout}>Log out</button>
        </div>
        <div className="setting-section"><h3><Info size={17}/>About</h3><p className="muted">AURA AI v1.0 · React + Vite · Express · SQLite · OpenAI-compatible streaming.</p></div>
      </div>
    </section>
  </div>
}

function Toggle({label,value,onChange}) {
  return <label className="toggle-row"><span>{label}</span><button type="button" className={`toggle ${value?"on":""}`} onClick={()=>onChange(!value)} aria-pressed={value}><span/></button></label>
}
