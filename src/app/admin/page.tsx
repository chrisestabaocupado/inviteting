"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ticket,
  CalendarDays,
  Building2,
  Inbox,
  Users,
  Check,
  X,
  Download,
  Undo2,
  RotateCcw,
  Send,
  Save,
  Plus,
  Landmark,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PinGate } from "@/components/pin-gate";
import { InvitacionPdfDocument } from "@/components/invitacion-pdf";
import { pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";

/* ---------- Types ---------- */
interface Evento {
  id: string;
  nombre: string;
  fecha: string;
  hora: string;
  lugar: string;
  descripcion: string;
  inscripciones_abiertas: boolean;
}

interface Ente {
  id: string;
  nombre: string;
  cupo_maximo: number;
}

interface Solicitud {
  id: string;
  nombre: string;
  apellido: string;
  cargo: string;
  email: string;
  telefono: string;
  ente_id: string;
  estado_solicitud: "pendiente" | "aprobada" | "rechazada" | "revocada";
  estado_invitacion: "no_enviada" | "enviada";
  token_qr: string | null;
}

type Tab = "evento" | "entes" | "solicitudes" | "invitados";

const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "evento", label: "Evento", icon: <CalendarDays size={22} /> },
  { key: "entes", label: "Entes", icon: <Building2 size={22} /> },
  { key: "solicitudes", label: "Solicitudes", icon: <Inbox size={22} /> },
  { key: "invitados", label: "Invitados", icon: <Users size={22} /> },
];

const estadosFiltro: ("todas" | Solicitud["estado_solicitud"])[] = [
  "todas",
  "pendiente",
  "aprobada",
  "rechazada",
  "revocada",
];

