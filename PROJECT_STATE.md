# PROJECT_STATE — Santos Studios Barbearia SaaS
> **Leia este arquivo antes de qualquer ação.** Ele é a fonte da verdade sobre o estado atual do projeto.
> Para requisitos completos de produto e schema, leia `CONTEXT.md`.

**Última atualização:** 2026-05-23 — Provisionamento 1-click WhatsApp (QR code) + Página de Clientes (CRM)
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

### Bugs conhecidos não resolvidos
- **`canCreateServices` permite gerenciar barbers**: flag ainda se chama `canCreateServices` no DB — semântica confusa, mas funcional. UI já exibe como "Barbeiro Admin". Renomear coluna no banco é trabalho futuro sem urgência.

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
