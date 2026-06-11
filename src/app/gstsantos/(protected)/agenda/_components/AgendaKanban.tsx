"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StickyNote } from "lucide-react";
import type { Appointment } from "../page";

type Status = Appointment["status"];

const COLUMNS: { key: Status; label: string; color: string }[] = [
  { key: "SCHEDULED", label: "Agendado", color: "#C9A84C" },
  { key: "COMPLETED", label: "Concluído", color: "#4CAF50" },
  { key: "CANCELED", label: "Cancelado", color: "#E57373" },
  { key: "NO_SHOW", label: "Não compareceu", color: "#8A847A" },
];

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function KanbanCard({ apt, isDragging }: { apt: Appointment; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: apt.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    background: "linear-gradient(165deg, #14120E, #0B0A08)",
    border: "1px solid #2A2620",
    borderRadius: 12,
    padding: "12px 14px",
    cursor: "grab",
    userSelect: "none",
  };

  return (
    <div ref={setNodeRef} style={style} className="kb-card" {...attributes} {...listeners}>
      <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#F4EEDF", fontSize: 13 }}>
        {apt.customerName}
      </p>
      <p style={{ margin: "0 0 4px", color: "#C8C2B4", fontSize: 12 }}>
        {apt.serviceNameAtBooking}
      </p>
      <p style={{ margin: 0, color: "#8A847A", fontSize: 11 }}>
        {fmtTime(apt.startsAt)} · {apt.professionalName}
      </p>
      {apt.notes && (
        <p
          title={apt.notes}
          style={{
            margin: "6px 0 0",
            color: "#8A847A",
            fontSize: 10,
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
          }}
        >
          <StickyNote size={10} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
          {apt.notes}
        </p>
      )}
    </div>
  );
}

interface Props {
  appointments: Appointment[];
  onStatusChange: (id: string, status: string) => Promise<boolean>;
}

export function AgendaKanban({ appointments: initial, onStatusChange }: Props) {
  const [items, setItems] = useState<Appointment[]>(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Sync local state when parent refetches
  useEffect(() => { setItems(initial); }, [initial]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragStart({ active }: DragStartEvent) {
    setDraggingId(String(active.id));
  }

  async function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null);
    if (!over) return;

    const aptId = String(active.id);
    const newStatus = String(over.id) as Status;

    if (!COLUMNS.find((c) => c.key === newStatus)) return;

    const apt = items.find((a) => a.id === aptId);
    if (!apt || apt.status === newStatus) return;

    const previousStatus = apt.status;
    // Optimistic update
    setItems((prev) =>
      prev.map((a) => (a.id === aptId ? { ...a, status: newStatus } : a)),
    );

    const ok = await onStatusChange(aptId, newStatus);
    if (!ok) {
      // Revert on failure
      setItems((prev) =>
        prev.map((a) => (a.id === aptId ? { ...a, status: previousStatus } : a)),
      );
    }
  }

  const draggingApt = draggingId ? items.find((a) => a.id === draggingId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {COLUMNS.map((col) => {
          const colItems = items.filter((a) => a.status === col.key);
          return (
            <div
              key={col.key}
              style={{
                background: "linear-gradient(180deg, rgba(244,238,223,0.03), rgba(244,238,223,0.006))",
                border: "1px solid #2A2620",
                borderTop: `2px solid ${col.color}66`,
                borderRadius: 14,
                padding: 12,
                minHeight: 200,
                transition: "border-color .25s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: col.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: 13, color: "#C8C2B4" }}>
                  {col.label}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    background: col.color + "22",
                    color: col.color,
                    borderRadius: 999,
                    padding: "1px 8px",
                    fontSize: 11,
                  }}
                >
                  {colItems.length}
                </span>
              </div>

              <SortableContext
                id={col.key}
                items={colItems.map((a) => a.id)}
                strategy={verticalListSortingStrategy}
              >
                {/* Droppable area — use col.key as droppable id via data-drop-id */}
                <div
                  id={col.key}
                  style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 40 }}
                >
                  {colItems.map((apt) => (
                    <KanbanCard key={apt.id} apt={apt} isDragging={apt.id === draggingId} />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {draggingApt ? (
          <div
            style={{
              background: "linear-gradient(165deg, #1A1710, #0E0C08)",
              border: "1px solid rgba(201,168,76,0.55)",
              borderRadius: 12,
              padding: "12px 14px",
              boxShadow:
                "0 16px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.2), 0 0 28px -8px rgba(201,168,76,0.45)",
              cursor: "grabbing",
              transform: "rotate(2deg) scale(1.04)",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "#F4EEDF", fontSize: 13 }}>
              {draggingApt.customerName}
            </p>
            <p style={{ margin: 0, color: "#8A847A", fontSize: 11, marginTop: 4 }}>
              {draggingApt.serviceNameAtBooking}
            </p>
          </div>
        ) : null}
      </DragOverlay>

      <style>{`
        .kb-card { transition: border-color .2s, box-shadow .2s, transform .2s; }
        .kb-card:hover {
          border-color: rgba(201,168,76,0.4) !important;
          box-shadow: 0 8px 20px -10px rgba(0,0,0,0.6);
        }
        .kb-card:active { cursor: grabbing; }
      `}</style>
    </DndContext>
  );
}
