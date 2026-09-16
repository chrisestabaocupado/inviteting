"use client";

import { useState } from "react";
import Image from "next/image";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PinGateProps {
  onAuth: () => void;
}

export function PinGate({ onAuth }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!pin.trim()) {
      setError("PIN requerido");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "PIN inválido");
        return;
      }
      onAuth();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-[360px] text-center">
        <Image
          src="/logo_intitucional.jpeg"
          alt="Unidad Nacional de Inteligencia Financiera"
          width={56}
          height={56}
          loading="eager"
          className="mx-auto mb-5 h-14 w-14 rounded-full object-cover shadow-[0_8px_20px_rgba(200,16,46,0.28)]"
        />
        <h1 className="text-[23px] font-extrabold tracking-tight">Acceso administrativo</h1>
        <p className="mt-2 text-sm text-[#71717a]">Ingresa tu PIN para continuar</p>
      </div>
      <form onSubmit={submit} className="mt-8 w-full max-w-[360px]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]">
            <KeyRound size={18} />
          </span>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={20}
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="h-12 rounded-[10px] border-[#e5e5e8] bg-white pl-10 text-base shadow-none focus:border-[#e9a3af] focus:ring-[3px] focus:ring-[rgba(200,16,46,0.15)] md:text-[15px]"
          />
        </div>
        {error && (
          <p className="mt-2 text-sm font-semibold text-[#dc2626]">{error}</p>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="mt-4 h-[52px] w-full rounded-[12px] bg-[#c8102e] text-[15.5px] font-bold text-white hover:bg-[#9e0c24] active:scale-[0.99]"
        >
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          Entrar
        </Button>
      </form>
    </div>
  );
}