/* ---------- Helpers ---------- */
function initials(nombre: string, apellido: string) {
  return `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase();
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function badgeClasses(estado: string) {
  switch (estado) {
    case "pendiente":
      return "bg-[#fffbeb] text-[#d97706]";
    case "aprobada":
      return "bg-[#f0fdf4] text-[#16a34a]";
    case "rechazada":
      return "bg-[#fef2f2] text-[#dc2626]";
    case "revocada":
      return "bg-[#f4f4f5] text-[#71717a]";
    default:
      return "bg-[#eff6ff] text-[#2563eb]";
  }
}

function estadoLabel(e: string) {
  return e.charAt(0).toUpperCase() + e.slice(1);
}

/* ---------- Page ---------- */
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("solicitudes");

  const [evento, setEvento] = useState<Evento | null>({
    id: "",
    nombre: "",
    fecha: "",
    hora: "",
    lugar: "",
    descripcion: "",
    inscripciones_abiertas: false,
  });
  const [entes, setEntes] = useState<Ente[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [filter, setFilter] = useState<"todas" | Solicitud["estado_solicitud"]>("todas");
  const [loading, setLoading] = useState(false);
  const [savingEvento, setSavingEvento] = useState(false);
  const [creatingEnte, setCreatingEnte] = useState(false);
  const [newEnteName, setNewEnteName] = useState("");
  const [newEnteCupo, setNewEnteCupo] = useState(5);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revealedPins, setRevealedPins] = useState<Record<string, string>>({});

  // Check session
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.data?.admin) setAuthed(true);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  // Load data when authed or tab changes
  useEffect(() => {
    if (!authed) return;
    loadEvento();
    if (tab === "entes") loadEntes();
    if (tab === "solicitudes" || tab === "invitados") loadSolicitudes();
  }, [authed, tab]);

  async function loadEvento() {
    setLoading(true);
    const res = await fetch("/api/admin/evento");
    const d = await res.json();
    if (d.ok) setEvento(d.data);
    setLoading(false);
  }

  async function loadEntes() {
    setLoading(true);
    const res = await fetch("/api/admin/entes");
    const d = await res.json();
    if (d.ok) setEntes(d.data);
    setLoading(false);
  }

  async function loadSolicitudes() {
    setLoading(true);
    const url = filter === "todas" ? "/api/admin/solicitudes" : `/api/admin/solicitudes?estado=${filter}`;
    const res = await fetch(url);
    const d = await res.json();
    if (d.ok) setSolicitudes(d.data);
    setLoading(false);
  }

  useEffect(() => {
    if (authed && (tab === "solicitudes" || tab === "invitados")) loadSolicitudes();
  }, [filter]);

  async function saveEvento() {
    if (!evento) return;
    setSavingEvento(true);
    const res = await fetch("/api/admin/evento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    });
    const d = await res.json();
    setSavingEvento(false);
    if (d.ok) {
      toast.success("Cambios guardados");
    } else {
      toast.error(d.error || "Error al guardar");
    }
  }

  async function toggleInscripciones(v: boolean) {
    if (!evento) return;
    const next = { ...evento, inscripciones_abiertas: v };
    setEvento(next);
    const res = await fetch("/api/admin/evento", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const d = await res.json();
    if (d.ok) {
      toast.success(v ? "Inscripciones abiertas" : "Inscripciones cerradas");
    } else {
      toast.error(d.error || "Error al actualizar");
      setEvento(evento);
    }
  }

  async function createEnte() {
    if (!newEnteName.trim()) return;
    setCreatingEnte(true);
    const res = await fetch("/api/admin/entes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newEnteName.trim(), cupo_maximo: newEnteCupo }),
    });
    const d = await res.json();
    setCreatingEnte(false);
    if (d.ok) {
      toast.success(`Ente creado. PIN: ${d.data.pin}`);
      setRevealedPins((p) => ({ ...p, [d.data.id]: d.data.pin }));
      copyPin(d.data.pin);
      setNewEnteName("");
      setNewEnteCupo(5);
      setDialogOpen(false);
      loadEntes();
    } else {
      toast.error(d.error || "Error al crear ente");
    }
  }

  async function deleteEnte(id: string) {
    if (!confirm("¿Eliminar este ente?")) return;
    const res = await fetch(`/api/admin/entes/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (d.ok) {
      toast.success("Ente eliminado");
      loadEntes();
    } else {
      toast.error(d.error || "Error al eliminar");
    }
  }

  async function regeneratePin(id: string) {
    const res = await fetch(`/api/admin/entes/${id}/regenerar-pin`, { method: "POST" });
    const d = await res.json();
    if (d.ok) {
      toast.success(`PIN regenerado: ${d.data.pin}`);
      setRevealedPins((p) => ({ ...p, [id]: d.data.pin }));
      copyPin(d.data.pin);
      loadEntes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function revealPin(id: string) {
    const res = await fetch(`/api/admin/entes/${id}/pin`);
    const d = await res.json();
    if (d.ok) {
      setRevealedPins((p) => ({ ...p, [id]: d.data.pin }));
      return d.data.pin as string;
    }
    toast.error(d.error || "No se pudo revelar el PIN");
    return null;
  }

  async function copyPin(pin: string) {
    try {
      await navigator.clipboard.writeText(pin);
      toast.success("PIN copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function approve(id: string) {
    const res = await fetch(`/api/admin/solicitudes/${id}/aprobar`, { method: "POST" });
    const d = await res.json();
    if (d.ok) {
      toast.success("Solicitud aprobada · token QR generado");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function reject(id: string) {
    const res = await fetch(`/api/admin/solicitudes/${id}/rechazar`, { method: "POST" });
    const d = await res.json();
    if (d.ok) {
      toast.success("Solicitud rechazada");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/admin/solicitudes/${id}/revocar`, { method: "POST" });
    const d = await res.json();
    if (d.ok) {
      toast.success("Invitación revocada");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function downloadInvitacion(id: string) {
    const res = await fetch(`/api/admin/invitacion/${id}`);
    const d = await res.json();
    if (!d.ok) {
      toast.error(d.error || "Error");
      return;
    }
    const { invitado, ente, evento } = d.data;
    if (!invitado?.token_qr || !evento) {
      toast.error("Faltan datos para generar PDF");
      return;
    }
    const qrDataUrl = await QRCode.toDataURL(invitado.token_qr, { width: 400, margin: 2 });
    const blob = await pdf(
      <InvitacionPdfDocument
        evento={evento}
        invitado={invitado}
        enteNombre={ente?.nombre ?? "—"}
        qrDataUrl={qrDataUrl}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invitacion-${invitado.nombre}-${invitado.apellido}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Invitación descargada");
  }

  async function markSent(id: string) {
    const res = await fetch(`/api/admin/solicitudes/${id}/marcar-enviada`, { method: "POST" });
    const d = await res.json();
    if (d.ok) {
      toast.success("Marcada como enviada");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthed(false);
    toast.success("Sesión cerrada");
  }

  const counts = useMemo(() => {
    return {
      todas: solicitudes.length,
      pendiente: solicitudes.filter((s) => s.estado_solicitud === "pendiente").length,
      aprobada: solicitudes.filter((s) => s.estado_solicitud === "aprobada").length,
      rechazada: solicitudes.filter((s) => s.estado_solicitud === "rechazada").length,
    };
  }, [solicitudes]);

  const filtered = useMemo(() => {
    if (tab === "invitados") return solicitudes.filter((s) => s.estado_solicitud === "aprobada" || s.estado_solicitud === "revocada");
    if (filter === "todas") return solicitudes;
    return solicitudes.filter((s) => s.estado_solicitud === filter);
  }, [solicitudes, filter, tab]);

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#4338ca]" />
      </div>
    );
  }

  if (!authed) {
    return <PinGate onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-4xl bg-[#f5f5f6] pb-[calc(5.25rem+env(safe-area-inset-bottom))]">
      {/* App bar */}
      <div className="sticky top-0 z-30 border-b border-[#e5e5e8] bg-white px-4 py-[12px_10px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-[10px]">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#4338ca] text-white">
              <Ticket size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-bold tracking-tight">inviteting</div>
              <div className="truncate text-xs text-[#71717a]">{evento?.nombre ?? "—"}</div>
            </div>
          </div>
          <Switch
            checked={evento?.inscripciones_abiertas ?? false}
            onCheckedChange={toggleInscripciones}
          />
        </div>
        <div className="mt-[9px] flex items-center gap-[6px] text-xs font-semibold">
          <span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: evento?.inscripciones_abiertas ? "#16a34a" : "#71717a" }}
          />
          <span>{evento?.inscripciones_abiertas ? "Inscripciones abiertas" : "Inscripciones cerradas"}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-[14px] sm:px-6">
        {/* ====== EVENTO ====== */}
        {tab === "evento" && (
          <div className="mx-auto max-w-2xl">
            <h2 className="mt-[6px] text-[19px] font-bold tracking-tight">Datos del evento</h2>
            <p className="mb-[14px] text-[13px] text-[#71717a]">El único evento de esta instancia.</p>
            <div className="mb-3 rounded-[14px] border border-[#e5e5e8] bg-white p-[14px]">
              <div className="mb-[13px] flex flex-col gap-[6px]">
                <Label className="text-[13px] font-semibold">Nombre del evento</Label>
                <Input
                  value={evento?.nombre ?? ""}
                  onChange={(e) => setEvento((p) => (p ? { ...p, nombre: e.target.value } : p))}
                  className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                />
              </div>
              <div className="mb-[13px] grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-[6px]">
                  <Label className="text-[13px] font-semibold">Fecha</Label>
                  <Input
                    type="date"
                    value={evento?.fecha ?? ""}
                    onChange={(e) => setEvento((p) => (p ? { ...p, fecha: e.target.value } : p))}
                    className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                  />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <Label className="text-[13px] font-semibold">Hora</Label>
                  <Input
                    type="time"
                    value={evento?.hora ?? ""}
                    onChange={(e) => setEvento((p) => (p ? { ...p, hora: e.target.value } : p))}
                    className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                  />
                </div>
              </div>
              <div className="mb-[13px] flex flex-col gap-[6px]">
                <Label className="text-[13px] font-semibold">Lugar</Label>
                <Input
                  value={evento?.lugar ?? ""}
                  onChange={(e) => setEvento((p) => (p ? { ...p, lugar: e.target.value } : p))}
                  className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                />
              </div>
              <div className="mb-[13px] flex flex-col gap-[6px]">
                <Label className="text-[13px] font-semibold">Descripción</Label>
                <Textarea
                  rows={3}
                  value={evento?.descripcion ?? ""}
                  onChange={(e) => setEvento((p) => (p ? { ...p, descripcion: e.target.value } : p))}
                  className="rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                />
              </div>
              <Button
                onClick={saveEvento}
                disabled={savingEvento}
                className="h-12 w-full rounded-[11px] bg-[#4338ca] text-[15px] font-semibold text-white hover:bg-[#3730a3]"
              >
                {savingEvento ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save size={18} />}
                Guardar cambios
              </Button>
            </div>
          </div>
        )}

        {/* ====== ENTES ====== */}
        {tab === "entes" && (
          <div>
            <h2 className="mt-[6px] text-[19px] font-bold tracking-tight">Entes invitados</h2>
            <p className="mb-[14px] text-[13px] text-[#71717a]">Cada ente tiene su PIN de acceso.</p>
            {loading && <p className="text-sm text-[#71717a]">Cargando…</p>}
            {entes.map((e) => (
              <EnteCard
                key={e.id}
                ente={e}
                pin={revealedPins[e.id]}
                onDelete={() => deleteEnte(e.id)}
                onRegenerate={() => regeneratePin(e.id)}
                onReveal={() => revealPin(e.id)}
                onCopy={(pin) => copyPin(pin)}
              />
            ))}
          </div>
        )}

        {/* ====== SOLICITUDES ====== */}
        {tab === "solicitudes" && (
          <div>
            <h2 className="mt-[6px] text-[19px] font-bold tracking-tight">Solicitudes</h2>
            <p className="mb-[14px] text-[13px] text-[#71717a]">Aprueba o rechaza a los invitados.</p>
            <div className="mb-[14px] flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {estadosFiltro.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`min-h-11 shrink-0 rounded-full px-[14px] py-[7px] text-[13px] font-semibold transition ${
                    filter === f
                      ? "bg-[#18181b] text-white"
                      : "border border-[#e5e5e8] bg-white text-[#71717a]"
                  }`}
                >
                  {estadoLabel(f)} ·{" "}
                  {f === "todas"
                    ? counts.todas
                    : counts[f as keyof typeof counts] ?? 0}
                </button>
              ))}
            </div>
            {loading && <p className="text-sm text-[#71717a]">Cargando…</p>}
            {filtered.map((s) => (
              <SolicitudCard
                key={s.id}
                s={s}
                enteName={entes.find((e) => e.id === s.ente_id)?.nombre ?? "—"}
                onApprove={() => approve(s.id)}
                onReject={() => reject(s.id)}
                onRevoke={() => revoke(s.id)}
                onDownload={() => downloadInvitacion(s.id)}
              />
            ))}
          </div>
        )}

        {/* ====== INVITADOS ====== */}
        {tab === "invitados" && (
          <div>
            <h2 className="mt-[6px] text-[19px] font-bold tracking-tight">Invitados</h2>
            <p className="mb-[14px] text-[13px] text-[#71717a]">Invitaciones aprobadas y su envío.</p>
            {loading && <p className="text-sm text-[#71717a]">Cargando…</p>}
            {filtered.map((s) => (
              <InvitadoCard
                key={s.id}
                s={s}
                enteName={entes.find((e) => e.id === s.ente_id)?.nombre ?? "—"}
                onDownload={() => downloadInvitacion(s.id)}
                onMarkSent={() => markSent(s.id)}
                onReactivate={() => toast("Invitación reactivada")}
              />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {tab === "entes" && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <button
            aria-label="Nuevo ente"
            onClick={() => setDialogOpen(true)}
            className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#4338ca] text-white shadow-[0_6px_18px_rgba(67,56,202,0.35)] active:scale-95 xl:right-[calc((100vw-56rem)/2+1rem)]"
          >
            <Plus size={26} />
          </button>
          <DialogContent className="rounded-[14px] border-[#e5e5e8]">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Nuevo ente</DialogTitle>
              <DialogDescription className="text-sm text-[#71717a]">
                Crea un ente y se generará un PIN de acceso.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-[6px]">
                <Label className="text-[13px] font-semibold">Nombre</Label>
                <Input
                  value={newEnteName}
                  onChange={(e) => setNewEnteName(e.target.value)}
                  placeholder="Ej. Embajada de España"
                  className="h-12 rounded-[10px] border-[#e5e5e8] text-base md:text-[15px]"
                />
              </div>
              <div className="flex flex-col gap-[6px]">
                <Label className="text-[13px] font-semibold">Cupo máximo</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={newEnteCupo}
                  onChange={(e) => setNewEnteCupo(Number(e.target.value))}
                  className="h-12 rounded-[10px] border-[#e5e5e8] text-base md:text-[15px]"
                />
              </div>
              <Button
                onClick={createEnte}
                disabled={creatingEnte || !newEnteName.trim()}
                className="h-12 w-full rounded-[11px] bg-[#4338ca] text-[15px] font-semibold text-white hover:bg-[#3730a3]"
              >
                {creatingEnte ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Crear ente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] w-full max-w-4xl -translate-x-1/2 border-t border-[#e5e5e8] bg-white pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-[3px] text-[10.5px] font-semibold ${
              tab === t.key ? "text-[#4338ca]" : "text-[#71717a]"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function EnteCard({
  ente,
  pin,
  onDelete,
  onRegenerate,
  onReveal,
  onCopy,
}: {
  ente: Ente;
  pin?: string;
  onDelete: () => void;
  onRegenerate: () => void;
  onReveal: () => Promise<string | null>;
  onCopy: (pin: string) => void;
}) {
  const [showPin, setShowPin] = useState(false);
  const [revealing, setRevealing] = useState(false);
  // We don't have real count or used count from admin/entes endpoint; just show cupo_maximo
  const used = 0; // placeholder
  const pct = Math.min(100, (used / (ente.cupo_maximo || 1)) * 100);

  return (
    <div className="mb-3 rounded-[14px] border border-[#e5e5e8] bg-white p-[14px]">
      <div className="flex items-center gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#f4f4f5] text-[#18181b]">
          <Landmark size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold [overflow-wrap:anywhere]">{ente.nombre}</div>
          <div className="mt-[1px] text-xs text-[#71717a]">
            {used} de {ente.cupo_maximo} cupos usados
          </div>
        </div>
        <button
          aria-label={`Eliminar ${ente.nombre}`}
          onClick={onDelete}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#fef2f2] text-[#dc2626] active:bg-[#fee2e2]"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div className="mt-3 h-[6px] overflow-hidden rounded-full bg-[#f4f4f5]">
        <div
          className="h-full rounded-full bg-[#4338ca]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-lg bg-[#f4f4f5] px-3 py-[7px] font-mono text-sm font-bold tracking-widest">
          {showPin && pin ? pin : "••••••"}
        </span>
        <button
          aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
          onClick={async () => {
            if (!pin) {
              setRevealing(true);
              const p = await onReveal();
              setRevealing(false);
              if (p) setShowPin(true);
            } else {
              setShowPin((v) => !v);
            }
          }}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#f4f4f5] text-[#71717a] active:bg-[#e4e4e7]"
        >
          {revealing ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : showPin ? (
            <EyeOff size={18} />
          ) : (
            <Eye size={18} />
          )}
        </button>
        <button
          aria-label="Copiar PIN"
          onClick={async () => {
            const p = pin ?? (await onReveal());
            if (p) onCopy(p);
          }}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#f4f4f5] text-[#71717a] active:bg-[#e4e4e7]"
        >
          <Copy size={18} />
        </button>
        <button
          aria-label="Regenerar PIN"
          onClick={onRegenerate}
          className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#f4f4f5] text-[#71717a] active:bg-[#e4e4e7]"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </div>
  );
}

function SolicitudCard({
  s,
  enteName,
  onApprove,
  onReject,
  onRevoke,
  onDownload,
}: {
  s: Solicitud;
  enteName: string;
  onApprove: () => void;
  onReject: () => void;
  onRevoke: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="mb-3 rounded-[14px] border border-[#e5e5e8] bg-white p-[14px]">
      <div className="flex items-start gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#eef2ff] text-[15px] font-bold text-[#4338ca]">
          {initials(s.nombre, s.apellido)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold [overflow-wrap:anywhere]">
            {s.nombre} {s.apellido}
          </div>
          <div className="mt-[1px] break-all text-xs text-[#71717a]">{s.email}</div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-bold ${badgeClasses(
            s.estado_solicitud
          )}`}
        >
          <span className="h-[6px] w-[6px] rounded-full bg-current" />
          {estadoLabel(s.estado_solicitud)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 break-words rounded-[10px] border border-[#e5e5e8] bg-[#f4f4f5] px-[13px] py-[9px] text-[13px] font-medium text-[#71717a] [overflow-wrap:anywhere]">
        <Landmark size={15} className="shrink-0 text-[#a1a1aa]" />
        {enteName}
      </div>
      <div className="mt-3 flex gap-2">
        {s.estado_solicitud === "pendiente" && (
          <>
            <button
              onClick={onApprove}
              className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] bg-[#16a34a] px-3 py-[11px] text-sm font-semibold text-white active:bg-[#15803d]"
            >
              <Check size={18} /> Aprobar
            </button>
            <button
              onClick={onReject}
              className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#fecaca] bg-white px-3 py-[11px] text-sm font-semibold text-[#dc2626] active:bg-[#fef2f2]"
            >
              <X size={18} /> Rechazar
            </button>
          </>
        )}
        {s.estado_solicitud === "aprobada" && (
          <>
            <button
              onClick={onDownload}
              className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] bg-[#f4f4f5] px-3 py-[11px] text-sm font-semibold text-[#18181b] active:bg-[#e4e4e7]"
            >
              <Download size={18} /> Descargar
            </button>
            <button
              onClick={onRevoke}
              className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] border border-[#fecaca] bg-white px-3 py-[11px] text-sm font-semibold text-[#dc2626] active:bg-[#fef2f2]"
            >
              <Undo2 size={18} /> Revocar
            </button>
          </>
        )}
        {s.estado_solicitud === "rechazada" && (
          <div className="text-sm text-[#71717a]">Solicitud rechazada</div>
        )}
        {s.estado_solicitud === "revocada" && (
          <div className="text-sm text-[#71717a]">Invitación revocada</div>
        )}
      </div>
    </div>
  );
}

function InvitadoCard({
  s,
  enteName,
  onDownload,
  onMarkSent,
  onReactivate,
}: {
  s: Solicitud;
  enteName: string;
  onDownload: () => void;
  onMarkSent: () => void;
  onReactivate: () => void;
}) {
  return (
    <div className="mb-3 rounded-[14px] border border-[#e5e5e8] bg-white p-[14px]">
      <div className="flex items-start gap-3">
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#eef2ff] text-[15px] font-bold text-[#4338ca]">
          {initials(s.nombre, s.apellido)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold [overflow-wrap:anywhere]">
            {s.nombre} {s.apellido}
          </div>
          <div className="mt-[1px] break-words text-xs text-[#71717a] [overflow-wrap:anywhere]">{s.cargo}</div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-[5px] rounded-full px-[10px] py-[4px] text-[11.5px] font-bold ${badgeClasses(
            s.estado_solicitud
          )}`}
        >
          <span className="h-[6px] w-[6px] rounded-full bg-current" />
          {estadoLabel(s.estado_solicitud)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 break-words rounded-[10px] border border-[#e5e5e8] bg-[#f4f4f5] px-[13px] py-[9px] text-[13px] font-medium text-[#71717a] [overflow-wrap:anywhere]">
        <Landmark size={15} className="shrink-0 text-[#a1a1aa]" />
        {enteName}
      </div>
      <div className="mt-3 flex gap-2">
        {s.estado_solicitud === "aprobada" && (
          <>
            <button
              onClick={onDownload}
              className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] bg-[#f4f4f5] px-3 py-[11px] text-sm font-semibold text-[#18181b] active:bg-[#e4e4e7]"
            >
              <Download size={18} /> Descargar
            </button>
            <button
              onClick={onMarkSent}
              className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] bg-[#f4f4f5] px-3 py-[11px] text-sm font-semibold text-[#18181b] active:bg-[#e4e4e7]"
            >
              <Send size={18} /> Marcar enviada
            </button>
          </>
        )}
        {s.estado_solicitud === "revocada" && (
          <button
            onClick={onReactivate}
            className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-[10px] bg-[#f4f4f5] px-3 py-[11px] text-sm font-semibold text-[#18181b] active:bg-[#e4e4e7]"
          >
            <RotateCcw size={18} /> Reactivar
          </button>
        )}
      </div>
    </div>
  );
}
