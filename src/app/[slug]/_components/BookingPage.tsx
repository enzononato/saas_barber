"use client";

import { useEffect, useState } from "react";
import { BeforeAfter } from "./BeforeAfter";
import * as Icons from "./Icons";
import { Reveal } from "./ScrollReveal";
import { Wizard, type Member, type Service } from "./Wizard";

interface BookingPageProps {
  slug: string;
  orgName: string;
  initialServices: Service[];
  initialMembers: Member[];
  teamMembers: Member[];
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

function Hero({ onBook, serviceCount, barberCount }: { onBook: () => void; serviceCount: number; barberCount: number }) {
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
            <div className="num">{serviceCount}</div>
            <div className="lbl">Serviços</div>
          </div>
          <div>
            <div className="num">{barberCount}</div>
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


const GALLERY_PHOTOS = [
  { lbl: "tape fade", cls: "tall", src: "/imgs/tape-fade.jpeg" },
  { lbl: "navalha · detalhe", cls: "", src: "/imgs/navalha.jpg" },
  { lbl: "barba lenhador", cls: "", src: "/imgs/barba.jpg" },
  { lbl: "degradê", cls: "wide", src: "/imgs/degrade.jpeg" },
  { lbl: "corte americano", cls: "", src: "/imgs/americano.jpg" },
  { lbl: "acabamento", cls: "", src: "/imgs/foto-2.jpg" },
  { lbl: "pigmentação", cls: "", src: "/imgs/pigmentacao.jpeg" },
  { lbl: "americano liso", cls: "", src: "/imgs/americano-2.jpg" },
  { lbl: "estilo", cls: "", src: "/imgs/foto-5.jpeg" },
];

function Gallery() {
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
          {GALLERY_PHOTOS.map((p, i) => (
            <Reveal key={i} className={`wphoto ${p.cls}`} kind="scale" delay={Math.min(i, 5) * 60}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.lbl}
                className="ph-img"
                loading={i < 4 ? "eager" : "lazy"}
                decoding="async"
              />
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
            before={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/imgs/antes.jpg" alt="Antes" className="ba-photo" />
            }
            after={
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/imgs/depois.jpg" alt="Depois" className="ba-photo" />
            }
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
            <Reveal key={m.id} className="member" kind="rise" delay={i * 100}>
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

const TESTIMONIALS = [
  {
    quote:
      "Melhor barbearia de Juazeiro, sem discussão. Agendo pelo site em um minuto e nunca esperei na cadeira.",
    name: "Carlos M.",
    since: "Cliente desde 2023",
  },
  {
    quote:
      "O degradê fica impecável toda vez. O lembrete no WhatsApp salva minha vida — nunca mais perdi horário.",
    name: "Rafael S.",
    since: "Cliente desde 2024",
  },
  {
    quote:
      "Trato barba e cabelo no mesmo horário. Atendimento de primeira, ambiente top e preço justo.",
    name: "João P.",
    since: "Cliente desde 2024",
  },
];

function Testimonials() {
  return (
    <section className="block" id="depoimentos">
      <div className="container">
        <Reveal className="sec-head">
          <span className="eyebrow">04 — Depoimentos</span>
          <h2>
            Quem senta, <span className="ital">volta</span>.
          </h2>
          <p className="sub">
            A palavra de quem já passou pela cadeira vale mais que qualquer anúncio.
          </p>
        </Reveal>
        <div className="testi-grid">
          {TESTIMONIALS.map((t, i) => (
            <Reveal
              key={t.name}
              className="testi-card glass-card"
              kind={i === 0 ? "left" : i === 1 ? "rise" : "right"}
              delay={i * 110}
            >
              <div className="stars" aria-label="5 de 5 estrelas">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Icons.Star key={s} />
                ))}
              </div>
              <p className="quote">"{t.quote}"</p>
              <div className="who">
                <span className="av">{t.name[0]}</span>
                <span>
                  <span className="nm">{t.name}</span>
                  <br />
                  <span className="since">{t.since}</span>
                </span>
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
          <span className="eyebrow">05 — Localização</span>
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
  teamMembers,
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
      <Hero
        onBook={() => openWizard()}
        serviceCount={initialServices.length}
        barberCount={teamMembers.length}
      />
      <Gallery />
      <Services services={initialServices} onBook={(s) => openWizard(s)} />
      <Team members={teamMembers} />
      <Testimonials />
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
