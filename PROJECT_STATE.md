# PROJECT_STATE — Santos Studios Barbearia SaaS
> **Leia este arquivo antes de qualquer ação.** Ele é a fonte da verdade sobre o estado atual do projeto.
> Para requisitos completos de produto e schema, leia `CONTEXT.md`.

**Última atualização:** 2026-06-10 — FASE 10: Recepcionista (RBAC) + POS/Caixa + Produtos + Multi-serviços + Auto-gestão do cliente + Lembretes WhatsApp + Design premium mobile-first
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
  - Timezone: `parseTimeOnDate` usava offset fixo `-03:00`; agora usa `org.timezone` via `getUtcOffset()` (Intl-based, suporta DST)
  - "Qualquer membro com `workingHours` é barbeiro" (não só `role="member"`) — alinhado em 4 lugares: `[slug]/page.tsx`, `/api/[slug]/members`, `getAvailableSlots`, `getOrgProfessionals`
  - `durationMinutes <= 0` → retorna [] (defesa contra loop infinito)
  - Kanban: rollback de status + sync com prop após refetch
  - DELETE barbeiro: bloqueia se tem appointments; bloqueia auto-delete (`cannot_delete_self`)
  - time-exceptions POST: bloqueia se há appointment SCHEDULED sobreposto (409 `has_conflicting_appointments`)
  - POST appointments para barbeiro específico: valida `isProfessionalAvailableAt` antes do INSERT
  - `formatPhoneBR`: aceita +55 prefix
  - Wizard `presetService`: só aplica preset se ainda não há serviço escolhido
  - Wizard `handleNext`: `step < 6` → `step < 5` (corrige "etapa 6 de 5")
- [x] **2 perfis de barbeiro**: "Barbeiro" e "Barbeiro Admin" — UI + API atualizadas; owner aparece na lista com badge "Dono"; toggle renomeado para "Barbeiro Admin"; modal de criação com seletor de perfil
- [x] **Timezone dinâmico**: `org.timezone` (default `America/Sao_Paulo`) substituiu `-03:00` hardcoded; migration `0004_org_timezone.sql`; bug fix em `isProfessionalAvailableAt` (usava data UTC em vez de local)
- [x] **Schedule page seletor de barbeiro**: owner pode editar agenda de qualquer barbeiro via selector de pills
- [x] **Testes de carga**: sem código necessário; volume atual de Santos Studios não justifica; rota de disponibilidade aceitável para uso previsto
- [x] **Fluxo de convite**: código correto — usa `BETTER_AUTH_URL` para montar o link de reset; garantir que esta variável aponte para a URL pública no Easypanel

### FASE 6 — Engajamento (WhatsApp + Push) · `✅ CONCLUÍDA`
**Responsável:** Claude Opus

**Migration `0005_whatsapp_and_push.sql`** — 3 tabelas novas:
- [x] `push_subscriptions` (N por user — multi-device, endpoint UNIQUE, p256dh/auth)
- [x] `whatsapp_settings` (1:1 com org — apiUrl/apiKey/instanceName, templates default em pt-BR, followUpDays)
- [x] `follow_up_log` (dedup — não reenvia para mesmo telefone em janela de `followUpDays`)

**Push Notifications (PWA):**
- [x] `web-push` instalado + VAPID keys geradas (`.env` e `.env.example` atualizados)
- [x] `src/server/services/push.ts` — `sendPushToUser()` com cleanup automático de 410/404
- [x] `src/app/api/gstsantos/push/vapid-key/route.ts` — expõe chave pública
- [x] `src/app/api/gstsantos/push/subscribe/route.ts` — POST (upsert) + DELETE
- [x] `src/app/sw.ts` — handlers `push` e `notificationclick` (abre `/gstsantos/agenda` ou foca janela existente)
- [x] `src/components/PushPrompt.tsx` — banner discreto pedindo permissão; auto-resubscribe se permissão já concedida; dismiss persiste no localStorage
- [x] Mounted em `(protected)/layout.tsx`

