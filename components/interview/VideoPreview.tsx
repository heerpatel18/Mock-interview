"use client";

import { useMemo, type RefObject } from "react";

type VideoPreviewProps = {
  videoRef: RefObject<HTMLVideoElement>;
  isActive: boolean;
  liveMetrics: {
    eyeContact: boolean;
    smiling: boolean;
    postureGood: boolean;
    faceVisible: boolean;
  };
  sessionSeconds: number;
};

export const VideoPreview = ({
  videoRef,
  isActive,
  liveMetrics,
  sessionSeconds,
}: VideoPreviewProps) => {
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(sessionSeconds / 60);
    const seconds = sessionSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [sessionSeconds]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950/5 shadow-sm shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950/60">
      <video
        ref={videoRef}
        className="h-full w-full bg-slate-900 object-cover"
        autoPlay
        muted
        playsInline
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

      <div className="absolute left-4 top-4 space-y-2 text-white">
        <div className="rounded-2xl bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-200">
          {isActive ? "Live" : "Camera off"}
        </div>
        <div className="rounded-2xl bg-slate-950/80 px-3 py-2 text-sm font-semibold text-slate-100">
          {formattedTime}
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 grid gap-3 sm:grid-cols-2">
        <StatusBadge label="Eye contact" active={liveMetrics.eyeContact} />
        <StatusBadge label="Smile" active={liveMetrics.smiling} accent="sky" />
        <StatusBadge label="Posture" active={liveMetrics.postureGood} accent="emerald" />
        <StatusBadge label="Face visible" active={liveMetrics.faceVisible} accent="amber" />
      </div>
    </div>
  );
};

const StatusBadge = ({
  label,
  active,
  accent = "rose",
}: {
  label: string;
  active: boolean;
  accent?: "rose" | "sky" | "emerald" | "amber";
}) => {
  const base = active ? "text-white" : "text-slate-300";
  const bg = active
    ? accent === "sky"
      ? "bg-sky-500"
      : accent === "emerald"
      ? "bg-emerald-500"
      : accent === "amber"
      ? "bg-amber-500"
      : "bg-rose-500"
    : "bg-slate-700/80";

  return (
    <div className={`rounded-2xl px-3 py-2 ${bg} ${base} text-sm font-medium shadow-sm shadow-black/10`}>
      <p>{label}</p>
      <p className="mt-1 text-xs text-slate-100/90">
        {active ? "Good" : "Needs attention"}
      </p>
    </div>
  );
};
