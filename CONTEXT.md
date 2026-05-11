# Product Requirements Document (PRD) & Architecture Context
**Projeto:** SaaS de Agendamento Multi-Profissional para Barbearias
**Foco da Interface:** Mobile-First (Progressive Web App - PWA)

## 1. Objetivo do Produto
Desenvolver um sistema robusto e altamente escalável de agendamento online. O sistema possui duas facetas:
1.  **Landing Page / Fluxo de Conversão (Cliente):** Interface pública voltada para mobile. Fluxo em etapas (Wizard): Escolha de Serviço -> Escolha de Profissional -> Escolha de Data/Hora -> Inserção de Nome e Telefone -> Confirmação. **Atenção:** Não haverá gateway de pagamento/checkout neste fluxo.
2.  **Dashboard Administrativo (Barbeiros):** Área autenticada (SaaS) onde cada profissional gerencia sua própria agenda, serviços ofertados e acompanha seu faturamento.

## 2. Restrições Tecnológicas Rigorosas
* **Banco de Dados Central:** PostgreSQL (Mandatório e inegociável).
* **Escolha da Stack (IA):** As ferramentas de Backend, Frontend, ORM e Autenticação devem ser propostas pela IA atuando como Arquiteto de Software, visando sempre a melhor escalabilidade, segurança e Developer Experience (DX), mas dependem de aprovação prévia antes da geração de código.

## 3. Requisitos Críticos de Arquitetura (Backend e Banco de Dados)
A engenharia do banco e da API deve seguir estritamente as práticas abaixo:

* **Prevenção de Race Conditions (Double Booking):** É terminantemente proibido que o sistema permita dois agendamentos no mesmo slot de tempo para o mesmo profissional. O banco de dados DEVE garantir essa trava (ex: locks otimistas, pessimistas ou *Exclusion Constraints* nativas do Postgres).
* **Padrão Snapshot de Preços:** A tabela de agendamentos (`appointments`) deve obrigatoriamente possuir uma coluna `price_at_booking`. O sistema deve gravar o preço do serviço no exato momento da criação do agendamento, garantindo que alterações futuras no preço do serviço não retroajam em agendamentos passados ou no painel financeiro.
* **Status de Agendamento Tipado:** Utilizar `ENUM` nativo do PostgreSQL para o status da reserva. Os estados obrigatórios são: `SCHEDULED` (Agendado), `COMPLETED` (Concluído), `CANCELED` (Cancelado) e `NO_SHOW` (Não compareceu).
* **Gestão de Fuso Horário:** Todas as datas e horas devem ser obrigatoriamente salvas em UTC utilizando o tipo `TIMESTAMPTZ` do Postgres para evitar anomalias de fuso horário.

## 4. Regras de Negócio de Tempo e Disponibilidade
A lógica de horários não é estática. A disponibilidade gerada para o cliente deve ser calculada dinamicamente cruzando as seguintes variáveis:
1.  **Horários Padrão:** Grade de trabalho regular do profissional (ex: Seg-Sex, 09h às 18h).
2.  **Exceções de Horário:** Bloqueios para dias específicos (ex: feriados, consultas médicas).
3.  **Duração do Serviço:** O slot de tempo apresentado ao cliente deve comportar a `duracao_minutos` do serviço escolhido.
4.  **Agendamentos Existentes:** Subtração dos slots já ocupados (onde status = `SCHEDULED` ou `COMPLETED`).

## 5. Dashboard Financeiro Básico
O sistema deverá ter rotas e queries otimizadas no backend para agregar os dados financeiros do profissional logado, calculando faturamento baseado unicamente nos agendamentos com status `COMPLETED`.