**WhatsApp (Evolution API):**
- [x] `src/server/services/whatsapp.ts` — `normalizePhoneBR()`, `sendBookingConfirmationIfEnabled()`, `sendTestMessage()`, `triggerFollowUpForOrg()` com SQL `MAX(starts_at) GROUP BY phone` + dedup via `follow_up_log`
- [x] `src/app/api/gstsantos/whatsapp/settings/route.ts` — GET + POST (owner only, upsert)
- [x] `src/app/api/gstsantos/whatsapp/test/route.ts` — envia mensagem de teste
- [x] `src/app/api/gstsantos/whatsapp/trigger-followup/route.ts` — dual auth: `Bearer CRON_SECRET` (cron) ou sessão owner (painel)
- [x] `src/app/gstsantos/(protected)/whatsapp/page.tsx` — UI completa: conexão, automações, templates com variáveis, botão de teste, botão "disparar agora"
- [x] SidebarNav adiciona "WhatsApp" (owner only)

**Disparo unificado em `src/app/api/[slug]/appointments/route.ts`:**
- [x] Após `result.ok` → `void notifyAfterBooking({...})` (não-bloqueante)
- [x] Busca nome do profissional uma única vez; dispara push + WhatsApp em paralelo lógico (await dentro de try-catch isolado)
- [x] `createAppointment().appointment` agora inclui `professionalId` no retorno — necessário pra resolver o caso `memberId === "any"`

**Env vars novas (`src/lib/env.ts`):**
- [x] `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (todos opcionais — sistema gracefully skip push se não configurado)
- [x] `CRON_SECRET` opcional

**`npx tsc --noEmit`:** ✅ zero erros

### Pendências de deploy (EasyPanel)
- **Adicionar env vars de produção:** as 4 VAPID + `CRON_SECRET` (gere com `openssl rand -hex 32`)
- **Rodar migração:** `npm run db:migrate` na primeira inicialização do container já cria as 3 tabelas (idempotente — todas usam `IF NOT EXISTS`)
- **(Opcional) Cron de follow-up:** EasyPanel → Cron Jobs → diariamente 9h → `curl -X POST https://seudominio.com/api/gstsantos/whatsapp/trigger-followup -H "Authorization: Bearer $CRON_SECRET"`

### FASE 7 — Provisionamento WhatsApp 1-click + CRM Clientes · `✅ CONCLUÍDA`
**Responsável:** Claude Opus

**Migration `0006_customers_and_evolution.sql`:**
- [x] `customers` (id, org, phone normalizado, name, notes, tags text[], is_blocked, first/last_seen_at) com UNIQUE (org, phone)
- [x] Índices em `customers (org, name)` e `customers (org, last_seen_at)`
- [x] Índice em `appointments (org, customer_phone, starts_at)` pra queries de histórico
- [x] Colunas novas em `whatsapp_settings`: `connection_status`, `connected_number`, `last_sync_at`

**Evolution Service (`src/server/services/evolution.ts`):**
- [x] Wrapper completo da Evolution API v2: `ensureInstance` (idempotente), `getQrCode`, `getConnectionState`, `getInstanceInfo`, `logoutInstance`, `deleteInstance`, `sendText`
- [x] Helper `instanceNameForSlug` — gera nome seguro a partir do slug da org
- [x] Credenciais globais via env: `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` — owner nunca vê
- [x] Todas as funções resilientes (logam erro, retornam neutro — nunca lançam)

**API Routes Evolution (`/api/gstsantos/whatsapp/`):**
- [x] `POST /connect` — `ensureInstance` → `getQrCode` → status=connecting → retorna { qrcode, instanceName }
- [x] `GET /status` — sincroniza com Evolution → persiste no banco → retorna estado atualizado
- [x] `GET /qrcode` — refetch do QR (botão "Gerar novo QR")
- [x] `POST /disconnect` — `logoutInstance` + status=disconnected
- [x] `POST /test` — agora usa `instanceName` da org (não exige mais URL/key no body)
- [x] `GET/POST /settings` — apenas isEnabled, followUpDays, templates (sem mais URL/key)

**Página `/gstsantos/whatsapp` reescrita:**
- [x] Card de status: ⚪ Desconectado (com botão "Conectar WhatsApp") OU 🟢 Conectado · +55... (com Desconectar e Verificar status)
- [x] Modal QR Code: imagem renderizada do base64, timer regressivo 60s, polling `/status` a cada 2.5s
- [x] Botão "Gerar novo QR" pra refetch
- [x] Auto-fecha modal + toast quando status === "connected"

