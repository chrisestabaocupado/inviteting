"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
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
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const emptyEvento: Evento = {
  id: "",
  nombre: "",
  fecha: "",
  hora: "",
  lugar: "",
  descripcion: "",
  inscripciones_abiertas: false,
};

interface Ente {
  id: string;
  nombre: string;
  cupo_maximo: number;
  cupos_usados: number;
}

interface Solicitud {
  id: string;
  nombre: string;
  cargo: string;
  email: string;
  telefono: string;
  ente_id: string;
  estado_solicitud: "pendiente" | "aprobada" | "rechazada" | "revocada";
  estado_invitacion: "no_enviada" | "enviada";
  token_qr: string | null;
  ente_nombre: string | null;
  escaneado_en: string | null;
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
function initials(nombre: string) {
  const partes = nombre.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ""}${partes.at(-1)?.[0] ?? ""}`.toUpperCase();
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

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleString("es-VE", { dateStyle: "short", timeStyle: "short" });
}

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: Solicitud[]) {
  const header = [
    "nombre",
    "cargo",
    "email",
    "telefono",
    "ente",
    "estado",
    "escaneado",
  ];
  const lines = rows.map((s) =>
    [
      s.nombre,
      s.cargo,
      s.email,
      s.telefono,
      s.ente_nombre ?? "",
      s.estado_solicitud,
      formatDateTime(s.escaneado_en),
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.map(csvCell).join(","), ...lines].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function withEvento(eventoId: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-evento-id", eventoId);
  return { ...init, headers };
}

/* ---------- Page ---------- */
export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>("solicitudes");

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [entes, setEntes] = useState<Ente[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [filter, setFilter] = useState<"todas" | Solicitud["estado_solicitud"]>("todas");
  const [loading, setLoading] = useState(false);
  const [savingEvento, setSavingEvento] = useState(false);
  const [creatingEnte, setCreatingEnte] = useState(false);
  const [newEnteName, setNewEnteName] = useState("");
  const [newEnteCupo, setNewEnteCupo] = useState(5);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingEvento, setDeletingEvento] = useState(false);
  const [revealedPins, setRevealedPins] = useState<Record<string, string>>({});
  const activeEventoId = useRef<string | null>(null);
  const solicitudesRequest = useRef(0);

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

  const loadEventosEffect = useEffectEvent(loadEventos);

  // Load workspaces after authentication.
  useEffect(() => {
    if (!authed) return;
    loadEventosEffect();
  }, [authed]);

  async function loadEventos() {
    setLoading(true);
    const res = await fetch("/api/admin/evento");
    const d = await res.json();
    if (d.ok) {
      const rows = d.data as Evento[];
      const requestedId = new URLSearchParams(window.location.search).get("evento");
      const selected = requestedId
        ? rows.find((item) => item.id === requestedId) ?? null
        : rows[0] ?? null;
      activeEventoId.current = selected?.id ?? null;
      setEventos(rows);
      setEvento(selected ?? emptyEvento);
      if (selected) {
        window.history.replaceState(null, "", `/admin?evento=${selected.id}`);
        await Promise.all([loadEntes(selected.id), loadSolicitudes(selected.id)]);
      } else {
        setTab("evento");
        if (requestedId) toast.error("Evento no encontrado");
      }
    }
    setLoading(false);
  }

  async function loadEntes(eventoId = evento?.id) {
    if (!eventoId) return;
    setLoading(true);
    const res = await fetch("/api/admin/entes", withEvento(eventoId));
    const d = await res.json();
    if (d.ok && activeEventoId.current === eventoId) setEntes(d.data);
    setLoading(false);
  }

  async function loadSolicitudes(eventoId = evento?.id) {
    if (!eventoId) return;
    const requestId = ++solicitudesRequest.current;
    setLoading(true);
    const url = filter === "todas" ? "/api/admin/solicitudes" : `/api/admin/solicitudes?estado=${filter}`;
    const res = await fetch(url, withEvento(eventoId));
    const d = await res.json();
    if (
      d.ok &&
      activeEventoId.current === eventoId &&
      solicitudesRequest.current === requestId
    ) setSolicitudes(d.data);
    setLoading(false);
  }

  const loadWorkspaceEffect = useEffectEvent((eventoId: string) => {
    loadEntes(eventoId);
    if (tab === "solicitudes" || tab === "invitados") loadSolicitudes(eventoId);
  });

  useEffect(() => {
    if (!authed || !evento?.id) return;
    loadWorkspaceEffect(evento.id);
  }, [authed, tab, filter, evento?.id]);

  function selectEvento(id: string) {
    const selected = eventos.find((item) => item.id === id);
    if (!selected) return;
    activeEventoId.current = selected.id;
    setEvento(selected);
    setEntes([]);
    setSolicitudes([]);
    setRevealedPins({});
    window.history.replaceState(null, "", `/admin?evento=${selected.id}`);
  }

  function newEvento() {
    activeEventoId.current = null;
    setEvento(emptyEvento);
    setEntes([]);
    setSolicitudes([]);
    setRevealedPins({});
    setTab("evento");
    window.history.replaceState(null, "", "/admin");
  }

  async function saveEvento() {
    if (!evento) return;
    const requestedId = evento.id || null;
    setSavingEvento(true);
    const res = await fetch("/api/admin/evento", {
      method: evento.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evento),
    });
    const d = await res.json();
    setSavingEvento(false);
    if (activeEventoId.current !== requestedId) return;
    if (d.ok) {
      activeEventoId.current = d.data.id;
      setEvento(d.data);
      setEventos((items) =>
        evento.id
          ? items.map((item) => (item.id === d.data.id ? d.data : item))
          : [...items, d.data]
      );
      window.history.replaceState(null, "", `/admin?evento=${d.data.id}`);
      toast.success("Cambios guardados");
    } else {
      toast.error(d.error || "Error al guardar");
    }
  }

  async function deleteCurrentEvento() {
    if (!evento?.id || deleteConfirmation !== evento.nombre) return;
    setDeletingEvento(true);
    const res = await fetch("/api/admin/evento", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: evento.id, confirmacion: deleteConfirmation }),
    });
    const d = await res.json();
    setDeletingEvento(false);
    if (!d.ok) {
      toast.error(d.error || "No se pudo eliminar el evento");
      return;
    }

    const remaining = eventos.filter((item) => item.id !== evento.id);
    const next = remaining[0] ?? null;
    activeEventoId.current = next?.id ?? null;
    setEventos(remaining);
    setEvento(next ?? emptyEvento);
    setEntes([]);
    setSolicitudes([]);
    setRevealedPins({});
    setDeleteConfirmation("");
    setDeleteDialogOpen(false);
    if (next) {
      window.history.replaceState(null, "", `/admin?evento=${next.id}`);
    } else {
      setTab("evento");
      window.history.replaceState(null, "", "/admin");
    }
    toast.success("Evento y registros asociados eliminados");
  }

  async function createEnte() {
    if (!newEnteName.trim() || !evento?.id) return;
    setCreatingEnte(true);
    const res = await fetch("/api/admin/entes", withEvento(evento.id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: newEnteName.trim(), cupo_maximo: newEnteCupo }),
    }));
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
    if (!evento?.id || !confirm("¿Eliminar este ente?")) return;
    const res = await fetch(`/api/admin/entes/${id}`, withEvento(evento.id, { method: "DELETE" }));
    const d = await res.json();
    if (d.ok) {
      toast.success("Ente eliminado");
      loadEntes();
    } else {
      toast.error(d.error || "Error al eliminar");
    }
  }

  async function regeneratePin(id: string) {
    if (!evento?.id) return;
    const res = await fetch(`/api/admin/entes/${id}/regenerar-pin`, withEvento(evento.id, { method: "POST" }));
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
    if (!evento?.id) return null;
    const res = await fetch(`/api/admin/entes/${id}/pin`, withEvento(evento.id));
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
    if (!evento?.id) return;
    const res = await fetch(`/api/admin/solicitudes/${id}/aprobar`, withEvento(evento.id, { method: "POST" }));
    const d = await res.json();
    if (d.ok) {
      toast.success("Solicitud aprobada · token QR generado");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function reject(id: string) {
    if (!evento?.id) return;
    const res = await fetch(`/api/admin/solicitudes/${id}/rechazar`, withEvento(evento.id, { method: "POST" }));
    const d = await res.json();
    if (d.ok) {
      toast.success("Solicitud rechazada");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function revoke(id: string) {
    if (!evento?.id) return;
    const res = await fetch(`/api/admin/solicitudes/${id}/revocar`, withEvento(evento.id, { method: "POST" }));
    const d = await res.json();
    if (d.ok) {
      toast.success("Invitación revocada");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function downloadInvitacion(id: string) {
    if (!evento?.id) return;
    const res = await fetch(`/api/admin/invitacion/${id}`, withEvento(evento.id));
    const d = await res.json();
    if (!d.ok) {
      toast.error(d.error || "Error");
      return;
    }
    const { invitado, ente, evento: pdfEvento } = d.data;
    if (!invitado?.token_qr || !pdfEvento) {
      toast.error("Faltan datos para generar PDF");
      return;
    }
    const qrDataUrl = await QRCode.toDataURL(invitado.token_qr, { width: 400, margin: 2 });
    const blob = await pdf(
      <InvitacionPdfDocument
        evento={pdfEvento}
        invitado={invitado}
        enteNombre={ente?.nombre ?? "—"}
        qrDataUrl={qrDataUrl}
      />
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invitacion-${invitado.nombre}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Invitación descargada");
  }

  async function markSent(id: string) {
    if (!evento?.id) return;
    const res = await fetch(`/api/admin/solicitudes/${id}/marcar-enviada`, withEvento(evento.id, { method: "POST" }));
    const d = await res.json();
    if (d.ok) {
      toast.success("Marcada como enviada");
      loadSolicitudes();
    } else {
      toast.error(d.error || "Error");
    }
  }

  async function exportCsv() {
    if (!evento?.id) return;
    const res = await fetch("/api/admin/solicitudes", withEvento(evento.id));
    const d = await res.json();
    if (!d.ok) {
      toast.error(d.error || "Error al exportar");
      return;
    }
    const rows = d.data as Solicitud[];
    const pendientes = rows.filter((s) => s.estado_solicitud === "pendiente");
    const aprobadas = rows.filter((s) => s.estado_solicitud === "aprobada");
    downloadCsv(`invitados-pendientes.csv`, toCsv(pendientes));
    setTimeout(
      () => downloadCsv(`invitados-aprobadas.csv`, toCsv(aprobadas)),
      200
    );
    toast.success("CSV exportados");
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
        <Loader2 className="h-6 w-6 animate-spin text-[#c8102e]" />
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
          <div className="flex min-w-0 flex-1 items-center gap-[10px]">
            <Image
              src="/logo_intitucional.jpeg"
              alt="Unidad Nacional de Inteligencia Financiera"
              width={36}
              height={36}
              loading="eager"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold tracking-tight">inviteting</div>
              <Select
                value={evento?.id || null}
                onValueChange={(value) => {
                  if (value === "new") newEvento();
                  else if (typeof value === "string") selectEvento(value);
                }}
              >
                <SelectTrigger
                  aria-label="Evento activo"
                  className="h-8 w-full rounded-[9px] border-[#e5e5e8] bg-[#fafafa] px-2.5 py-0 text-xs font-semibold text-[#3f3f46] shadow-none hover:border-[#f3c9d0] hover:bg-[#fcedef] focus-visible:border-[#e9a3af] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,16,46,0.15)]"
                >
                  <CalendarDays className="text-[#c8102e]" />
                  <SelectValue className="min-w-0 truncate">
                    {evento?.nombre || "Selecciona un evento"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent
                  align="start"
                  alignItemWithTrigger={false}
                  className="rounded-[12px] p-1.5 shadow-[0_12px_32px_rgba(24,24,27,0.14)]"
                >
                  {eventos.map((item) => (
                    <SelectItem
                      key={item.id}
                      value={item.id}
                      className="min-h-14 rounded-[9px] px-2.5 py-2 focus:bg-[#fcedef]"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-[#fcedef] text-[#a50d26]">
                          <CalendarDays size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-[#18181b]">
                            {item.nombre}
                          </span>
                          <span className="block truncate text-[11.5px] text-[#71717a]">
                            {item.fecha} · {item.lugar}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                  {eventos.length > 0 && <SelectSeparator className="my-1.5" />}
                  <SelectItem
                    value="new"
                    className="min-h-12 rounded-[9px] px-2.5 py-2 font-semibold text-[#a50d26] focus:bg-[#fcedef] focus:text-[#c8102e]"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#fcedef]">
                        <Plus size={17} />
                      </span>
                      Crear nuevo evento
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <button
            onClick={exportCsv}
            disabled={!evento?.id}
            className="flex h-11 shrink-0 items-center justify-center gap-[7px] rounded-[10px] border border-[#e5e5e8] bg-white px-3 text-[13px] font-semibold text-[#18181b] active:bg-[#f4f4f5] disabled:opacity-40"
            title="Exportar registro de invitados a CSV"
          >
            <Download size={17} />
            <span className="hidden sm:inline">CSV</span>
          </button>
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
             <p className="mb-[14px] text-[13px] text-[#71717a]">
               {evento?.id ? "Los entes e invitados pertenecen a este evento." : "Completa los datos para crear un evento."}
             </p>
            <div className="mb-3 rounded-[14px] border border-[#e5e5e8] bg-white p-[14px]">
              <div className="mb-[13px] flex flex-col gap-[6px]">
                 <Label htmlFor="evento-nombre" className="text-[13px] font-semibold">Nombre del evento</Label>
                 <Input
                   id="evento-nombre"
                  value={evento?.nombre ?? ""}
                  onChange={(e) => setEvento((p) => (p ? { ...p, nombre: e.target.value } : p))}
                  className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                />
              </div>
              <div className="mb-[13px] grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-[6px]">
                   <Label htmlFor="evento-fecha" className="text-[13px] font-semibold">Fecha</Label>
                   <Input
                     id="evento-fecha"
                    type="date"
                    value={evento?.fecha ?? ""}
                    onChange={(e) => setEvento((p) => (p ? { ...p, fecha: e.target.value } : p))}
                    className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                  />
                </div>
                <div className="flex flex-col gap-[6px]">
                   <Label htmlFor="evento-hora" className="text-[13px] font-semibold">Hora</Label>
                   <Input
                     id="evento-hora"
                    type="time"
                    value={evento?.hora ?? ""}
                    onChange={(e) => setEvento((p) => (p ? { ...p, hora: e.target.value } : p))}
                    className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                  />
                </div>
              </div>
              <div className="mb-[13px] flex flex-col gap-[6px]">
                 <Label htmlFor="evento-lugar" className="text-[13px] font-semibold">Lugar</Label>
                 <Input
                   id="evento-lugar"
                  value={evento?.lugar ?? ""}
                  onChange={(e) => setEvento((p) => (p ? { ...p, lugar: e.target.value } : p))}
                  className="h-12 rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                />
              </div>
              <div className="mb-[13px] flex flex-col gap-[6px]">
                 <Label htmlFor="evento-descripcion" className="text-[13px] font-semibold">Descripción</Label>
                 <Textarea
                   id="evento-descripcion"
                  rows={3}
                  value={evento?.descripcion ?? ""}
                  onChange={(e) => setEvento((p) => (p ? { ...p, descripcion: e.target.value } : p))}
                  className="rounded-[10px] border-[#e5e5e8] text-base shadow-none md:text-[15px]"
                />
              </div>
              <div className="mb-[13px] flex min-h-16 items-center justify-between gap-4 rounded-[11px] border border-[#e5e5e8] bg-[#fafafa] px-3.5 py-3">
                <div className="min-w-0">
                  <Label htmlFor="inscripciones-evento" className="text-[13.5px] font-semibold">
                    Inscripciones abiertas
                  </Label>
                  <p className="mt-0.5 text-xs text-[#71717a]">
                    Permite que los invitados envíen nuevas solicitudes.
                  </p>
                </div>
                <Switch
                  id="inscripciones-evento"
                  checked={evento?.inscripciones_abiertas ?? false}
                  onCheckedChange={(value) =>
                    setEvento((current) =>
                      current ? { ...current, inscripciones_abiertas: value } : current
                    )
                  }
                  disabled={!evento}
                />
              </div>
              <Button
                onClick={saveEvento}
                disabled={savingEvento}
                className="h-12 w-full rounded-[11px] bg-[#c8102e] text-[15px] font-semibold text-white hover:bg-[#9e0c24]"
              >
                {savingEvento ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save size={18} />}
                Guardar cambios
              </Button>
              {evento?.id && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={`/registro?evento=${evento.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center rounded-[10px] border border-[#e5e5e8] text-sm font-semibold"
                  >
                    Abrir registro
                  </a>
                  <a
                    href={`/scanner?evento=${evento.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center rounded-[10px] border border-[#e5e5e8] text-sm font-semibold"
                  >
                    Abrir escáner
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmation("");
                      setDeleteDialogOpen(true);
                    }}
                    className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-[#fecaca] text-sm font-semibold text-[#dc2626] active:bg-[#fef2f2]"
                  >
                    <Trash2 size={17} /> Eliminar evento
                  </button>
                </div>
              )}
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
            className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#c8102e] text-white shadow-[0_6px_18px_rgba(200,16,46,0.32)] active:scale-95 xl:right-[calc((100vw-56rem)/2+1rem)]"
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
                className="h-12 w-full rounded-[11px] bg-[#c8102e] text-[15px] font-semibold text-white hover:bg-[#9e0c24]"
              >
                {creatingEnte ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Crear ente
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-[14px] border-[#fecaca]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#dc2626]">Eliminar evento</DialogTitle>
            <DialogDescription className="text-sm text-[#71717a]">
              Esta acción es irreversible. Se eliminarán en cascada todos sus entes,
              solicitudes, invitados y registros de entrada.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-3">
            <div className="flex flex-col gap-[6px]">
              <Label htmlFor="delete-event-confirmation" className="text-[13px] font-semibold">
                Escribe <span className="font-bold text-[#18181b]">{evento?.nombre}</span> para confirmar
              </Label>
              <Input
                id="delete-event-confirmation"
                autoComplete="off"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="h-12 rounded-[10px] border-[#fecaca] text-base md:text-[15px]"
              />
            </div>
            <Button
              onClick={deleteCurrentEvento}
              disabled={deletingEvento || deleteConfirmation !== evento?.nombre}
              className="h-12 w-full rounded-[11px] bg-[#dc2626] text-[15px] font-semibold text-white hover:bg-[#b91c1c]"
            >
              {deletingEvento ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Trash2 size={18} />}
              Eliminar definitivamente
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] w-full max-w-4xl -translate-x-1/2 border-t border-[#e5e5e8] bg-white pb-[env(safe-area-inset-bottom)]">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            disabled={!evento?.id && t.key !== "evento"}
            className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-[3px] text-[10.5px] font-semibold ${
              tab === t.key ? "text-[#c8102e]" : "text-[#71717a]"
            } disabled:opacity-40`}
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
  const used = ente.cupos_usados;
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
          className="h-full rounded-full bg-[#c8102e]"
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
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#fcedef] text-[15px] font-bold text-[#c8102e]">
          {initials(s.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold [overflow-wrap:anywhere]">
            {s.nombre}
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
      {s.estado_solicitud === "aprobada" && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold">
          <span
            className={`h-[7px] w-[7px] rounded-full ${s.escaneado_en ? "bg-[#16a34a]" : "bg-[#a1a1aa]"}`}
          />
          <span className={s.escaneado_en ? "text-[#16a34a]" : "text-[#71717a]"}>
            {s.escaneado_en
              ? `Escaneado · ${formatDateTime(s.escaneado_en)}`
              : "No escaneado"}
          </span>
        </div>
      )}
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
        <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-[#fcedef] text-[15px] font-bold text-[#c8102e]">
          {initials(s.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="break-words text-[15px] font-semibold [overflow-wrap:anywhere]">
            {s.nombre}
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
      {s.estado_solicitud === "aprobada" && (
        <div className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold">
          <span
            className={`h-[7px] w-[7px] rounded-full ${s.escaneado_en ? "bg-[#16a34a]" : "bg-[#a1a1aa]"}`}
          />
          <span className={s.escaneado_en ? "text-[#16a34a]" : "text-[#71717a]"}>
            {s.escaneado_en
              ? `Escaneado · ${formatDateTime(s.escaneado_en)}`
              : "No escaneado"}
          </span>
        </div>
      )}
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
