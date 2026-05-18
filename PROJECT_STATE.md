# PROJECT_STATE — Santos Studios Barbearia SaaS
> **Leia este arquivo antes de qualquer ação.** Ele é a fonte da verdade sobre o estado atual do projeto.
> Para requisitos completos de produto e schema, leia `CONTEXT.md`.

**Última atualização:** 2026-05-16 — FASE 4 concluída
**Atualize este arquivo ao concluir cada fase.**

---

## Stack Aprovada (ADR-001 ✅)

| Camada | Escolha |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + Tailwind CSS + shadcn/ui + Serwist (PWA) |
| Backend | Next.js Route Handlers + Server Actions (monolito modular) |
| ORM | Drizzle ORM + drizzle-kit |
| Banco | PostgreSQL + extensão `btree_gist` |
| Auth | Better Auth + plugin `organizations` + adapter Drizzle |
| Validação | Zod (compartilhada client/server) |
| Deploy | A definir (Fly.io / Railway + Neon Postgres) |

---

## Estrutura de Pastas Alvo

```
src/
├── app/                        # Next.js App Router
│   ├── [slug]/                 # Fluxo público da barbearia (sem auth)
│   └── dashboard/              # Área autenticada (owner + barber)
├── server/
│   ├── db/
│   │   ├── schema/             # Drizzle schema (uma tabela por arquivo)
│   │   └── index.ts            # Client Drizzle
│   ├── services/               # Lógica de domínio pura (sem HTTP)
│   │   ├── availability.ts     # Cálculo de slots disponíveis
│   │   └── appointments.ts     # Criação com Exclusion Constraint
│   └── auth.ts                 # Configuração Better Auth
├── lib/
│   └── validators/             # Schemas Zod compartilhados
└── components/                 # Componentes React (shadcn/ui base)
```

---

## Fases e Status

### FASE 1 — Fundação (Backend + DB) · `✅ CONCLUÍDA`
**Responsável:** Claude Opus

- [x] Scaffolding Next.js 15 + configuração Drizzle + Better Auth
- [x] Schema completo (ver tabelas em `CONTEXT.md §5`)
- [x] Migration inicial (`drizzle-kit generate --name=init`) — 11 tabelas
- [x] Migration customizada `0001_anti_double_booking.sql` — `btree_gist` + `tstzrange GENERATED` + `EXCLUDE USING gist`
- [x] Seed de dados (Santos Studios como tenant de desenvolvimento) — `src/server/db/seed.ts` idempotente, usuários via `auth.api.signUpEmail()`
- [x] Better Auth: registro, login, organizations, convite de membros

> ⚠️ **Observação de schema:** `time_exceptions` usa `starts_at / ends_at` (TIMESTAMPTZ) em vez de `exception_date` (DATE). Isso é **melhor** — permite bloquear intervalos parciais do dia (ex: só de tarde). CONTEXT.md já reflete isso.

### FASE 2 — API Core · `✅ CONCLUÍDA`
**Responsável:** Claude Sonnet

- [x] `GET  /api/[slug]/info` — dados públicos da barbearia
- [x] `GET  /api/[slug]/services` — serviços ativos (filtrado por `is_active = true`)
- [x] `GET  /api/[slug]/members` — profissionais + opção `{ id: "any", name: "Sem preferência" }`
- [x] `GET  /api/[slug]/availability` — slots `?memberId=&serviceId=&date=` (CONTEXT.md §8 completo: working_hours × time_exceptions × appointments ativos)
- [x] `POST /api/[slug]/appointments` — Exclusion Constraint (23P01 → 409), snapshot `price_at_booking` + `service_name_at_booking`, lógica "any" com fallback por profissional

### FASE 3 — Frontend Público (Landing + Wizard) · `✅ CONCLUÍDA`
**Responsável:** Claude Code

- [x] Landing page: identidade visual Santos Studios, fotos de cortes, CTA "Agendar"
- [x] Wizard 6 etapas: Serviço → Profissional → Data → Horário → Dados → Confirmação
- [x] Tela de sucesso pós-agendamento
- [ ] PWA: manifest, service worker (Serwist), installability — **pendente (pode entrar na FASE 5)**

### FASE 4 — Dashboard Administrativo · `✅ CONCLUÍDA`
**Responsável:** Claude Sonnet

**Schema & Seed:**
- [x] `canCreateServices: boolean` adicionado à tabela `member`
- [x] Tabela `barber_services` (memberId → serviceId, unique constraint)
- [x] Migration `0003_peaceful_big_bertha.sql` gerada e aplicada
- [x] Seed reescrito: superadmin `enzononato10@gmail.com` / `Ee123456@`; rotas públicas excluem owners