**Customers Service (`src/server/services/customers.ts`):**
- [x] `upsertCustomer` — ON CONFLICT (org, phone) com `LEAST(first_seen_at, $new)` / `GREATEST(last_seen_at, $new)`
- [x] `listCustomers` — agregação em subquery, filtros (search ILIKE name OR phone, tag via @>, scopeUserId para barbeiros), ordenação (lastVisit/name/totalSpent/totalVisits), paginação
- [x] `getCustomerAnalytics` — 8 queries: counts por status, datas chave, top 3 barbeiros, top 3 serviços, horário preferido (bucket manhã/tarde/noite), dia da semana preferido, frequência mensal últimos 12m, frequência média entre cortes
- [x] `getCustomerAppointments` — histórico paginado com filtro de scope
- [x] `loyaltyTierForVisits` em `customers.ts` schema: novo (1) · recorrente (2-4) · fiel (5-14) · vip (15+)

**API Routes Customers (`/api/gstsantos/customers/`):**
- [x] `GET /` — lista com filtros + scope para barbeiros
- [x] `GET /[id]` — detalhe com analytics + scope check (barbeiro precisa ter atendido o cliente)
- [x] `PATCH /[id]` — owner only, atualiza name/notes/tags/isBlocked
- [x] `GET /[id]/appointments` — histórico paginado com scope

**Página `/gstsantos/customers/page.tsx`:**
- [x] Header com busca (debounce 300ms) + ordenação
- [x] Filtros chip por tier (Todos / Novo / Recorrente / Fiel / VIP)
- [x] Lista de cards com avatar (iniciais), nome, telefone formatado, badge de tier, tags, badge bloqueado, métricas (N cortes · R$ X · há Yd)

**Página `/gstsantos/customers/[id]/page.tsx`:**
- [x] Header: avatar grande, nome, telefone, tier badge, badge bloqueado, "cliente desde", botão Bloquear/Desbloquear (owner only)
- [x] Tags editáveis (owner only): chips removíveis + input "+tag" com Enter
- [x] 5 KPIs: cortes, total gasto, frequência média, taxa de faltas (vermelha se >20%), tier
- [x] Banner azul "Próximo agendamento: ..." se houver SCHEDULED futuro
- [x] Análises em grid: Barbeiro favorito (rank bar), Serviço favorito, Preferências (horário + dia da semana), Frequência mensal (Recharts LineChart 12m)
- [x] Notas privadas (owner only): textarea com auto-save onBlur
- [x] Histórico: lista de appointments com status badge colorido + preço

**Wiring no booking (`/api/[slug]/appointments`):**
- [x] Normaliza phone (`normalizePhoneBR`)
- [x] `upsertCustomer` antes do INSERT do appointment
- [x] Bloqueia booking se `customer.isBlocked` → 403
- [x] Grava `customerPhone` normalizado no appointment (não o bruto)

**Backfill (`src/server/db/scripts/backfill-customers.ts`):**
- [x] Script idempotente: lê todos appointments → normaliza phones → UPDATE divergentes → agrupa por (org, phone) → UPSERT em customers com MIN(first_seen) / MAX(last_seen)
- [x] `package.json` ganhou script `db:backfill-customers`

**SidebarNav:** item "Clientes" 👥 acessível pra owner e barbeiros

**`npx tsc --noEmit`:** ✅ zero erros

### Pendências de deploy (EasyPanel) — adicionais da Fase 7
- **Env vars novas:** `EVOLUTION_API_URL` (sua Evolution na VPS) + `EVOLUTION_API_KEY` (master key)
- **Migration 0006:** roda automaticamente no `npm run db:migrate`
- **Backfill one-time:** rodar `npm run db:backfill-customers` em produção uma única vez para popular clientes a partir do histórico existente

### FASE 8 — Refinamentos UX (intervalo de almoço, despesas, notas, busca, env fix) · `✅ CONCLUÍDA`
**Responsável:** Claude Opus

**Migration `0008_lunch_break_and_expenses.sql`:**
- [x] `working_hours` ganha `break_start_time` e `break_end_time` (opcionais) + constraint que mantém o intervalo dentro do horário de trabalho
- [x] Nova tabela `expenses` (id, org, description, category, amount, date, created_by_user_id) — controle de despesas no financeiro

**Fix `src/lib/env.ts`:**
- [x] `z.preprocess` em todas as env vars opcionais para tratar `""` como `undefined` — resolvia erro `Invalid url` quando o EasyPanel definia a var com valor vazio

