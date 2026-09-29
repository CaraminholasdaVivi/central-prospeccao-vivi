"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Contact,
  Interaction,
  INTERACTION_TYPES,
  Municipality,
  Opportunity,
  PIPELINE_STAGES,
  PipelineStage,
  Project,
  ProposalType,
} from "@/lib/types";

const STAGE_SHORT: Record<PipelineStage, string> = {
  "MUNICÍPIO PESQUISADO": "Pesquisado",
  "CONTATO IDENTIFICADO": "Contato",
  "PRIMEIRO CONTATO": "1º contato",
  "AGUARDANDO RESPOSTA": "Aguardando",
  RESPONDEU: "Respondeu",
  "CONVERSA EM ANDAMENTO": "Conversa",
  "PROPOSTA ENVIADA": "Proposta",
  "EM ANÁLISE": "Análise",
  NEGOCIAÇÃO: "Negociação",
  FECHADO: "Fechado",
  "NÃO AVANÇOU": "Não avançou",
  "RETOMAR DEPOIS": "Retomar",
};

const CONTACT_INTERACTION_TYPES = new Set([
  "E-mail enviado",
  "WhatsApp enviado",
  "Ligação",
  "Reunião",
]);

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}${value.length === 10 ? "T00:00:00" : ""}`);
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function emptyContact(municipalityId: string): Omit<Contact, "id"> {
  return { municipality_id: municipalityId, name: "", role: "", email: "", phone: "", whatsapp: "", notes: "" };
}

function emptyMunicipality() {
  return { name: "", state: "SC", secretaria: "" };
}

function emptyOpportunity() {
  return {
    municipality_id: "",
    project_id: "",
    proposal_type_id: "",
    primary_contact_id: "",
    stage: "MUNICÍPIO PESQUISADO" as PipelineStage,
    first_contact_date: "",
    next_action: "",
    next_action_date: "",
    notes: "",
  };
}

export default function ProspectingApp({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<"dashboard" | "pipeline" | "municipalities" | "projects">("dashboard");
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposalTypes, setProposalTypes] = useState<ProposalType[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterProposal, setFilterProposal] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [municipalityModal, setMunicipalityModal] = useState<Municipality | "new" | null>(null);
  const [contactModal, setContactModal] = useState<Contact | "new" | null>(null);
  const [opportunityModal, setOpportunityModal] = useState<Opportunity | "new" | null>(null);
  const [projectModal, setProjectModal] = useState<Project | "new" | null>(null);
  const [proposalModal, setProposalModal] = useState<ProposalType | "new" | null>(null);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);

  async function loadData() {
    setLoading(true);
    setError("");
    const [m, c, p, pt, o, i] = await Promise.all([
      supabase.from("municipalities").select("*").order("name"),
      supabase.from("contacts").select("*").order("name"),
      supabase.from("projects").select("*").order("name"),
      supabase.from("proposal_types").select("*").order("name"),
      supabase.from("opportunities").select("*").order("updated_at", { ascending: false }),
      supabase.from("interactions").select("*").order("occurred_at", { ascending: false }),
    ]);
    const firstError = [m, c, p, pt, o, i].find((r) => r.error)?.error;
    if (firstError) setError(firstError.message);
    else {
      setMunicipalities((m.data ?? []) as Municipality[]);
      setContacts((c.data ?? []) as Contact[]);
      setProjects((p.data ?? []) as Project[]);
      setProposalTypes((pt.data ?? []) as ProposalType[]);
      setOpportunities((o.data ?? []) as Opportunity[]);
      setInteractions((i.data ?? []) as Interaction[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 3200);
      return () => clearTimeout(timer);
    }
  }, [notice]);

  const municipalityById = useMemo(() => new Map(municipalities.map((m) => [m.id, m])), [municipalities]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const proposalById = useMemo(() => new Map(proposalTypes.map((p) => [p.id, p])), [proposalTypes]);
  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filteredOpportunities = useMemo(() => {
    const q = search.trim().toLowerCase();
    return opportunities.filter((o) => {
      const m = municipalityById.get(o.municipality_id);
      const p = projectById.get(o.project_id);
      const pt = o.proposal_type_id ? proposalById.get(o.proposal_type_id) : null;
      const primary = o.primary_contact_id ? contactById.get(o.primary_contact_id) : null;
      const haystack = [m?.name, m?.state, p?.name, pt?.name, primary?.name, primary?.email].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (filterProject && o.project_id !== filterProject) return false;
      if (filterState && m?.state !== filterState) return false;
      if (filterStage && o.stage !== filterStage) return false;
      if (filterProposal && o.proposal_type_id !== filterProposal) return false;
      if (filterFrom && (!o.last_interaction_at || o.last_interaction_at.slice(0, 10) < filterFrom)) return false;
      if (filterTo && (!o.last_interaction_at || o.last_interaction_at.slice(0, 10) > filterTo)) return false;
      return true;
    });
  }, [opportunities, search, filterProject, filterState, filterStage, filterProposal, filterFrom, filterTo, municipalityById, projectById, proposalById, contactById]);

  const counts = useMemo(() => {
    const countByStage = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, opportunities.filter((o) => o.stage === s).length])) as Record<PipelineStage, number>;
    const contacted = opportunities.filter((o) => interactions.some((i) => i.opportunity_id === o.id && CONTACT_INTERACTION_TYPES.has(i.type))).length;
    const proposals = opportunities.filter((o) => o.stage === "PROPOSTA ENVIADA").length;
    return { ...countByStage, contacted, proposals };
  }, [opportunities, interactions]);

  const selectedOpportunity = selectedOpportunityId ? opportunities.find((o) => o.id === selectedOpportunityId) ?? null : null;
  const selectedInteractions = selectedOpportunity ? interactions.filter((i) => i.opportunity_id === selectedOpportunity.id).sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)) : [];

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function clearFilters() {
    setSearch(""); setFilterProject(""); setFilterState(""); setFilterStage(""); setFilterProposal(""); setFilterFrom(""); setFilterTo("");
  }

  async function saveMunicipality(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { name: String(form.get("name")).trim(), state: String(form.get("state")).trim().toUpperCase(), secretaria: String(form.get("secretaria")).trim() };
    const query = municipalityModal && municipalityModal !== "new"
      ? supabase.from("municipalities").update(payload).eq("id", municipalityModal.id)
      : supabase.from("municipalities").insert({ ...payload, user_id: (await supabase.auth.getUser()).data.user?.id });
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message); else { setNotice("Município salvo."); setMunicipalityModal(null); await loadData(); }
    setSaving(false);
  }

  async function deleteMunicipality(id: string) {
    if (!confirm("Excluir este município? As oportunidades e contatos relacionados também serão excluídos.")) return;
    const { error: deleteError } = await supabase.from("municipalities").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else { setNotice("Município excluído."); await loadData(); }
  }

  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const municipalityId = String(form.get("municipality_id"));
    const payload = { municipality_id: municipalityId, name: String(form.get("name")).trim(), role: String(form.get("role")).trim(), email: String(form.get("email")).trim(), phone: String(form.get("phone")).trim(), whatsapp: String(form.get("whatsapp")).trim(), notes: String(form.get("notes")).trim() };
    const query = contactModal && contactModal !== "new" ? supabase.from("contacts").update(payload).eq("id", contactModal.id) : supabase.from("contacts").insert({ ...payload, user_id: (await supabase.auth.getUser()).data.user?.id });
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message); else { setNotice("Contato salvo."); setContactModal(null); await loadData(); }
    setSaving(false);
  }

  async function deleteContact(id: string) {
    if (!confirm("Excluir este contato?")) return;
    const { error: deleteError } = await supabase.from("contacts").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else { setNotice("Contato excluído."); await loadData(); }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = { name: String(form.get("name")).trim(), active: form.get("active") === "on" };
    const query = projectModal && projectModal !== "new" ? supabase.from("projects").update(payload).eq("id", projectModal.id) : supabase.from("projects").insert({ ...payload, user_id: (await supabase.auth.getUser()).data.user?.id });
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message); else { setNotice("Projeto salvo."); setProjectModal(null); await loadData(); }
    setSaving(false);
  }

  async function deleteProject(id: string) {
    if (!confirm("Excluir este projeto? As oportunidades e modalidades ligadas a ele também serão excluídas.")) return;
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else { setNotice("Projeto excluído."); await loadData(); }
  }

  async function saveProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const projectId = String(form.get("project_id"));
    const payload = { project_id: projectId, name: String(form.get("name")).trim(), active: form.get("active") === "on" };
    const query = proposalModal && proposalModal !== "new" ? supabase.from("proposal_types").update(payload).eq("id", proposalModal.id) : supabase.from("proposal_types").insert({ ...payload, user_id: (await supabase.auth.getUser()).data.user?.id });
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message); else { setNotice("Modalidade salva."); setProposalModal(null); await loadData(); }
    setSaving(false);
  }

  async function deleteProposal(id: string) {
    if (!confirm("Excluir esta modalidade de proposta?")) return;
    const { error: deleteError } = await supabase.from("proposal_types").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else { setNotice("Modalidade excluída."); await loadData(); }
  }

  async function saveOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const municipalityId = String(form.get("municipality_id"));
    const projectId = String(form.get("project_id"));
    const payload = {
      municipality_id: municipalityId,
      project_id: projectId,
      proposal_type_id: String(form.get("proposal_type_id")) || null,
      primary_contact_id: String(form.get("primary_contact_id")) || null,
      stage: String(form.get("stage")) as PipelineStage,
      first_contact_date: String(form.get("first_contact_date")) || null,
      next_action: String(form.get("next_action")).trim(),
      next_action_date: String(form.get("next_action_date")) || null,
      notes: String(form.get("notes")).trim(),
    };
    const query = opportunityModal && opportunityModal !== "new" ? supabase.from("opportunities").update(payload).eq("id", opportunityModal.id) : supabase.from("opportunities").insert({ ...payload, user_id: (await supabase.auth.getUser()).data.user?.id });
    const { error: saveError } = await query;
    if (saveError) setError(saveError.message); else { setNotice("Oportunidade salva."); setOpportunityModal(null); await loadData(); }
    setSaving(false);
  }

  async function deleteOpportunity(id: string) {
    if (!confirm("Excluir esta oportunidade? O histórico dela também será excluído.")) return;
    const { error: deleteError } = await supabase.from("opportunities").delete().eq("id", id);
    if (deleteError) setError(deleteError.message); else { setNotice("Oportunidade excluída."); setSelectedOpportunityId(null); await loadData(); }
  }

  async function moveOpportunity(id: string, stage: PipelineStage) {
    const current = opportunities.find((o) => o.id === id);
    if (!current || current.stage === stage) return;
    const { error: updateError } = await supabase.from("opportunities").update({ stage }).eq("id", id);
    if (updateError) setError(updateError.message); else { setNotice(`Etapa alterada para ${STAGE_SHORT[stage]}.`); await loadData(); }
  }

  async function saveInteraction(event: FormEvent<HTMLFormElement>, opportunityId: string) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const occurredAt = String(form.get("occurred_at"));
    const occurred = occurredAt ? new Date(`${occurredAt}T12:00:00`).toISOString() : new Date().toISOString();
    const user = (await supabase.auth.getUser()).data.user;
    const payload = { opportunity_id: opportunityId, user_id: user?.id, occurred_at: occurred, type: String(form.get("type")), description: String(form.get("description")).trim(), observation: String(form.get("observation")).trim() };
    const { error: writeError } = editingInteraction
      ? await supabase.from("interactions").update({ occurred_at: occurred, type: String(form.get("type")), description: String(form.get("description")).trim(), observation: String(form.get("observation")).trim() }).eq("id", editingInteraction.id)
      : await supabase.from("interactions").insert(payload);
    if (writeError) setError(writeError.message);
    else {
      const { data: latest } = await supabase.from("interactions").select("occurred_at").eq("opportunity_id", opportunityId).order("occurred_at", { ascending: false }).limit(1);
      await supabase.from("opportunities").update({ last_interaction_at: latest?.[0]?.occurred_at ?? null }).eq("id", opportunityId);
      setEditingInteraction(null);
      setNotice(editingInteraction ? "Interação atualizada." : "Interação registrada."); await loadData();
    }
    setSaving(false);
  }

  async function deleteInteraction(id: string) {
    if (!confirm("Excluir esta interação?")) return;
    const target = interactions.find((i) => i.id === id);
    const { error: deleteError } = await supabase.from("interactions").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else {
      if (target) {
        const { data: remaining } = await supabase.from("interactions").select("occurred_at").eq("opportunity_id", target.opportunity_id).order("occurred_at", { ascending: false }).limit(1);
        await supabase.from("opportunities").update({ last_interaction_at: remaining?.[0]?.occurred_at ?? null }).eq("id", target.opportunity_id);
      }
      setNotice("Interação excluída."); await loadData();
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Carregando sua Central…</span></div>;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">V</div><div><strong>Central de Prospecção Vivi</strong><span>Memória externa da prospecção</span></div></div>
        <div className="user-area"><span>{userEmail}</span><button className="ghost-button" onClick={signOut}>Sair</button></div>
      </header>

      <nav className="main-nav">
        <button className={tab === "dashboard" ? "nav-active" : ""} onClick={() => setTab("dashboard")}>Visão geral</button>
        <button className={tab === "pipeline" ? "nav-active" : ""} onClick={() => setTab("pipeline")}>Pipeline</button>
        <button className={tab === "municipalities" ? "nav-active" : ""} onClick={() => setTab("municipalities")}>Municípios</button>
        <button className={tab === "projects" ? "nav-active" : ""} onClick={() => setTab("projects")}>Projetos</button>
      </nav>

      <section className="content">
        {error && <div className="alert error">{error}<button onClick={() => setError("")}>×</button></div>}
        {notice && <div className="alert success">{notice}</div>}

        {tab === "dashboard" && <Dashboard counts={counts} opportunities={opportunities} municipalityById={municipalityById} projectById={projectById} onOpen={(id) => setSelectedOpportunityId(id)} onPipeline={() => setTab("pipeline")} />}
        {tab === "pipeline" && (
          <PipelineView
            opportunities={filteredOpportunities}
            municipalities={municipalities}
            projects={projects}
            proposalTypes={proposalTypes}
            contacts={contacts}
            municipalityById={municipalityById}
            projectById={projectById}
            proposalById={proposalById}
            contactById={contactById}
            search={search} setSearch={setSearch}
            filterProject={filterProject} setFilterProject={setFilterProject}
            filterState={filterState} setFilterState={setFilterState}
            filterStage={filterStage} setFilterStage={setFilterStage}
            filterProposal={filterProposal} setFilterProposal={setFilterProposal}
            filterFrom={filterFrom} setFilterFrom={setFilterFrom}
            filterTo={filterTo} setFilterTo={setFilterTo}
            clearFilters={clearFilters}
            onOpen={(id) => setSelectedOpportunityId(id)}
            onMove={moveOpportunity}
            onNew={() => setOpportunityModal("new")}
          />
        )}
        {tab === "municipalities" && <MunicipalitiesView municipalities={municipalities} contacts={contacts} opportunities={opportunities} onNew={() => setMunicipalityModal("new")} onEdit={(m) => setMunicipalityModal(m)} onDelete={deleteMunicipality} onNewContact={(id) => setContactModal({ ...emptyContact(id), id: "" } as Contact)} onEditContact={(c) => setContactModal(c)} onDeleteContact={deleteContact} />}
        {tab === "projects" && <ProjectsView projects={projects} proposalTypes={proposalTypes} onNewProject={() => setProjectModal("new")} onEditProject={(p) => setProjectModal(p)} onDeleteProject={deleteProject} onNewProposal={() => setProposalModal("new")} onEditProposal={(p) => setProposalModal(p)} onDeleteProposal={deleteProposal} />}
      </section>

      {selectedOpportunity && (
        <OpportunityDetail
          opportunity={selectedOpportunity}
          municipality={municipalityById.get(selectedOpportunity.municipality_id)!}
          project={projectById.get(selectedOpportunity.project_id)!}
          proposal={selectedOpportunity.proposal_type_id ? proposalById.get(selectedOpportunity.proposal_type_id) : undefined}
          contact={selectedOpportunity.primary_contact_id ? contactById.get(selectedOpportunity.primary_contact_id) : undefined}
          interactions={selectedInteractions}
          contacts={contacts.filter((c) => c.municipality_id === selectedOpportunity.municipality_id)}
          onClose={() => setSelectedOpportunityId(null)}
          onEdit={() => { setOpportunityModal(selectedOpportunity); setSelectedOpportunityId(null); }}
          onDelete={() => deleteOpportunity(selectedOpportunity.id)}
          onSaveInteraction={saveInteraction}
          onEditInteraction={(interaction: Interaction) => setEditingInteraction(interaction)}
          onDeleteInteraction={deleteInteraction}
        />
      )}

      {municipalityModal && <MunicipalityModal value={municipalityModal} saving={saving} onClose={() => setMunicipalityModal(null)} onSave={saveMunicipality} />}
      {contactModal && <ContactModal value={contactModal} municipalities={municipalities} saving={saving} onClose={() => setContactModal(null)} onSave={saveContact} />}
      {opportunityModal && <OpportunityModal value={opportunityModal} municipalities={municipalities} projects={projects} proposalTypes={proposalTypes} contacts={contacts} saving={saving} onClose={() => setOpportunityModal(null)} onSave={saveOpportunity} />}
      {projectModal && <ProjectModal value={projectModal} saving={saving} onClose={() => setProjectModal(null)} onSave={saveProject} />}
      {proposalModal && <ProposalModal value={proposalModal} projects={projects} saving={saving} onClose={() => setProposalModal(null)} onSave={saveProposal} />}
      {editingInteraction && selectedOpportunity && <InteractionModal value={editingInteraction} saving={saving} onClose={() => setEditingInteraction(null)} onSave={(e) => saveInteraction(e, selectedOpportunity.id)} />}
    </main>
  );
}

function Dashboard({ counts, opportunities, municipalityById, projectById, onOpen, onPipeline }: any) {
  const nextActions = [...opportunities].filter((o: Opportunity) => o.next_action && o.next_action_date).sort((a: Opportunity, b: Opportunity) => String(a.next_action_date).localeCompare(String(b.next_action_date))).slice(0, 12);
  const cards = [
    ["Municípios pesquisados", counts["MUNICÍPIO PESQUISADO"], "soft"],
    ["Contatos identificados", counts["CONTATO IDENTIFICADO"], "blue"],
    ["Contatos realizados", counts.contacted, "soft"],
    ["Aguardando resposta", counts["AGUARDANDO RESPOSTA"], "amber"],
    ["Respostas recebidas", counts.RESPONDEU, "blue"],
    ["Propostas enviadas", counts.proposals, "violet"],
    ["Em análise", counts["EM ANÁLISE"], "violet"],
    ["Negociações", counts.NEGOCIAÇÃO, "orange"],
    ["Fechados", counts.FECHADO, "green"],
    ["Não avançaram", counts["NÃO AVANÇOU"], "gray"],
    ["Retomar", counts["RETOMAR DEPOIS"], "rose"],
  ];
  return <>
    <div className="page-heading"><div><p className="eyebrow">Painel</p><h1>Visão geral</h1><p>Veja onde estão suas oportunidades e o que pede sua atenção.</p></div><button className="primary-button" onClick={onPipeline}>Abrir pipeline →</button></div>
    <div className="metric-grid">{cards.map(([label, value, tone]) => <div className={`metric-card ${tone}`} key={String(label)}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="dashboard-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Próximas ações</h2><p>Ordenadas pela data registrada.</p></div></div>{nextActions.length === 0 ? <Empty text="Nenhuma próxima ação cadastrada." /> : <div className="action-list">{nextActions.map((o: Opportunity) => <button className="action-row" key={o.id} onClick={() => onOpen(o.id)}><div><strong>{municipalityById.get(o.municipality_id)?.name ?? "Município"}</strong><span>{projectById.get(o.project_id)?.name ?? "Projeto"}</span></div><div><b>{formatDate(o.next_action_date)}</b><span>→ {o.next_action}</span></div></button>)}</div>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>Mapa rápido do pipeline</h2><p>Quantidade atual por etapa.</p></div></div><div className="stage-summary">{PIPELINE_STAGES.map((stage) => <div key={stage}><span>{STAGE_SHORT[stage]}</span><strong>{counts[stage]}</strong></div>)}</div></section>
    </div>
  </>;
}

function PipelineView(props: any) {
  const { opportunities, municipalities, projects, proposalTypes, contacts, municipalityById, projectById, proposalById, contactById, search, setSearch, filterProject, setFilterProject, filterState, setFilterState, filterStage, setFilterStage, filterProposal, setFilterProposal, filterFrom, setFilterFrom, filterTo, setFilterTo, clearFilters, onOpen, onMove, onNew } = props;
  const [draggedId, setDraggedId] = useState<string | null>(null);
  return <>
    <div className="page-heading"><div><p className="eyebrow">Acompanhamento</p><h1>Pipeline</h1><p>Cada cartão representa uma oportunidade: município + projeto.</p></div><button className="primary-button" onClick={onNew}>+ Nova oportunidade</button></div>
    <div className="filters panel"><div className="search-wrap"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar município, contato ou projeto…" /></div><select value={filterProject} onChange={(e) => setFilterProject(e.target.value)}><option value="">Projeto: todos</option>{projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><select value={filterState} onChange={(e) => setFilterState(e.target.value)}><option value="">Estado: todos</option>{Array.from(new Set(municipalities.map((m: Municipality) => m.state))).sort().map((s) => <option key={s} value={s}>{s}</option>)}</select><select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}><option value="">Etapa: todas</option>{PIPELINE_STAGES.map((s) => <option key={s} value={s}>{STAGE_SHORT[s]}</option>)}</select><select value={filterProposal} onChange={(e) => setFilterProposal(e.target.value)}><option value="">Proposta: todas</option>{proposalTypes.map((p: ProposalType) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="date-filter"><label>De<input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} /></label><label>Até<input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} /></label></div><button className="link-button" onClick={clearFilters}>Limpar filtros</button></div>
    <div className="kanban-wrap"><div className="kanban">{PIPELINE_STAGES.map((stage) => { const stageCards = opportunities.filter((o: Opportunity) => o.stage === stage); return <div className="kanban-column" key={stage} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (draggedId) onMove(draggedId, stage); setDraggedId(null); }}><div className="column-title"><span>{STAGE_SHORT[stage]}</span><b>{stageCards.length}</b></div><div className="column-cards">{stageCards.map((o: Opportunity) => { const m = municipalityById.get(o.municipality_id); const p = projectById.get(o.project_id); const pt = o.proposal_type_id ? proposalById.get(o.proposal_type_id) : null; const c = o.primary_contact_id ? contactById.get(o.primary_contact_id) : null; return <article className="op-card" key={o.id} draggable onDragStart={() => setDraggedId(o.id)} onClick={() => onOpen(o.id)}><div className="card-top"><strong>{m?.name} – {m?.state}</strong><span>{p?.name}</span></div>{pt && <div className="proposal-chip">{pt.name}</div>}{c && <div className="card-contact">👤 {c.name}</div>}{c?.email && <div className="card-email">✉ {c.email}</div>}<div className="card-bottom"><span>Última: {formatDate(o.last_interaction_at)}</span><span>{o.next_action_date ? `Próxima: ${formatDate(o.next_action_date)}` : "Sem próxima ação"}</span></div></article>})}{stageCards.length === 0 && <div className="column-empty">Arraste oportunidades para cá</div>}</div></div>})}</div></div>
  </>;
}

function MunicipalitiesView({ municipalities, contacts, opportunities, onNew, onEdit, onDelete, onNewContact, onEditContact, onDeleteContact }: any) {
  return <><div className="page-heading"><div><p className="eyebrow">Cadastros</p><h1>Municípios</h1><p>Cadastro permanente dos municípios e seus contatos.</p></div><button className="primary-button" onClick={onNew}>+ Novo município</button></div><div className="municipality-grid">{municipalities.map((m: Municipality) => { const cs = contacts.filter((c: Contact) => c.municipality_id === m.id); const os = opportunities.filter((o: Opportunity) => o.municipality_id === m.id); return <section className="panel municipality-card" key={m.id}><div className="municipality-head"><div><h2>{m.name} <small>{m.state}</small></h2><p>{m.secretaria || "Secretaria não informada"}</p></div><div className="row-actions"><button className="icon-button" onClick={() => onEdit(m)}>Editar</button><button className="icon-button danger" onClick={() => onDelete(m.id)}>Excluir</button></div></div><div className="mini-stats"><span><b>{cs.length}</b> contatos</span><span><b>{os.length}</b> oportunidades</span></div><div className="contacts-list"><div className="section-line"><strong>Contatos</strong><button className="link-button" onClick={() => onNewContact(m.id)}>+ contato</button></div>{cs.length === 0 ? <p className="muted">Nenhum contato cadastrado.</p> : cs.map((c: Contact) => <div className="contact-row" key={c.id}><div><strong>{c.name}</strong><span>{c.role || "Cargo não informado"}</span>{c.email && <span>{c.email}</span>}</div><div className="row-actions"><button className="icon-button" onClick={() => onEditContact(c)}>Editar</button><button className="icon-button danger" onClick={() => onDeleteContact(c.id)}>Excluir</button></div></div>)}</div></section>})}{municipalities.length === 0 && <Empty text="Nenhum município cadastrado ainda." />}</div></>;
}

function ProjectsView({ projects, proposalTypes, onNewProject, onEditProject, onDeleteProject, onNewProposal, onEditProposal, onDeleteProposal }: any) {
  return <><div className="page-heading"><div><p className="eyebrow">Cadastros</p><h1>Projetos e propostas</h1><p>Projetos podem ter suas próprias modalidades de proposta.</p></div><button className="primary-button" onClick={onNewProject}>+ Novo projeto</button></div><div className="projects-grid">{projects.map((p: Project) => { const pts = proposalTypes.filter((pt: ProposalType) => pt.project_id === p.id); return <section className="panel project-card" key={p.id}><div className="municipality-head"><div><h2>{p.name}</h2><p>{p.active ? "Ativo" : "Inativo"}</p></div><div className="row-actions"><button className="icon-button" onClick={() => onEditProject(p)}>Editar</button><button className="icon-button danger" onClick={() => onDeleteProject(p.id)}>Excluir</button></div></div><div className="section-line"><strong>Modalidades</strong><button className="link-button" onClick={onNewProposal}>+ modalidade</button></div>{pts.length === 0 ? <p className="muted">Nenhuma modalidade cadastrada.</p> : pts.map((pt: ProposalType) => <div className="proposal-row" key={pt.id}><span>{pt.name}</span><div className="row-actions"><button className="icon-button" onClick={() => onEditProposal(pt)}>Editar</button><button className="icon-button danger" onClick={() => onDeleteProposal(pt.id)}>Excluir</button></div></div>)}</section>})}</div></>;
}

function OpportunityDetail({ opportunity, municipality, project, proposal, contact, contacts, interactions, onClose, onEdit, onDelete, onSaveInteraction, onDeleteInteraction, onEditInteraction }: any) {
  return <div className="overlay"><aside className="drawer"><div className="drawer-head"><div><p className="eyebrow">Ficha da oportunidade</p><h2>{municipality.name} – {municipality.state}</h2><p>{project.name}{proposal ? ` · ${proposal.name}` : ""}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="drawer-actions"><button className="secondary-button" onClick={onEdit}>Editar</button><button className="danger-button" onClick={onDelete}>Excluir</button></div><div className="detail-grid"><div><label>Etapa</label><strong className="stage-badge">{STAGE_SHORT[opportunity.stage as PipelineStage]}</strong></div><div><label>Primeiro contato</label><strong>{formatDate(opportunity.first_contact_date)}</strong></div><div><label>Última interação</label><strong>{formatDateTime(opportunity.last_interaction_at)}</strong></div><div><label>Próxima ação</label><strong>{opportunity.next_action || "—"}</strong><span>{formatDate(opportunity.next_action_date)}</span></div></div><section className="detail-section"><h3>Contato principal</h3>{contact ? <div className="contact-detail"><strong>{contact.name}</strong><span>{contact.role}</span><span>{contact.email || "Sem e-mail"}</span><span>{contact.phone || contact.whatsapp || "Sem telefone"}</span></div> : <p className="muted">Nenhum contato principal selecionado.</p>}{contacts.length > 0 && <details><summary>Outros contatos deste município</summary><div className="other-contacts">{contacts.filter((c: Contact) => c.id !== contact?.id).map((c: Contact) => <span key={c.id}>{c.name} · {c.role}</span>)}</div></details>}</section><section className="detail-section"><h3>Observações</h3><p className="notes-box">{opportunity.notes || "Nenhuma observação."}</p></section><section className="detail-section"><div className="section-line"><div><h3>Histórico</h3><p>Registre manualmente o que realmente aconteceu.</p></div></div><form className="interaction-form" onSubmit={(e) => onSaveInteraction(e, opportunity.id)}><div className="form-grid two"><label>Data<input type="date" name="occurred_at" defaultValue={todayIso()} required /></label><label>Tipo<select name="type" defaultValue="E-mail enviado">{INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label></div><label>Descrição<textarea name="description" placeholder="O que aconteceu?" required /></label><label>Observação<textarea name="observation" placeholder="Observação complementar" /></label><button className="primary-button" type="submit">Registrar interação</button></form><div className="timeline">{interactions.length === 0 ? <Empty text="Nenhuma interação registrada." /> : interactions.map((i: Interaction) => <div className="timeline-item" key={i.id}><div className="timeline-dot" /><div className="timeline-content"><div className="timeline-meta"><b>{i.type}</b><span>{formatDateTime(i.occurred_at)}</span></div><p>{i.description}</p>{i.observation && <small>{i.observation}</small>}<button className="link-button" onClick={() => onEditInteraction(i)}>Editar</button><button className="link-button danger-link" onClick={() => onDeleteInteraction(i.id)}>Excluir</button></div></div>)}</div></section></aside></div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="overlay"><div className="modal"><div className="modal-head"><div><h2>{title}</h2></div><button className="close-button" onClick={onClose}>×</button></div>{children}</div></div>; }

function MunicipalityModal({ value, saving, onClose, onSave }: any) { const editing = value !== "new"; return <Modal title={editing ? "Editar município" : "Novo município"} onClose={onClose}><form className="form" onSubmit={onSave}><label>Município<input name="name" required defaultValue={editing ? value.name : ""} /></label><label>Estado<input name="state" required maxLength={2} defaultValue={editing ? value.state : "SC"} /></label><label>Secretaria<input name="secretaria" defaultValue={editing ? value.secretaria : ""} placeholder="Secretaria de Educação" /></label><FormButtons saving={saving} onClose={onClose} /></form></Modal>; }

function ContactModal({ value, municipalities, saving, onClose, onSave }: any) { const editing = Boolean(value.id); return <Modal title={editing ? "Editar contato" : "Novo contato"} onClose={onClose}><form className="form" onSubmit={onSave}><label>Município<select name="municipality_id" required defaultValue={editing ? value.municipality_id : value.id}>{municipalities.map((m: Municipality) => <option key={m.id} value={m.id}>{m.name} – {m.state}</option>)}</select></label><label>Nome<input name="name" required defaultValue={editing ? value.name : ""} /></label><label>Cargo<input name="role" defaultValue={editing ? value.role : ""} /></label><label>E-mail<input name="email" type="email" defaultValue={editing ? value.email : ""} /></label><label>Telefone<input name="phone" defaultValue={editing ? value.phone : ""} /></label><label>WhatsApp<input name="whatsapp" defaultValue={editing ? value.whatsapp : ""} /></label><label>Observações<textarea name="notes" defaultValue={editing ? value.notes : ""} /></label><FormButtons saving={saving} onClose={onClose} /></form></Modal>; }

function InteractionModal({ value, saving, onClose, onSave }: any) {
  return <Modal title="Editar interação" onClose={onClose}><form className="form" onSubmit={onSave}><label>Data<input type="date" name="occurred_at" required defaultValue={value.occurred_at.slice(0, 10)} /></label><label>Tipo<select name="type" defaultValue={value.type}>{INTERACTION_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label><label>Descrição<textarea name="description" required defaultValue={value.description} /></label><label>Observação<textarea name="observation" defaultValue={value.observation} /></label><FormButtons saving={saving} onClose={onClose} /></form></Modal>;
}

function OpportunityModal({ value, municipalities, projects, proposalTypes, contacts, saving, onClose, onSave }: any) {
  const editing = value !== "new";
  const [municipalityId, setMunicipalityId] = useState(editing ? value.municipality_id : "");
  const [projectId, setProjectId] = useState(editing ? value.project_id : "");
  const availableContacts = contacts.filter((c: Contact) => c.municipality_id === municipalityId);
  const availableProposals = proposalTypes.filter((p: ProposalType) => p.project_id === projectId && p.active);
  return <Modal title={editing ? "Editar oportunidade" : "Nova oportunidade"} onClose={onClose}><form className="form" onSubmit={onSave}><label>Município<select name="municipality_id" required value={municipalityId} onChange={(e) => { setMunicipalityId(e.target.value); }}><option value="">Selecione…</option>{municipalities.map((m: Municipality) => <option key={m.id} value={m.id}>{m.name} – {m.state}</option>)}</select></label><label>Projeto<select name="project_id" required value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Selecione…</option>{projects.filter((p: Project) => p.active).map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Tipo de proposta<select name="proposal_type_id" defaultValue={editing ? value.proposal_type_id ?? "" : ""}><option value="">Selecione…</option>{availableProposals.map((p: ProposalType) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Contato principal<select name="primary_contact_id" defaultValue={editing ? value.primary_contact_id ?? "" : ""}><option value="">Nenhum</option>{availableContacts.map((c: Contact) => <option key={c.id} value={c.id}>{c.name} · {c.role}</option>)}</select></label><label>Etapa<select name="stage" defaultValue={editing ? value.stage : "MUNICÍPIO PESQUISADO"}>{PIPELINE_STAGES.map((s) => <option key={s}>{s}</option>)}</select></label><div className="form-grid two"><label>Primeiro contato<input type="date" name="first_contact_date" defaultValue={editing ? value.first_contact_date ?? "" : ""} /></label><label>Data da próxima ação<input type="date" name="next_action_date" defaultValue={editing ? value.next_action_date ?? "" : ""} /></label></div><label>Próxima ação<input name="next_action" defaultValue={editing ? value.next_action : ""} placeholder="Ex.: verificar retorno" /></label><label>Observações<textarea name="notes" defaultValue={editing ? value.notes : ""} /></label><FormButtons saving={saving} onClose={onClose} /></form></Modal>;
}

function ProjectModal({ value, saving, onClose, onSave }: any) { const editing = value !== "new"; return <Modal title={editing ? "Editar projeto" : "Novo projeto"} onClose={onClose}><form className="form" onSubmit={onSave}><label>Nome<input name="name" required defaultValue={editing ? value.name : ""} /></label><label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={editing ? value.active : true} /> Projeto ativo</label><FormButtons saving={saving} onClose={onClose} /></form></Modal>; }
function ProposalModal({ value, projects, saving, onClose, onSave }: any) { const editing = value !== "new"; return <Modal title={editing ? "Editar modalidade" : "Nova modalidade"} onClose={onClose}><form className="form" onSubmit={onSave}><label>Projeto<select name="project_id" required defaultValue={editing ? value.project_id : ""}><option value="">Selecione…</option>{projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Nome da modalidade<input name="name" required defaultValue={editing ? value.name : ""} /></label><label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={editing ? value.active : true} /> Modalidade ativa</label><FormButtons saving={saving} onClose={onClose} /></form></Modal>; }
function FormButtons({ saving, onClose }: { saving: boolean; onClose: () => void }) { return <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button></div>; }
function Empty({ text }: { text: string }) { return <div className="empty-state">{text}</div>; }