**Email:**
- [x] `npm install resend`; `sendBarberWelcomeEmail` com fallback para console.log
- [x] `RESEND_API_KEY` e `RESEND_FROM` opcionais no `.env`

**Middleware:**
- [x] `src/server/middleware/requireAuth.ts` — retorna `AuthContext | null`

**API Routes (`/api/gstsantos/`):**
- [x] `GET /api/gstsantos/me`
- [x] `GET /api/gstsantos/barbers` + `POST` (cria usuário + membro + envia email)
- [x] `PATCH /api/gstsantos/barbers/[memberId]` (toggle canCreateServices, owner only)
- [x] `DELETE /api/gstsantos/barbers/[memberId]` (owner only)
- [x] `GET /api/gstsantos/services` (inclui isAttached para membros)
- [x] `POST /api/gstsantos/services` (canManageServices)
- [x] `PATCH /api/gstsantos/services/[id]` (canManageServices)
- [x] `POST /api/gstsantos/services/[id]/attach` + `DELETE` (auto-attach para barbers)
- [x] `GET /api/gstsantos/appointments` (owner: todos; member: próprios; filtros: date, status, barberId)
- [x] `PATCH /api/gstsantos/appointments/[id]/status`
- [x] `GET /api/gstsantos/financial` (KPIs + daily + byService + byBarber owner-only)
- [x] `GET/POST /api/gstsantos/working-hours`
- [x] `GET/POST /api/gstsantos/time-exceptions` + `DELETE /[id]`

**Dashboard Pages (`/gstsantos/`):**
- [x] `login/page.tsx` — form email+senha, sem link de cadastro
- [x] `layout.tsx` — server-side auth check + SidebarNav (desktop) + bottom nav (mobile)
- [x] `page.tsx` — redirect → `/gstsantos/agenda?view=list`
- [x] `agenda/page.tsx` — 4 views: Lista, Timeline, Semana, Kanban (@dnd-kit)
- [x] `financial/page.tsx` — KPIs + LineChart + PieChart (Recharts, gold #C9A84C) + tabela por barbeiro
- [x] `services/page.tsx` — cards com toggle ativo/inativo, attach/detach, modal create/edit
- [x] `barbers/page.tsx` — lista com avatar iniciais, modal criar, toggle canCreateServices, remover
- [x] `schedule/page.tsx` — grid de horários por dia + CRUD de exceções

**`npx tsc --noEmit`:** ✅ zero erros

### FASE 5 — Polimento e Deploy · `⏳ AGUARDANDO FASE 4`
- [ ] Testes de carga na rota de disponibilidade
- [ ] Configurar Neon Postgres (produção)
- [ ] Deploy Next.js (Fly.io ou Railway)
- [ ] Domínio customizado

---

## Decisões Tomadas (não reabrir sem motivo)

| # | Decisão | Motivo |
|---|---|---|
| 1 | Cliente público: **sem senha**, apenas nome + telefone | Zero fricção no wizard = mais conversões |
| 2 | Double-booking: `EXCLUDE USING gist` no banco, não na aplicação | Única garantia real contra race conditions |
| 3 | Preço e nome do serviço como snapshot em `appointments` | Historial legível mesmo após renomear/repreci|
| 4 | Monolito modular, domínio em `src/server/services/` | Velocidade de MVP; fronteira limpa para extração futura |
| 5 | `"Sem preferência"` como opção de profissional | Sistema atribui ao primeiro disponível no slot |

---

## Contexto Rápido do Negócio

- **Cliente:** Santos Studios Barbearia (Juazeiro, BA)
- **Sistema atual:** Booksy (sendo substituído)
- **Usuários finais:** Clientes via celular (mobile-first) + barbeiros no dashboard
- **Multi-tenant:** Sim — arquitetura preparada para múltiplas barbearias desde o início

---

## Como Usar Este Arquivo com IAs

### Novo chat — Iniciar qualquer fase
```
Leia PROJECT_STATE.md e CONTEXT.md na raiz do projeto.
[Descreva a tarefa específica da fase]
Não reabra decisões já registradas no PROJECT_STATE.md.
```

### Continuando trabalho de um chat anterior
```
Leia PROJECT_STATE.md. A fase X está [em andamento / concluída até o ponto Y].
Continue a partir de: [tarefa específica].
```

### Ao concluir uma fase ou tarefa
```
Atualize PROJECT_STATE.md: marque como concluído [itens] e ajuste o status da fase.
```