**APIs novas/estendidas:**
- [x] `GET/POST /api/gstsantos/expenses` + `DELETE /[id]` (owner only)
- [x] `working-hours` POST aceita `breakStartTime` + `breakEndTime`
- [x] `financial` GET retorna `totalExpenses`, `profit`, `expensesByCategory`, `expensesList`

**Service `availability.ts`:**
- [x] `getSlotsForProfessional` respeita o break — slots que se sobrepõem ao intervalo são removidos
- [x] `isProfessionalAvailableAt` também checa break

**UI:**
- [x] `schedule/page.tsx` — checkbox "Intervalo" + 2 inputs de hora por dia habilitado (validação client-side: break dentro do horário)
- [x] `financial/page.tsx` — KPIs "Despesas" e "Lucro" (owner only), seção lista de despesas, modal com categoria via `<datalist>` e botão remover
- [x] `agenda/page.tsx` — busca por cliente com debounce 300ms (nome ou telefone, normaliza dígitos) + props `filteredAppointments` para os 4 views
- [x] Notas do agendamento visíveis em todas as 4 views (Lista, Timeline, Semana, Kanban) com `📝` prefix e tooltip no hover

**`npx tsc --noEmit`:** ✅ zero erros

### FASE 9 — Módulo BI no Financeiro (3 sub-fases) · `✅ CONCLUÍDA`
**Responsável:** Claude Opus / Sonnet

Módulo robusto de Business Intelligence dentro do `/gstsantos/financial`, organizado em tabs: **Visão Geral** (atual + alertas), **Carteira**, **Ranking**, **Simulação**. Owner-only para tabs Carteira/Ranking/Simulação.

**Fase 9.1 — Carteira/LTV/Retenção (sem schema novo):**
- [x] Nova rota `GET /api/gstsantos/insights/route.ts` — owner only, 5 queries em paralelo via `Promise.all`
- [x] Métricas implementadas:
  - **Classificação da carteira**: Ativos (≤30d), Em Retenção (31-60d), Em Risco (61-90d), Perdidos (>90d) — por `customers.last_seen_at`
  - **Saúde da carteira** com badge Verde/Amarelo/Vermelho (≥40% / 25-40% / <25%)
  - **LTV** = ticket_médio × frequência_anual (com `partialData=true` se < 365d de histórico)
  - **Frequência anual** = (total_visits ÷ clientes) × (365 ÷ dias_operação)
  - **Taxa de 2ª visita** = clientes com 2+ COMPLETED / total
  - **Taxa de fidelização** = clientes com 5+ COMPLETED / total
  - **Fidelizados ativos vs totais** (5+ visitas E last_seen ≤ 30d)
  - **Retenção mensal (cohort)** — clientes do mês anterior que voltaram este mês
  - **Ranking de barbeiros 30d** — receita, atendimentos, ticket médio, taxa de conclusão
- [x] Componentes: `WalletInsights.tsx` (donut + KPIs + badges semafóricas), `BarberRanking.tsx` (🥇🥈🥉 + barra de progresso)
- [x] Refatoração de `financial/page.tsx` com sistema de tabs + fetch lazy de `/insights`
- [x] Avisos automáticos: "Dados parciais" se histórico < 1 ano, "Poucos dados" se < 10 clientes

**Fase 9.2 — Comissões + Lucratividade + Custos por Cadeira:**
- [x] Migration `0009_commissions_and_recurring_expenses.sql`:
  - `barber_services.commission_pct` (numeric 5,2 default 0, CHECK 0-100)
  - `expenses.is_recurring` (boolean default false)
  - `expenses.attributed_to_user_id` (FK user opcional — ON DELETE SET NULL)
  - Índice `expenses_org_attributed_idx`
- [x] Schema atualizado: `barber_services` ganha `commissionPct`, `expenses` ganha `isRecurring` + `attributedToUserId`
- [x] APIs novas:
  - `GET /api/gstsantos/barbers/[memberId]/commissions` — lista todos serviços ativos + % atual do barbeiro
  - `POST` — upsert em lote: cria attach + define %
- [x] Insights API estende ranking com profitabilidade:
  - Query 6: SUM(price × commission_pct / 100) por barbeiro = comissão paga
  - Query 7: despesas atribuídas por barbeiro (e não atribuídas = pool rateado)
  - Cada barbeiro recebe: `commission`, `attributedCost`, `sharedCost` (= unattributed / N_active), `totalCost`, `chairRevenue`, `profit`, `margin`, `breakEvenCuts`
