"use client";

import { useEffect, useState } from "react";
import { AfterArt, BeforeAfter, BeforeArt } from "./BeforeAfter";
import * as Icons from "./Icons";
import { Reveal } from "./ScrollReveal";
import { Wizard, type Member, type Service } from "./Wizard";

interface BookingPageProps {
  slug: string;
  orgName: string;
  initialServices: Service[];
  initialMembers: Member[];
}

const fmtPrice = (price: string) =>
  `R$ ${parseFloat(price).toFixed(2).replace(".", ",")}`;

const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
};

function Nav({ onBook }: { onBook: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-inner">
        <a href="#top" className="nav-logo">
          <span className="mark">S</span>
          <span>
            SANTOS<span className="studios">STUDIOS</span>
          </span>
        </a>
        <div className="nav-links">
          <a href="#galeria">Galeria</a>
          <a href="#servicos">Serviços</a>
          <a href="#equipe">Equipe</a>
          <a href="#contato">Contato</a>
        </div>
        <div className="nav-right">
          <div className="nav-ticker" aria-hidden="true">
            <span className="pulse" />
            <span>Atendendo agora</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={onBook}>
            Agendar
            <Icons.ArrowRight style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ onBook }: { onBook: () => void }) {
  return (
    <section className="hero" id="top">
      <div className="container">
        <div className="hero-mark">
          <svg
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M44 20c-2-4-7-6-12-6-7 0-12 4-12 9 0 13 24 7 24 19 0 6-6 10-13 10-6 0-11-2-13-6" />
            <line x1="14" y1="44" x2="50" y2="20" strokeWidth="1.2" opacity="0.4" />
          </svg>
        </div>
        <div className="hero-frame">
          <span className="dot" />
          Aberto · Seg–Sáb · 09h–19h
        </div>
        <h1>
          Sua próxima
          <br />
          <span className="ital">cadeira</span> de barbeiro.
        </h1>
        <p className="lead">
          Agende seu horário em segundos. Sem cadastro, sem complicação — só você, seu
          profissional e o tempo certo na cadeira.
        </p>
        <div className="hero-ctas">
          <button className="btn btn-primary" onClick={onBook}>
            Agendar agora
            <Icons.ArrowRight style={{ width: 16, height: 16 }} />
          </button>
          <a className="btn btn-ghost" href="#servicos">
            Ver serviços
          </a>
        </div>
        <div className="trust-strip">
          <span>
            <span className="ck">
              <Icons.Check />
            </span>
            Sem cadastro
          </span>
          <i />
          <span>
            <span className="ck">
              <Icons.Check />
            </span>
            Confirmação por WhatsApp
          </span>
          <i />
          <span>
            <span className="ck">
              <Icons.Check />
            </span>
            Cancele a qualquer hora
          </span>
        </div>
        <div className="hero-meta">
          <div>
            <div className="num">15</div>
            <div className="lbl">Serviços</div>
          </div>
          <div>
            <div className="num">2</div>
            <div className="lbl">Barbeiros</div>
          </div>
          <div>
            <div className="num">2 min</div>
            <div className="lbl">Para agendar</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkArt({ variant }: { variant: string }) {
  switch (variant) {
    case "head":
      return (
        <svg viewBox="0 0 100 120" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M28 50 Q30 22 50 20 Q70 22 72 50" strokeWidth="1.8" />
          <ellipse cx="50" cy="55" rx="22" ry="28" />
          <path d="M34 78 Q42 96 50 100 Q58 96 66 78" />
          <path d="M18 120 L18 105 Q35 95 50 95 Q65 95 82 105 L82 120" />
        </svg>
      );
    case "beard":
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="50" cy="42" rx="20" ry="22" />
          <path d="M28 60 Q34 86 50 92 Q66 86 72 60 Q70 75 62 84 Q56 90 50 90 Q44 90 38 84 Q30 75 28 60 Z" />
          <path d="M32 70 L28 80 M68 70 L72 80" strokeWidth="0.8" opacity="0.6" />
        </svg>
      );
    case "razor":
      return (
        <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 78 L48 40" strokeWidth="2.2" />
          <path d="M48 40 L86 18 L82 14 L46 36 Z" />
          <circle cx="10" cy="78" r="3" />
        </svg>
      );
    case "interior":
      return (
        <svg viewBox="0 0 140 100" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="12" y="10" width="38" height="46" />
          <line x1="12" y1="22" x2="50" y2="22" strokeWidth="0.8" opacity="0.6" />
          <rect x="56" y="14" width="38" height="42" />
          <line x1="56" y1="26" x2="94" y2="26" strokeWidth="0.8" opacity="0.6" />
          <rect x="100" y="18" width="28" height="38" />
          <line x1="8" y1="64" x2="132" y2="64" strokeWidth="1.6" />
          <path d="M50 76 L50 92 L74 92 L74 76" />
          <circle cx="62" cy="74" r="6" />
          <line x1="62" y1="92" x2="62" y2="98" />
          <line x1="115" y1="10" x2="115" y2="18" />
          <circle cx="115" cy="22" r="4" />
        </svg>
      );
    case "tools":
      return (
        <svg viewBox="0 0 120 80" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="14" cy="22" r="6" />
          <circle cx="14" cy="46" r="6" />
          <line x1="20" y1="22" x2="58" y2="40" />
          <line x1="20" y1="46" x2="58" y2="34" />
          <line x1="58" y1="34" x2="76" y2="22" />
          <line x1="58" y1="40" x2="76" y2="50" />
          <rect x="32" y="60" width="80" height="8" rx="2" />
          {[38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98, 104].map((x) => (
            <line key={x} x1={x} y1="68" x2={x} y2="76" />
          ))}
        </svg>
      );
    case "chair":
      return (
        <svg viewBox="0 0 80 100" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 30 L18 60 Q18 64 22 64 L58 64 Q62 64 62 60 L62 30" />
          <path d="M18 30 Q18 18 30 18 L50 18 Q62 18 62 30" />
          <rect x="34" y="8" width="12" height="14" rx="3" />
          <path d="M12 44 L18 44 M62 44 L68 44" />
          <line x1="40" y1="64" x2="40" y2="86" strokeWidth="2" />
          <path d="M22 92 L40 86 L58 92" strokeWidth="1.6" />
          <line x1="28" y1="78" x2="52" y2="78" />
        </svg>
      );
    default:
      return null;
  }
}

function Gallery() {
  const photos = [
    { lbl: "fade alto", cls: "tall", art: "head" },
    { lbl: "navalha · detalhe", cls: "", art: "razor" },
    { lbl: "barba lenhador", cls: "", art: "beard" },
    { lbl: "salão · janela leste", cls: "wide", art: "interior" },
    { lbl: "pompadour", cls: "", art: "head" },
    { lbl: "ferramentas", cls: "", art: "tools" },
    { lbl: "buzz cut", cls: "", art: "head" },
    { lbl: "cadeira 02", cls: "", art: "chair" },
    { lbl: "corte clássico", cls: "", art: "head" },
  ];
  return (
    <section className="block" id="galeria">
      <div className="container">
        <Reveal className="sec-head">
          <span className="eyebrow">01 — Galeria</span>
          <h2>
            O trabalho da <span className="ital">casa</span>.
          </h2>
          <p className="sub">
            Uma seleção do nosso dia a dia — cortes, detalhes e o próprio salão. No fim da
            galeria, arraste a linha dourada para ver o antes &amp; depois.
          </p>
        </Reveal>

        <div className="work-grid">
          {photos.map((p, i) => (
            <Reveal key={i} className={`wphoto ${p.cls}`} delay={Math.min(i, 5) * 60}>
              <div className="ph-art">
                <WorkArt variant={p.art} />
              </div>
              <div className="num">{String(i + 1).padStart(2, "0")}</div>
              <div className="lbl">{p.lbl}</div>
            </Reveal>
          ))}
        </div>

        <Reveal className="ba-hero ba-after-grid" delay={80} kind="rise">
          <div className="ba-section-eyebrow">
            <span>Antes &amp; Depois</span>
            <i />
            <span>Arraste a linha →</span>
          </div>
          <BeforeAfter
            beforeLabel="Antes"
            afterLabel="Depois"
            caption="Fade alto + barba alinhada · Santos Studios"
            idx={10}
            before={<BeforeArt variant="head" />}
            after={<AfterArt variant="head" />}
          />
        </Reveal>
      </div>
    </section>
  );
}

function Services({
  services,
  onBook,
}: {
  services: Service[];
  onBook: (s: Service) => void;
}) {
  return (
    <section className="block" id="servicos">
      <div className="container">
        <Reveal className="sec-head">
          <span className="eyebrow">02 — Serviços</span>
          <h2>
            O ofício, em <span className="ital">{services.length > 0 ? services.length : "vários"}</span> formatos.
          </h2>
          <p className="sub">
            Cada serviço é uma cerimônia. Preço fechado, sem surpresas. Toque em "Agendar"
            para começar.
          </p>
        </Reveal>

        {services.length === 0 ? (
          <div className="loading-row">
            <div className="spin spin-gold" />
            <span className="lbl">carregando serviços</span>
          </div>
        ) : (
          <div className="services-grid">
            {services.map((s, i) => (
              <Reveal key={s.id} className="svc-card" delay={Math.min(i, 5) * 70}>
                {i === 0 && (
                  <div className="badge-top">
                    <span className="star">★</span>Mais procurado
                  </div>
                )}
                <div className="num">{String(i + 1).padStart(2, "0")}</div>
                <h3>{s.name}</h3>
                <div className="desc">{s.description}</div>
                <div className="meta">
                  <div className="price">{fmtPrice(s.price)}</div>
                  <div className="dur">{fmtDuration(s.durationMinutes)}</div>
                </div>
                <button className="book" onClick={() => onBook(s)}>
                  <span>Agendar este serviço</span>
                  <span className="arrow">→</span>
                </button>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Team({ members }: { members: Member[] }) {
  const real = members.filter((m) => m.id !== "any");
  return (
    <section className="block" id="equipe">
      <div className="container">
        <Reveal className="sec-head">
          <span className="eyebrow">03 — Equipe</span>
          <h2>
            Mãos firmes, <span className="ital">olho clínico</span>.
          </h2>
          <p className="sub">
            Dois barbeiros, um padrão. Escolha um nome ou deixe que a casa decida — qualquer
            cadeira vai te tratar bem.
          </p>
        </Reveal>
        <div className="team-grid team-grid--two">
          {real.map((m, i) => (
            <Reveal key={m.id} className="member" delay={i * 100}>
              <div className="ph">
                <div className="tag">{String(i + 1).padStart(2, "0")}</div>
                <svg
                  viewBox="0 0 100 120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <ellipse cx="50" cy="45" rx="22" ry="26" />
                  <path d="M28 70 Q50 85 72 70" />
                  <path d="M22 120 Q22 85 50 80 Q78 85 78 120" />
                </svg>
              </div>
              <div className="info">
                <h4>{m.name}</h4>
                <div className="role">Barbeiro</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Location() {
  const hours = [
    { day: "Segunda", h: "09h – 19h" },
    { day: "Terça", h: "09h – 19h" },
    { day: "Quarta", h: "09h – 19h" },
    { day: "Quinta", h: "09h – 19h" },
    { day: "Sexta", h: "09h – 19h" },
    { day: "Sábado", h: "09h – 18h" },
    { day: "Domingo", h: "Fechado", closed: true },
  ];
  return (
    <section className="block" id="contato">
      <div className="container">
        <Reveal className="sec-head">
          <span className="eyebrow">04 — Localização</span>
          <h2>
            Onde a casa te <span className="ital">espera</span>.
          </h2>
        </Reveal>
        <div className="loc-grid">
          <Reveal kind="left">
            <div className="map-ph">
              <div className="pin" />
              <div className="pin-label">— 09°24′40″S · 40°30′01″W</div>
            </div>
            <div className="loc-addr">
              <span className="pill">Endereço</span>
              <span className="street">Travessa Dr. Édson Ribeiro, 10 A</span>
              <span className="city">Juazeiro — BA · 48903-560</span>
            </div>
          </Reveal>
          <Reveal className="loc-card" kind="right" delay={120}>
            <span
              className="pill mono"
              style={{
                fontSize: "10px",
                letterSpacing: "0.2em",
                color: "var(--gold)",
                textTransform: "uppercase",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Horário
            </span>
            <div style={{ marginTop: 14 }}>
              {hours.map((h) => (
                <div key={h.day} className={`loc-line ${h.closed ? "closed" : ""}`}>
                  <span className="day">{h.day}</span>
                  <span className="h">{h.h}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <a
                href="tel:+557435000000"
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", padding: "14px 18px" }}
              >
                <Icons.Phone style={{ width: 16, height: 16, color: "var(--gold)" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                  (74) 3500-0000
                </span>
              </a>
              <a
                href="#top"
                className="btn btn-ghost"
                style={{ justifyContent: "flex-start", padding: "14px 18px" }}
              >
                <Icons.Pin style={{ width: 16, height: 16, color: "var(--gold)" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }}>
                  Como chegar →
                </span>
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div>SANTOS STUDIOS · BARBEARIA — Juazeiro, BA</div>
      <div style={{ marginTop: 8, opacity: 0.6 }}>
        © {new Date().getFullYear()} — Agendamento operado por barbearia.app
      </div>
    </footer>
  );
}

export function BookingPage({
  slug,
  orgName: _orgName,
  initialServices,
  initialMembers,
}: BookingPageProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [presetService, setPresetService] = useState<Service | null>(null);

  useEffect(() => {
    document.body.style.overflow = wizardOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [wizardOpen]);

  const openWizard = (svc?: Service) => {
    setPresetService(svc ?? null);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setTimeout(() => setPresetService(null), 450);
  };

  return (
    <>
      <Nav onBook={() => openWizard()} />
      <Hero onBook={() => openWizard()} />
      <Gallery />
      <Services services={initialServices} onBook={(s) => openWizard(s)} />
      <Team members={initialMembers} />
      <Location />
      <Footer />

      <div className="sticky-cta">
        <button className="btn btn-primary" onClick={() => openWizard()}>
          Agendar agora
          <Icons.ArrowRight style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <Wizard
        slug={slug}
        open={wizardOpen}
        onClose={closeWizard}
        services={initialServices}
        members={initialMembers}
        loadingServices={false}
        loadingMembers={false}
        presetService={presetService}
      />
    </>
  );
}
