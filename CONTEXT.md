# Product Requirements Document (PRD) & Architecture Context
**Projeto:** SaaS de Agendamento Multi-Profissional para Barbearias
**Versão:** 1.2
**Foco da Interface:** Mobile-First (Progressive Web App - PWA)
**Língua do código/schema:** Inglês (snake_case). Textos de UI e comentários: Português.

---

## 1. Objetivo do Produto

Desenvolver um sistema robusto e altamente escalável de agendamento online para barbearias. O sistema possui duas facetas principais:

1. **Landing Page / Fluxo de Conversão (Cliente Público):** Interface pública voltada para mobile, com estética de landing page premium (foto dos cortes, identidade visual da barbearia). Fluxo em 6 etapas (Wizard):
   1. **Serviço** — cliente escolhe o serviço desejado (nome, duração e preço visíveis).
   2. **Profissional** — cliente escolhe um barbeiro específico **ou** seleciona "Sem preferência" (sistema atribui ao primeiro disponível no slot).
   3. **Data** — chips horizontais com os próximos dias disponíveis (dias sem disponibilidade ficam desabilitados).
   4. **Horário** — chips agrupados por período (Manhã / Tarde / Noite), gerados dinamicamente pela disponibilidade do profissional.
   5. **Seus dados** — Nome completo + Número de telefone (sem e-mail, sem senha — zero fricção).
   6. **Confirmação** — resumo completo antes do envio; após confirmar, exibe tela de sucesso com os detalhes.
   - **Atenção:** Não haverá gateway de pagamento/checkout neste fluxo.
   - Acesso via slug único da barbearia (ex: `app.dominio.com/barbearia-do-ze`).

2. **Dashboard Administrativo (Barbeiros/Owner):** Área autenticada (SaaS) onde profissionais gerenciam sua agenda, serviços e faturamento, e o dono da barbearia gerencia a equipe e configurações gerais.

---

## 2. Modelo Multi-Tenant

Cada **organização** representa uma barbearia. O isolamento de dados entre organizações é obrigatório em todas as queries.

- Todo recurso de domínio (`services`, `appointments`, `working_hours`, `time_exceptions`) **deve** carregar `organization_id NOT NULL`.
- Toda query de backend passa por um helper `withTenant(organizationId)` que injeta o `WHERE organization_id = ?`.
- A médio prazo: avaliar Row-Level Security (RLS) do PostgreSQL como segunda camada de defesa.

---

## 3. Papéis e Permissões (RBAC)

| Papel | Quem é | O que pode fazer |
|---|---|---|
| `owner` | Dono da barbearia | Gerenciar equipe, serviços, configurações da org, ver financeiro global |
| `barber` | Profissional da casa | Gerenciar sua própria agenda, ver seu próprio financeiro |
| `public` | Cliente final | Acessar fluxo de agendamento público (sem autenticação, apenas nome + telefone) |

- O `owner` também pode agir como `barber` (ter sua própria agenda).
- Um usuário pode ser `barber` em múltiplas organizações.
- Convite de novos membros é responsabilidade do `owner`.

---

## 4. Fluxo de Onboarding de uma Nova Barbearia

1. Owner se registra com e-mail/senha ou OAuth (Google).
2. Sistema cria automaticamente uma **organização** vinculada ao owner.
3. Owner define o nome da barbearia e o slug público (único no sistema).
4. Owner cadastra serviços oferecidos e seus profissionais (convite por e-mail).
5. Cada profissional convidado aceita o convite e configura seus horários de trabalho.
6. Link público da barbearia fica ativo para clientes agendarem.

---

## 5. Entidades de Dados (Schema Esperado)

> Esta seção descreve as entidades principais. O schema SQL definitivo será gerado pela IA após aprovação da stack.

### `organizations`
Representa uma barbearia.
- `id`, `name`, `slug` (único, URL-friendly), `organization_id` (auto-referência não se aplica), `created_at`

### `users`
Gerenciado pelo provedor de autenticação (Better Auth). Membros de uma ou mais organizações.
- `id`, `email`, `name`, `phone`, `created_at`

### `members`
Relacionamento entre `users` e `organizations` com papel.
- `id`, `user_id`, `organization_id`, `role` (`owner` | `barber`), `created_at`

### `services`
Serviços oferecidos por uma barbearia (ex: Corte, Barba, Combo).
- `id`, `organization_id`, `name`, `description`, `duration_minutes` (INT), `price` (NUMERIC), `is_active` (BOOLEAN), `created_at`

### `working_hours`
Grade de trabalho padrão semanal de um profissional.
- `id`, `member_id`, `organization_id`, `day_of_week` (0=Dom … 6=Sáb), `start_time` (TIME), `end_time` (TIME)

### `time_exceptions`
Bloqueios pontuais na agenda (feriados, ausências, etc.).
- `id`, `member_id`, `organization_id`, `exception_date` (DATE), `start_time` (TIME), `end_time` (TIME), `reason` (TEXT, opcional)

