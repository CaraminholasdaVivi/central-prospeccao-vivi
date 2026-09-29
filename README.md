# Central de Prospecção Vivi - V1

Aplicação web pessoal para organizar a prospecção de projetos educacionais junto a municípios e Secretarias de Educação.

## Arquitetura

- Next.js + TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Row Level Security (RLS)
- Vercel para hospedagem
- Drag-and-drop nativo no Kanban, sem dependência adicional

## Escopo V1

A V1 implementa apenas o escopo aprovado:

- municípios e múltiplos contatos;
- projetos e modalidades de proposta;
- oportunidades = município + projeto;
- contato principal por oportunidade;
- Kanban com as 12 etapas aprovadas;
- movimentação manual entre etapas;
- histórico manual de interações;
- próxima ação e data;
- dashboard calculado a partir dos dados;
- busca e filtros combinados;
- edição e exclusão com confirmação;
- login/logout;
- persistência em nuvem;
- RLS por usuário.

Não há envio automático de e-mail ou WhatsApp, IA, disparos, integrações, anexos, importação de planilhas ou outras funcionalidades fora da V1.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. No SQL Editor, execute `supabase/schema.sql` inteiro.
3. O SQL cria as tabelas, índices, triggers, políticas RLS e o projeto inicial `Caraminholas` com as três modalidades:
   - Projeto completo + formação
   - Projeto sem formação
   - Acervo literário
4. Em Authentication > Users, crie a conta individual que será usada pela Central.
5. Copie a URL do projeto e a Publishable Key para `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

## Rodar localmente

```bash
npm install
npm run dev
```

Depois abra `http://localhost:3000`.

Entre com a conta criada no Supabase.

## Deploy na Vercel

1. Envie este projeto para um repositório Git.
2. Importe o repositório na Vercel.
3. Configure as mesmas duas variáveis de ambiente usadas localmente.
4. Faça o deploy.
5. A URL fornecida pela Vercel será o endereço da Central.

## Observação sobre a primeira conta

O banco usa um trigger para criar automaticamente o projeto inicial e suas modalidades quando uma nova conta Auth é criada. Se o SQL for instalado depois de a conta já existir, insira manualmente o projeto `Caraminholas` e as três modalidades pela tela de Projetos ou pelo SQL Editor.

## Regra de segurança

As tabelas expostas usam RLS e as operações são feitas como usuário autenticado. O navegador recebe apenas a chave pública/publishable key. Nenhuma service-role key deve ser colocada no `.env.local` público ou no código do cliente.