- [x] Org-level: `profitability.orgRevenue30d`, `orgCommission30d`, `orgExpenses30d`, `orgProfit30d`, `orgMargin30d`
- [x] UI:
  - `BarberRanking` ganha seção expandível "Ver lucro e break-even" — mostra receita bruta, comissão, custos, lucro da cadeira, margem, break-even, capacidade
  - `barbers/page.tsx` ganha botão "Comissões" por barbeiro → modal lista serviços com inputs de %
  - Modal de despesas ganha checkbox "Despesa recorrente" + dropdown "Atribuir a barbeiro" (ou rateada)

**Fase 9.3 — Simulação + Alertas + Exportação CSV:**
- [x] Insights API ganha mais queries:
  - Query 8: receita por mês (últimos 3 meses) → projeção do próximo mês = média dos meses completos
  - Query 9: working_hours dos barbeiros ativos → minutos disponíveis em 30 dias (`(end - start - break) × 30/7` por day_of_week)
  - Query 10: duração média dos serviços atendidos por barbeiro → capacidade = minutos / duração_média
  - Calcula `saturation = completed / capacity` por barbeiro e org-wide
- [x] Resposta da API ganha `production` (capacidade, saturação, projeção, histórico mensal) e `alerts` consolidados:
  - **Saúde da carteira** (verde ≥40%, amarelo 25-40%, vermelho <25%)
  - **Retenção mensal** (verde ≥50%, amarelo ≥30%, vermelho <30%)
  - **Margem** (verde ≥30%, amarelo ≥15%, vermelho <15%)
  - **Saturação das cadeiras** (verde ≥70%, amarelo ≥50%, vermelho <50%)
- [x] Componentes novos:
  - `SimulationTab.tsx` — calculadora interativa com 5 sliders (cadeiras, cortes/cadeira/mês, ticket, comissão %, custo fixo). Calcula receita, comissão, lucro, margem, break-even por cadeira. Botões de cenários rápidos (+1 cadeira, ticket +20%, etc.) e "Resetar aos valores reais".
  - `AlertsCard.tsx` — exibe os 4 alertas semafóricos no topo da Visão Geral (owner only) + projeção do mês.
- [x] Exportação CSV via `csv.ts` (utility client-side com BOM UTF-8 para Excel):
  - Botão **Exportar CSV** em Visão Geral (receita diária), Despesas (lançamentos), Carteira (resumo dos 4 buckets), Ranking (todas as métricas de lucratividade).
- [x] Tab "Simulação" adicionada no `financial/page.tsx`

**Arquivos novos:**
- `src/server/db/migrations/0009_commissions_and_recurring_expenses.sql`
- `src/server/db/schema/expenses.ts` (já existia, estendida)
- `src/app/api/gstsantos/insights/route.ts`
- `src/app/api/gstsantos/expenses/route.ts` + `[id]/route.ts`
- `src/app/api/gstsantos/barbers/[memberId]/commissions/route.ts`
- `src/app/gstsantos/(protected)/financial/_components/WalletInsights.tsx`
- `src/app/gstsantos/(protected)/financial/_components/BarberRanking.tsx`
- `src/app/gstsantos/(protected)/financial/_components/SimulationTab.tsx`
- `src/app/gstsantos/(protected)/financial/_components/AlertsCard.tsx`
- `src/app/gstsantos/(protected)/financial/_components/csv.ts`

**`npx tsc --noEmit`:** ✅ zero erros

### Pendências de deploy (EasyPanel) — adicionais da Fase 9
- **Aplicar migrations 0008 + 0009 em produção:** Roda automaticamente em `npm run db:migrate` na primeira inicialização (todas idempotentes — `IF NOT EXISTS`)
- **Configurar comissões iniciais:** owner → /gstsantos/barbers → botão "Comissões" em cada barbeiro → ajustar % por serviço (default 0%)
- **Marcar despesas existentes:** opcionalmente editar despesas para definir `is_recurring=true` (aluguel, salários) ou `attributed_to_user_id` (custos por barbeiro específico)

### FASE 10 — Recepcionista + POS + Produtos + Multi-serviços + Auto-gestão + Lembretes + Design Premium · `✅ CONCLUÍDA`
**Responsável:** Claude (Fable)