### `appointments`
Núcleo do sistema. Cada linha é um agendamento confirmado.
- `id`, `organization_id`, `member_id` (profissional — atribuído pelo cliente ou pelo sistema se "Sem preferência"), `service_id`
- `client_name` (TEXT), `client_phone` (TEXT)
- `notes` (TEXT, opcional — observações livres do cliente, ex: "quero mais curto nos lados")
- `starts_at` (TIMESTAMPTZ), `ends_at` (TIMESTAMPTZ)
- `time_range` (TSTZRANGE — gerado como `[starts_at, ends_at)`, base da Exclusion Constraint)
- `status` (ENUM: `SCHEDULED`, `COMPLETED`, `CANCELED`, `NO_SHOW`)
- `price_at_booking` (NUMERIC — snapshot do preço no momento do agendamento)
- `service_name_at_booking` (TEXT — snapshot do nome do serviço, para histórico legível mesmo se o serviço for renomeado)
- `created_at` (TIMESTAMPTZ)

---

## 6. Restrições Tecnológicas Rigorosas

- **Banco de Dados Central:** PostgreSQL (mandatório e inegociável). Extensão `btree_gist` habilitada.
- **Escolha da Stack:** Backend, Frontend, ORM e Autenticação são propostos pela IA atuando como Arquiteto de Software (visando escalabilidade, segurança e DX), mas dependem de aprovação prévia antes da geração de qualquer código.

---

## 7. Requisitos Críticos de Arquitetura

### 7.1 Prevenção de Race Conditions (Double Booking)
É terminantemente proibido que o sistema permita dois agendamentos no mesmo slot de tempo para o mesmo profissional.

**Estratégia em 3 camadas:**
1. **Banco (definitiva):** `EXCLUDE USING gist (member_id WITH =, time_range WITH &&) WHERE (status IN ('SCHEDULED', 'COMPLETED'))` na tabela `appointments`.
2. **Aplicação:** INSERT dentro de transação; erro `23P01` (exclusion_violation) é traduzido em `409 Conflict` para o cliente.
3. **UX:** Re-fetch dos slots disponíveis após erro, evitando dupla submissão.

### 7.2 Snapshot de Preços
A coluna `price_at_booking` em `appointments` deve armazenar o preço do serviço **no exato momento da criação** do agendamento. Alterações futuras no preço do serviço não devem retroagir em agendamentos passados ou no painel financeiro.

### 7.3 Status de Agendamento Tipado
Utilizar `ENUM` nativo do PostgreSQL para o status da reserva:
- `SCHEDULED` — Agendado (ativo)
- `COMPLETED` — Concluído
- `CANCELED` — Cancelado (pelo cliente ou pelo profissional)
- `NO_SHOW` — Cliente não compareceu

### 7.4 Gestão de Fuso Horário
Todas as datas e horas devem ser salvas em UTC utilizando o tipo `TIMESTAMPTZ` do PostgreSQL. A conversão para o fuso local da barbearia é responsabilidade do frontend.

---

## 8. Regras de Negócio: Cálculo de Disponibilidade

A disponibilidade apresentada ao cliente é calculada **dinamicamente** no backend, cruzando:

1. **Horários Padrão** (`working_hours`): Grade de trabalho regular do profissional.
2. **Exceções de Horário** (`time_exceptions`): Bloqueios para dias específicos.
3. **Duração do Serviço** (`duration_minutes`): O slot apresentado deve comportar a duração total do serviço escolhido.
4. **Agendamentos Existentes** (`appointments`): Subtração dos slots já ocupados (onde `status IN ('SCHEDULED', 'COMPLETED')`).

O resultado é uma lista de slots `[starts_at, ends_at)` disponíveis para o profissional naquela data.

---

## 9. Dashboard Financeiro

O sistema deverá ter rotas e queries otimizadas no backend para agregar dados financeiros do profissional logado:
- Faturamento total: soma de `price_at_booking` onde `status = 'COMPLETED'`.
- Filtros obrigatórios: por período (dia, semana, mês), por serviço.
- Para o `owner`: visão agregada de todos os profissionais da organização.

---

## 10. Fora do Escopo (Não-Requisitos — MVP)

Os itens abaixo estão **deliberadamente fora** do MVP para manter o foco:

- ❌ Gateway de pagamento / checkout no fluxo de agendamento
- ❌ Aplicativo nativo (iOS/Android) — coberto pelo PWA
- ❌ Multi-idioma / i18n
- ❌ Integração com WhatsApp/SMS no MVP (avaliado no ADR-003)
- ❌ Marketplace de barbearias (busca pública por localidade)
- ❌ Sistema de avaliações/reviews de clientes
- ❌ Controle de estoque de produtos

---

## 11. ADRs Planejados (Pós-Aprovação da Stack)

| ADR | Tema | Desbloqueador |
|---|---|---|
| ADR-001 | Stack Tecnológica | ✅ Proposto — aguardando aprovação |
| ADR-002 | Estratégia de cálculo de disponibilidade (in-memory vs. materialização) | Após aprovação ADR-001 |
| ADR-003 | Notificações (WhatsApp Cloud API vs. SMS) e fila de jobs (pg-boss) | Após validação do MVP |
| ADR-004 | Row-Level Security (RLS) multi-tenant como segunda camada | Após estabilização do schema |