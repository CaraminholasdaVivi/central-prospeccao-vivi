"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getClaims().then(({ data }) => {
      if (data?.claims) window.location.href = "/";
    });
  }, [supabase]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) { setError(signInError.message); setLoading(false); return; }
    window.location.href = "/";
  }

  return <main className="login-shell"><section className="login-card"><div className="brand-mark">V</div><h1>Central de Prospecção Vivi</h1><p>Sua memória externa para municípios, contatos, propostas, histórico e próximos passos.</p>{error && <div className="login-error">Não foi possível entrar. Verifique o e-mail e a senha.</div>}<form onSubmit={submit}><label>E-mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label><label>Senha<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label><button type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</button></form></section></main>;
}
