# PROJECT_STATE — Santos Studios Barbearia SaaS
> **Leia este arquivo antes de qualquer ação.** Ele é a fonte da verdade sobre o estado atual do projeto.
> Para requisitos completos de produto e schema, leia `CONTEXT.md`.

**Última atualização:** 2026-05-18 — FASE 4 concluída + correções de bugs críticos
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
| Deploy | VPS Própria (Easypanel) — Banco e App na mesma infraestrutura |

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
- [x] Wizard 5 etapas: Serviço → Profissional → Data+Horário (unificados) → Dados → Confirmação
- [x] Tela de sucesso pós-agendamento
- [x] PWA: manifest (`src/app/manifest.ts`), service worker Serwist (`src/app/sw.ts`), ícones via `ImageResponse` (32px favicon, 180px apple-icon, 192/512px manifest) — SW desabilitado em dev
- [x] Galeria com fotos reais (`public/imgs/`) no lugar dos SVGs placeholder
- [x] Before/After com `antes.jpg` / `depois.jpg` reais
- [x] Hero-meta: contagem de serviços e barbeiros dinâmica (vinda do banco)
- [x] Bug fix: "Sem preferência" não mostrava horários — query de `getAvailableSlots` agora filtra apenas profissionais com `workingHours` cadastrados (mesmo critério do endpoint `/members`)

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

**Fluxo de convite de barbeiro (implementado nesta sessão):**
- Admin cria barbeiro → usuário criado com senha aleatória → membro inserido → Better Auth dispara email com link `reset-password`
- Endpoint correto: `POST /api/auth/request-password-reset` (não `/forget-password`)
- Página `/gstsantos/reset-password?token=` lê token da query string via `authClient.resetPassword()`
- `sendResetPassword` callback em `src/lib/auth.ts` chama `sendPasswordResetEmail` (mesmo email para convite e esqueci-senha)
- Testado end-to-end: 302 redirect do Better Auth → página reset → login → agenda ✅

**Rotas `(protected)/` (implementado nesta sessão):**
- Route group `(protected)/` isola páginas autenticadas do login — resolve redirect loop anterior
- `layout.tsx` só existe dentro de `(protected)/`, cobre todas as páginas do dashboard exceto login/forgot-password/reset-password
- Link hrefs para rotas do dashboard precisam de cast `as any` (typedRoutes rejeita rotas não-literais)

### FASE 5 — Polimento e Deploy · `🔄 EM ANDAMENTO`
- [x] PWA (Serwist) — concluído
- [x] Fotos reais na landing page
- [x] Melhorias UX no wizard (data+horário unificados, 5 passos)
- [x] Bug fix disponibilidade "Sem preferência"
- [x] **Auditoria + correções de bugs:**
  - Timezone: `parseTimeOnDate` agora usa offset Brasil (-03:00); filtro de data da agenda também
  - "Qualquer membro com `workingHours` é barbeiro" (não só `role="member"`) — alinhado em 4 lugares: `[slug]/page.tsx`, `/api/[slug]/members`, `getAvailableSlots`, `getOrgProfessionals`
  - `durationMinutes <= 0` → retorna [] (defesa contra loop infinito)
  - Kanban: rollback de status + sync com prop após refetch
  - DELETE barbeiro: bloqueia se tem appointments; bloqueia auto-delete (`cannot_delete_self`)
  - time-exceptions POST: bloqueia se há appointment SCHEDULED sobreposto (409 `has_conflicting_appointments`)
  - POST appointments para barbeiro específico: valida `isProfessionalAvailableAt` antes do INSERT
  - `formatPhoneBR`: aceita +55 prefix
  - Wizard `presetService`: só aplica preset se ainda não há serviço escolhido
  - Wizard `handleNext`: `step < 6` → `step < 5` (corrige "etapa 6 de 5")
- [ ] Testes de carga na rota de disponibilidade
- [ ] Configuração do projeto no Easypanel (App Next.js)
- [ ] Conexão com o banco Postgres interno do Easypanel
- [ ] Configuração de domínio e SSL (via Easypanel)

### Bugs conhecidos não resolvidos
- **Timezone hardcoded**: usado offset `-03:00` em vários lugares; OK pra Santos Studios mas não escala para multi-tenant em outros fusos. Refatorar para `org.timezone` quando expandir.
- **Schedule page do owner**: owner consegue editar próprios horários via `/api/gstsantos/working-hours` (sem `professionalId` no body usa `ctx.userId`). Mas a UI atual não tem seletor de barbeiro pro owner editar OUTROS barbeiros — funcionalidade limitada.
- **`canCreateServices` permite gerenciar barbers**: lógica em `/api/gstsantos/barbers/route.ts:36` (`ctx.role === "owner" || ctx.canCreateServices`) — semântica confusa, deveria ser flag separada.

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
