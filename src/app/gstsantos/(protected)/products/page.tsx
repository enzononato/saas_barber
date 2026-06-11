"use client";

import { useCallback, useEffect, useState } from "react";
import { Package, Pencil, Plus, Trash2, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: string;
  costPrice: string;
  stockQuantity: number;
  isActive: boolean;
}

const fmtPrice = (p: string) => `R$ ${parseFloat(p).toFixed(2).replace(".", ",")}`;

interface FormState {
  name: string;
  price: string;
  costPrice: string;
  stockQuantity: string;
}

const EMPTY_FORM: FormState = { name: "", price: "", costPrice: "", stockQuantity: "0" };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/gstsantos/products?all=1");
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchProducts();
    void (async () => {
      const res = await fetch("/api/gstsantos/me");
      if (res.ok) {
        const me = await res.json();
        setIsOwner(me.role === "owner");
      }
    })();
  }, [fetchProducts]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      price: parseFloat(p.price).toFixed(2),
      costPrice: parseFloat(p.costPrice).toFixed(2),
      stockQuantity: String(p.stockQuantity),
    });
    setError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    const price = parseFloat(form.price.replace(",", "."));
    const costPrice = parseFloat(form.costPrice.replace(",", ".") || "0");
    const stockQuantity = parseInt(form.stockQuantity || "0", 10);

    if (!form.name.trim()) { setError("Informe o nome do produto."); return; }
    if (isNaN(price) || price < 0) { setError("Preço inválido."); return; }
    if (isNaN(stockQuantity) || stockQuantity < 0) { setError("Estoque inválido."); return; }

    setSaving(true);
    setError(null);

    const payload = { name: form.name.trim(), price, costPrice: isNaN(costPrice) ? 0 : costPrice, stockQuantity };
    const res = editing
      ? await fetch(`/api/gstsantos/products/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/gstsantos/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (res.ok) {
      setModalOpen(false);
      void fetchProducts();
    } else {
      setError("Erro ao salvar. Tente novamente.");
    }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/gstsantos/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    void fetchProducts();
  }

  async function handleDelete(p: Product) {
    if (!confirm(`Remover "${p.name}"?`)) return;
    await fetch(`/api/gstsantos/products/${p.id}`, { method: "DELETE" });
    void fetchProducts();
  }

  if (!isOwner) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#8A847A" }}>
        Acesso restrito ao dono da barbearia.
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
          Produtos
        </h1>
        <button
          onClick={openCreate}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 18px",
            background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
            color: "#1A1408",
            fontWeight: 700,
            fontSize: 13,
            border: "none",
            borderRadius: 999,
            cursor: "pointer",
            transition: "transform 0.15s",
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Novo produto
        </button>
      </div>

      {loading ? (
        <p style={{ color: "#8A847A" }}>Carregando...</p>
      ) : products.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#8A847A",
            border: "1px dashed #2A2620",
            borderRadius: 12,
          }}
        >
          <Package size={36} strokeWidth={1.2} style={{ opacity: 0.5, marginBottom: 12 }} />
          <p style={{ margin: 0 }}>Nenhum produto cadastrado.</p>
          <p style={{ margin: "6px 0 0", fontSize: 12 }}>
            Cadastre pomadas, shampoos e outros itens para vender no fechamento.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {products.map((p) => {
            const margin =
              parseFloat(p.price) > 0
                ? Math.round(
                    ((parseFloat(p.price) - parseFloat(p.costPrice)) / parseFloat(p.price)) * 100,
                  )
                : 0;
            return (
              <div
                key={p.id}
                style={{
                  background: "#131211",
                  border: "1px solid #2A2620",
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  opacity: p.isActive ? 1 : 0.55,
                }}
              >
                <div style={{ flex: 1, minWidth: 160 }}>
                  <p style={{ margin: "0 0 2px", fontWeight: 600, color: "#F4EEDF", fontSize: 14 }}>
                    {p.name}
                  </p>
                  <p style={{ margin: 0, color: "#8A847A", fontSize: 12 }}>
                    Custo {fmtPrice(p.costPrice)} · Margem {margin}%
                  </p>
                </div>

                <span
                  style={{
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: p.stockQuantity > 0 ? "rgba(76,175,80,0.12)" : "rgba(229,115,115,0.12)",
                    color: p.stockQuantity > 0 ? "#4CAF50" : "#E57373",
                  }}
                >
                  {p.stockQuantity > 0 ? `${p.stockQuantity} em estoque` : "Sem estoque"}
                </span>

                <span style={{ color: "#C9A84C", fontWeight: 600, fontSize: 15, minWidth: 90, textAlign: "right" }}>
                  {fmtPrice(p.price)}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => toggleActive(p)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      border: "1px solid #2A2620",
                      background: "transparent",
                      color: p.isActive ? "#8A847A" : "#4CAF50",
                      cursor: "pointer",
                    }}
                  >
                    {p.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => openEdit(p)} style={iconBtnStyle("#C9A84C")} aria-label="Editar">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(p)} style={iconBtnStyle("#E57373")} aria-label="Remover">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal create/edit */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#131211",
              border: "1px solid #2A2620",
              borderRadius: 16,
              padding: 24,
              animation: "modalIn 0.25s cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#F4EEDF", margin: 0 }}>
                {editing ? "Editar produto" : "Novo produto"}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                style={{
                  marginLeft: "auto",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "1px solid #2A2620",
                  background: "transparent",
                  color: "#8A847A",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                }}
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>

            <Field label="Nome">
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Pomada modeladora"
                style={inputStyle}
                autoFocus
              />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Preço de venda (R$)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="45,00"
                  style={inputStyle}
                />
              </Field>
              <Field label="Custo (R$)">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.costPrice}
                  onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
                  placeholder="20,00"
                  style={inputStyle}
                />
              </Field>
            </div>

            <Field label="Quantidade em estoque">
              <input
                type="number"
                min={0}
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            {error && (
              <p style={{ color: "#E57373", fontSize: 13, margin: "0 0 14px" }}>{error}</p>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%",
                padding: "12px 24px",
                background: "linear-gradient(180deg,#E0BE5C,#C9A84C 48%,#8E6A24)",
                color: "#1A1408",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                borderRadius: 999,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar produto"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: "#8A847A",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#0B0B0B",
  border: "1px solid #2A2620",
  borderRadius: 8,
  color: "#F4EEDF",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

function iconBtnStyle(color: string): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    border: `1px solid ${color}44`,
    background: color + "18",
    color,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
  };
}
