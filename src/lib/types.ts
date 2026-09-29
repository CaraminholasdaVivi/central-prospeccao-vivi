export const PIPELINE_STAGES = [
  "MUNICÍPIO PESQUISADO",
  "CONTATO IDENTIFICADO",
  "PRIMEIRO CONTATO",
  "AGUARDANDO RESPOSTA",
  "RESPONDEU",
  "CONVERSA EM ANDAMENTO",
  "PROPOSTA ENVIADA",
  "EM ANÁLISE",
  "NEGOCIAÇÃO",
  "FECHADO",
  "NÃO AVANÇOU",
  "RETOMAR DEPOIS",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const INTERACTION_TYPES = [
  "E-mail enviado",
  "E-mail recebido",
  "WhatsApp enviado",
  "WhatsApp recebido",
  "Ligação",
  "Reunião",
  "Proposta enviada",
  "Retorno recebido",
  "Observação",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export type Municipality = {
  id: string;
  name: string;
  state: string;
  secretaria: string;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  municipality_id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  whatsapp: string;
  notes: string;
};

export type Project = {
  id: string;
  name: string;
  active: boolean;
};

export type ProposalType = {
  id: string;
  project_id: string;
  name: string;
  active: boolean;
};

export type Opportunity = {
  id: string;
  municipality_id: string;
  project_id: string;
  proposal_type_id: string | null;
  primary_contact_id: string | null;
  stage: PipelineStage;
  first_contact_date: string | null;
  last_interaction_at: string | null;
  next_action: string;
  next_action_date: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  opportunity_id: string;
  occurred_at: string;
  type: InteractionType;
  description: string;
  observation: string;
};