**Migration `0010_pos_products_multiservice_reminders.sql`** (idempotente):
- [x] `appointments` ganha: `payment_method` (CHECK CASH/PIX/CREDIT_CARD/DEBIT_CARD), `tip_amount` (default 0), `completed_at`, `reminder_sent_at`
- [x] Nova tabela `appointment_services` — detalhamento multi-serviço (snapshot nome/preço/duração + position)
- [x] Novas tabelas `products` (name, price, cost_price, stock_quantity, is_active) e `appointment_products` (vendas no checkout com snapshot)
- [x] `whatsapp_settings` ganha: `reminder_enabled` (default true), `reminder_hours_before` (default 2), `reminder_template`
- [x] Índice parcial `appointments_reminder_scan_idx` para a varredura do cron

**1. RBAC — Papel `receptionist`:**
- [x] `requireAuth.ts`: `MemberRole = "owner" | "member" | "receptionist"` + flag `canManageAllAppointments`
- [x] Recepcionista vê/gerencia agenda de TODOS (appointments GET/status já escopavam só `member`)
- [x] Clientes: vê todos, edita nome/notas/tags; NÃO pode bloquear (`isBlocked` → owner only)
- [x] Financeiro: vê faturamento + fechamento de caixa por forma de pagamento; BI (insights/byBarber/despesas) continua owner-only
- [x] NÃO acessa: barbers (criar/remover), comissões, serviços, WhatsApp, produtos (gestão)
- [x] Criada sempre com `isBarber=false` — nunca aparece no booking público
- [x] `barbers/page.tsx`: 3 perfis no modal de criação (Barbeiro / Recepcionista / Barbeiro Dono), badge azul "Recepcionista", toggles ocultos para recepcionista
- [x] SidebarNav: nav da recepcionista = Agenda, Clientes, Financeiro (sem Serviços/Minha Agenda)

**2. Fluxo de convite refinado:**
- [x] `email.ts`: `markInviteEmail()` / `consumeInviteFlag()` (Map em memória, TTL 5min)
- [x] `auth.ts` `sendResetPassword`: convite → `sendBarberInviteEmail` (boas-vindas); esqueci-senha → template genérico
- [x] `barbers` POST marca o convite antes do `requestPasswordReset`; **não retorna mais `tempPassword`**
- [x] Modal pós-criação agora é "Convite enviado!" (sem credenciais expostas)
- [x] `reset-password/page.tsx` **reescrita premium**: card liquid glass com aura dourada animada, medidor de força de senha (5 níveis), toggle mostrar/ocultar, check animado de confirmação, animações de entrada (respeitando `prefers-reduced-motion`)

**3. Agendamento manual pelo painel:**
- [x] `GET /api/gstsantos/availability` — slots internos (`professionalId`+`serviceIds`+`date`); barbeiro comum só consulta a si
- [x] `POST /api/gstsantos/appointments` — cria com upsert de customer, validação de disponibilidade, multi-serviços; owner/recepcionista/barbeiro-admin agendam para qualquer um
- [x] `NewAppointmentModal.tsx` — botão "Novo agendamento" na agenda: busca de cliente existente (debounce + sugestões), pills de profissional, multi-select de serviços com total, slots em grid, bottom-sheet mobile

**4. POS / Fechamento de caixa:**
- [x] `status` PATCH estendido: ao COMPLETED aceita `paymentMethod` + `tipAmount` + `products[]`; grava `completed_at`, insere `appointment_products` (snapshot) e dá baixa no estoque (sem negativar)
- [x] `CheckoutModal.tsx` — intercepta "Concluir" em Lista e Kanban: 4 formas de pagamento com ícones, gorjeta com atalhos (5/10/20), carrinho de produtos com +/-, resumo com total
- [x] `financial` GET ganha `byPaymentMethod` (receita+gorjetas+contagem por método) e `productRevenue`/`productItemsSold`
- [x] Visão Geral do financeiro: seção "Fechamento de caixa" com barras proporcionais por método + linha de produtos vendidos

**5. Venda de produtos físicos:**
- [x] APIs: `GET/POST /api/gstsantos/products` + `PATCH/DELETE /[id]` (owner gerencia; qualquer membro lista ativos p/ checkout; delete com vendas → desativa)
- [x] Página `/gstsantos/products`: cards com margem calculada, badge de estoque, ativar/desativar, modal criar/editar
- [x] SidebarNav: item "Produtos" (owner only)

