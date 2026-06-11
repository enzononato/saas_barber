"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  QrCode,
  Wallet,
  X,
} from "lucide-react";
import type { Appointment } from "../page";

interface Product {
  id: string;
  name: string;
  price: string;
  stockQuantity: number;
}

export interface CheckoutPayload {
  paymentMethod: "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  tipAmount: number;
  products: { productId: string; quantity: number }[];
}

interface Props {
  appointment: Appointment;
  onConfirm: (payload: CheckoutPayload) => Promise<void>;
  onClose: () => void;
}

const PAYMENT_OPTIONS = [
  { key: "CASH" as const, label: "Dinheiro", icon: Banknote },
  { key: "PIX" as const, label: "PIX", icon: QrCode },
  { key: "CREDIT_CARD" as const, label: "Crédito", icon: CreditCard },
  { key: "DEBIT_CARD" as const, label: "Débito", icon: Wallet },
];

const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

export function CheckoutModal({ appointment, onConfirm, onClose }: Props) {
  const [method, setMethod] = useState<CheckoutPayload["paymentMethod"] | null>(null);
  const [tip, setTip] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/gstsantos/products");
      if (res.ok) setProducts(await res.json());
    })();
  }, []);

  const tipValue = useMemo(() => {
    const v = parseFloat(tip.replace(",", "."));
    return isNaN(v) || v < 0 ? 0 : v;
  }, [tip]);

  const productsTotal = useMemo(
    () =>
      Object.entries(cart).reduce((sum, [id, qty]) => {
        const p = products.find((x) => x.id === id);
        return sum + (p ? parseFloat(p.price) * qty : 0);
      }, 0),
    [cart, products],
  );

  const serviceTotal = parseFloat(appointment.priceAtBooking);
  const grandTotal = serviceTotal + productsTotal + tipValue;

  function addToCart(id: string, delta: number) {
    setCart((c) => {
      const next = { ...c };
      const qty = (next[id] ?? 0) + delta;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  async function handleConfirm() {
    if (!method || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm({
        paymentMethod: method,
        tipAmount: tipValue,
        products: Object.entries(cart).map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 110,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        animation: "fadeIn 0.2s ease",
      }}
      className="gst-checkout-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "#131211",
          border: "1px solid #2A2620",
          borderRadius: "20px 20px 0 0",
          padding: "22px 22px calc(22px + env(safe-area-inset-bottom))",
          animation: "sheetIn 0.3s cubic-bezier(.2,.7,.2,1)",
        }}
        className="gst-checkout-sheet"
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#C9A84C",
                fontWeight: 700,
              }}
            >
              Fechamento
            </p>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F4EEDF", margin: "4px 0 2px" }}>
              {appointment.customerName}
            </h2>
            <p style={{ margin: 0, color: "#8A847A", fontSize: 12 }}>
              {appointment.serviceNameAtBooking} · {fmt(serviceTotal)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto",
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: "1px solid #2A2620",
              background: "transparent",
              color: "#8A847A",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Payment method */}
        <p style={sectionLabel}>Forma de pagamento</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
            marginBottom: 18,
          }}
        >
          {PAYMENT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const sel = method === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setMethod(opt.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "13px 14px",
                  minHeight: 48,
                  borderRadius: 12,
                  border: sel ? "1px solid #C9A84C" : "1px solid #2A2620",
                  background: sel
                    ? "linear-gradient(180deg, rgba(201,168,76,0.14), rgba(201,168,76,0.04))"
                    : "#0B0B0B",
                  color: sel ? "#C9A84C" : "#C8C2B4",
                  fontWeight: sel ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.18s",
                }}
              >
                <Icon size={17} strokeWidth={sel ? 2.2 : 1.7} />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Tip */}
        <p style={sectionLabel}>Gorjeta / caixinha (opcional)</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <input
            type="text"
            inputMode="decimal"
            value={tip}
            onChange={(e) => setTip(e.target.value)}
            placeholder="0,00"
            style={{
              flex: 1,
              padding: "11px 14px",
              background: "#0B0B0B",
              border: "1px solid #2A2620",
              borderRadius: 10,
              color: "#F4EEDF",
              fontSize: 14,
              outline: "none",
            }}
          />
          {[5, 10, 20].map((v) => (
            <button
              key={v}
              onClick={() => setTip(String(v))}
              style={{
                padding: "0 14px",
                minWidth: 48,
                borderRadius: 10,
                border: "1px solid #2A2620",
                background: tip === String(v) ? "rgba(201,168,76,0.12)" : "transparent",
                color: tip === String(v) ? "#C9A84C" : "#8A847A",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Products */}
        {products.length > 0 && (
          <>
            <p style={sectionLabel}>Adicionar produtos</p>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                marginBottom: 18,
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {products.map((p) => {
                const qty = cart[p.id] ?? 0;
                const out = p.stockQuantity <= 0;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      borderRadius: 10,
                      border: qty > 0 ? "1px solid rgba(201,168,76,0.4)" : "1px solid #2A2620",
                      background: qty > 0 ? "rgba(201,168,76,0.05)" : "transparent",
                      opacity: out ? 0.45 : 1,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, color: "#F4EEDF", fontWeight: 500 }}>
                        {p.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#8A847A" }}>
                        {fmt(parseFloat(p.price))}
                        {out && " · sem estoque"}
                      </p>
                    </div>
                    {qty > 0 && (
                      <>
                        <button onClick={() => addToCart(p.id, -1)} style={qtyBtn} aria-label="Remover um">
                          <Minus size={13} />
                        </button>
                        <span style={{ color: "#C9A84C", fontWeight: 700, fontSize: 14, minWidth: 18, textAlign: "center" }}>
                          {qty}
                        </span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(p.id, 1)}
                      disabled={out}
                      style={{ ...qtyBtn, cursor: out ? "not-allowed" : "pointer" }}
                      aria-label="Adicionar um"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Summary */}
        <div
          style={{
            borderTop: "1px dashed #2A2620",
            paddingTop: 14,
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <SummaryRow label="Serviço" value={fmt(serviceTotal)} />
          {productsTotal > 0 && <SummaryRow label="Produtos" value={fmt(productsTotal)} />}
          {tipValue > 0 && <SummaryRow label="Gorjeta" value={fmt(tipValue)} />}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "#F4EEDF", fontWeight: 700, fontSize: 15 }}>Total</span>
            <span style={{ color: "#C9A84C", fontWeight: 800, fontSize: 18 }}>
              {fmt(grandTotal)}
            </span>
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!method || submitting}
          style={{
            width: "100%",
            padding: "14px 24px",
            minHeight: 48,
            background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
            color: "#1A1408",
            fontWeight: 700,
            fontSize: 15,
            border: "none",
            borderRadius: 999,
            cursor: !method || submitting ? "not-allowed" : "pointer",
            opacity: !method || submitting ? 0.45 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {submitting ? "Concluindo..." : "Concluir atendimento"}
        </button>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes sheetIn { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
          @media (min-width: 640px) {
            .gst-checkout-overlay { align-items: center !important; padding: 20px; }
            .gst-checkout-sheet { border-radius: 20px !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "#8A847A", fontSize: 13 }}>{label}</span>
      <span style={{ color: "#C8C2B4", fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#8A847A",
  fontWeight: 600,
};

const qtyBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: "50%",
  border: "1px solid rgba(201,168,76,0.4)",
  background: "rgba(201,168,76,0.1)",
  color: "#C9A84C",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
