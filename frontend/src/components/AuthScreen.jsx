import { useState } from "react";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { api } from "../services/api";

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await api(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST", body: JSON.stringify(form)
      });
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-orb orb-a"/>
      <div className="auth-orb orb-b"/>
      <section className="auth-card">
        <div className="brand-mark large"><Sparkles size={21}/></div>
        <p className="eyebrow">PRIVATE AI WORKSPACE</p>
        <h1>{mode === "login" ? "Welcome back." : "Create your workspace."}</h1>
        <p className="auth-copy">A focused, persistent AI assistant for thinking, building and shipping.</p>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" autoComplete="name"/></label>}
          <label>Email<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" autoComplete="email" required/></label>
          <label>Password<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters" autoComplete={mode==="login"?"current-password":"new-password"} required minLength={8}/></label>
          {error && <div className="error-banner">{error}</div>}
          <button className="primary-btn wide" disabled={busy}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
            <ArrowRight size={17}/>
          </button>
        </form>

        <button className="switch-auth" onClick={()=>{setMode(mode==="login"?"signup":"login");setError("")}}>
          {mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}
        </button>
        <div className="security-note"><ShieldCheck size={15}/> Passwords are securely hashed. Sessions use HttpOnly cookies.</div>
      </section>
    </main>
  );
}