**6. Cancelamento/Reagendamento autônomo pelo cliente:**
- [x] `src/lib/booking-rules.ts` — `SELF_SERVICE_MIN_HOURS = 2` + `canSelfManage()`
- [x] APIs públicas: `GET /api/[slug]/appointments/[id]` (UUID = token de acesso), `POST /cancel`, `POST /reschedule` (mesmo profissional/duração, trata 23P01 → 409, zera `reminder_sent_at`), `GET /slots?date=` (exclui o próprio agendamento via `excludeAppointmentId` novo em `availability.ts`)
- [x] Página `/[slug]/agendamentos/[id]/gerenciar` — liquid glass: status badge, detalhes, remarcar (date-rail 14 dias + slots), cancelar com confirmação inline, telas de sucesso animadas
- [x] Link de gerenciamento: anexado à mensagem de confirmação WhatsApp + exibido na tela de sucesso do wizard + retornado pela API de booking (`manageUrl`)

**7. Múltiplos serviços (combos):**
- [x] Validadores aceitam `serviceIds` (1-5) mantendo compat com `serviceId`
- [x] `/api/[slug]/availability` soma duração de todos os serviços
- [x] Booking público e manual: preço total, duração total, nome concatenado ("Corte + Barba"), itens gravados em `appointment_services`
- [x] Wizard passo 1 virou multi-select com barra flutuante de total (`.wz-combo-bar` glass)

**8. Lembrete automático pré-agendamento (WhatsApp):**
- [x] `triggerRemindersForOrg()` em `whatsapp.ts` — busca SCHEDULED na janela `reminder_hours_before`, dedup via `reminder_sent_at`, pausas aleatórias anti-rajada
- [x] `POST /api/gstsantos/whatsapp/trigger-reminders` — dual auth (Bearer CRON_SECRET ou sessão owner)
- [x] Página WhatsApp: toggle "Lembrete antes do horário", input de horas, template editável com variáveis
- [x] Settings API expõe/persiste os 3 campos novos

**9. Design premium mobile-first:**
- [x] `lucide-react` instalado — SVG icons substituem TODOS os emojis na navegação (Sidebar + bottom nav com glass blur)
- [x] globals.css: utilitário `.glass-card` (liquid glass), `.rv-scale` (novo kind de reveal), active states táteis (`scale(0.98)` em botões, `.opt`, `.slot`, `.date-chip`), touch targets ≥44px (btn min-height 48, slots 44, close 44)
- [x] Sticky CTA mobile: glass blur + linha dourada + animação `ctaGlow` pulsante (desativada em reduced-motion)
- [x] Landing: nova seção "Depoimentos" (3 cards glass com reveals left/rise/right), galeria com reveal "scale", equipe com "rise"
- [x] ScrollReveal ganha kind `"scale"`

**`npx tsc --noEmit`:** ✅ zero erros · **`npm run build`:** ✅ 41 páginas/rotas compiladas

### Pendências de deploy (EasyPanel) — adicionais da Fase 10
- **Migration 0010:** `npm run db:migrate` no container `ssbarber` (idempotente)
- **Cron de lembretes:** EasyPanel → Cron Jobs → a cada 15 min → `curl -X POST https://seudominio.com/api/gstsantos/whatsapp/trigger-reminders -H "Authorization: Bearer $CRON_SECRET"`
- **Cadastrar produtos** em /gstsantos/products para habilitar venda no checkout
- **Criar a recepcionista** em /gstsantos/barbers → perfil "Recepcionista" (recebe convite por e-mail; exige RESEND_API_KEY configurada)

### Bugs conhecidos não resolvidos
- **`canCreateServices` permite gerenciar barbers**: flag ainda se chama `canCreateServices` no DB — semântica confusa, mas funcional. UI já exibe como "Barbeiro Admin". Renomear coluna no banco é trabalho futuro sem urgência.

### FASE 11 — Multi-unidade (filiais) · `✅ CONCLUÍDA` (3 sub-fases)

**Sub-fase 1 — Fundação + Mapa (commit "Fase 1"):**
- [x] Schema: `units`, `member_units` (N:N barbeiro↔unidade), `service_units` (preço por unidade); `unit_id` nullable em `appointments`, `working_hours`, `time_exceptions`, `expenses`, `products`
- [x] Migration manual idempotente `0011_units_multi_unit.sql` + script `npm run db:backfill-units` (cria "Matriz" e vincula dados existentes; idempotente)
- [x] CRUD de unidades em /gstsantos/units — dono cola link do Google Maps (`maps.app.goo.gl`), sistema resolve lat/lng (`src/server/services/google-maps.ts`)
- [x] Mapa real MapLibre GL (basemap Carto dark, sem API key) na página pública, multi-pin com popups

**Sub-fase 2 — Operação por unidade (commit "Fase 2"):**
- [x] Equipe: atribuição barbeiro↔unidades (modal em /gstsantos/barbers)
- [x] Serviços: preço por unidade (inputs por filial no modal)
- [x] Horários (`working_hours`) escopados por unidade; conflito de agenda do barbeiro continua GLOBAL (não se divide entre filiais)
- [x] Booking público: cliente escolhe a filial antes do wizard; serviços/barbeiros/preços/slots filtrados por unidade
- [x] Agenda do painel: filtro por unidade + seletor no agendamento manual

**Sub-fase 3 — Dados por unidade + correções (este commit):**
- [x] **Bugfix modais cortados no topo**: `animation-fill-mode: both` em `.gst-page`/`.gst-stagger` mantinha animação de transform "aplicada" para sempre → containing block permanente → `position: fixed` dos modais relativo ao container. Trocado para `backwards`. Mesmo problema em `.rv` (página pública): `will-change: transform` permanente → adicionado `will-change: auto` em `.rv.in`
- [x] /financeiro: filtro por unidade (tabs "Consolidado" + filiais) em todas as abas — Visão Geral, Carteira, Ranking, Simulação (`?unitId=` em /financial e /insights)
- [x] /insights: todas as 10 queries aceitam `unitId`; carteira/fidelização por unidade derivam `last_seen` dos próprios appointments da filial (tabela `customers` é global)
- [x] Despesas: campo "Unidade" no modal (null = geral/rateada em todas); filtradas no financeiro por filial
- [x] Produtos: campo "Unidade" no cadastro/edição + filtro por filial na página
- [x] Página pública: link do Google Maps colado pelo dono agora é o destino do "Ir →" (lista de unidades), do "Como chegar →" (popup do mapa) e do novo "Ver no Google Maps →" (unidade única)
- [x] Validação: tsc 0 erros · build OK · queries SQL testadas em Postgres real (incl. fragmento vazio do consolidado)

**Deploy:** migração 0011 JÁ APLICADA em produção (12/06/2026). Falta: `git push` → rebuild EasyPanel → `npm run db:backfill-units` no container.

**Sub-fase 4 — Mapa público: renderização + labels + foto por unidade (12/06/2026):**
- [x] **Bugfix mapa preto em produção**: MapLibre não desenhava (nem tiles nem pins). Causas e correções:
  - `LocationMap` importado via `dynamic(ssr:false)` no `BookingPage` (WebGL não roda em SSR)
  - Init do mapa só após o container ter dimensões reais (guarda `requestAnimationFrame`); sem isso inicializava 0×0
  - **Service worker (Serwist)**: `defaultCache` roteava TODA requisição cross-origin por `NetworkFirst` com cap de 32 entradas → thrashing nas tiles do Carto. Adicionado bypass `NetworkOnly` para `cartocdn.com` em `src/app/sw.ts`
  - Canvas preto pós-load (animação de reveal mexendo no transform): `ResizeObserver` + `resize()/triggerRepaint()` adiados (150/450/900ms) + `width/height:100%` explícito no `.gst-map-canvas`
- [x] Labels sempre visíveis abaixo de cada pin (estilo 21st.dev); wrapper dot+label com `anchor:"top"`
- [x] Primeira visão enquadra TODAS as unidades (`fitBounds`); `flyTo` inicial pulado via `didFlyRef` para não anular o enquadramento
- [x] **Foto por unidade no popup do mapa**: coluna `photo_url` (migração 0012). Dono envia upload (comprimido no cliente p/ JPEG ~1000px via canvas → data URL) OU cola URL. Popup mostra foto real com banner-monograma dourado de fallback. Validação aceita `http(s)` ou `data:image/` até ~2MB
- [x] Validação: tsc 0 erros

**Deploy Sub-fase 4:** Falta: `git push` → rebuild EasyPanel → `npm run db:migrate` (aplica 0012) no container.

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
