type LiveMetricsBarProps = {
  summary: {
    eyeContactPct: number;
    lookingDownPct: number;
    smilingPct: number;
    posturePct: number;
    distractedCount: number;
    totalFrames: number;
  };
};

const getColor = (value: number) => {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 40) return "bg-amber-400";
  return "bg-rose-500";
};

export const LiveMetricsBar = ({ summary }: LiveMetricsBarProps) => {
  const { eyeContactPct, lookingDownPct, smilingPct, posturePct, distractedCount, totalFrames } = summary;
  const analyzing = totalFrames < 30;

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        Live Metrics
      </h3>

      {analyzing ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Analyzing... please wait while the interview runs.
        </div>
      ) : (
        <div className="space-y-4">
          <MetricRow
            label="Eye contact"
            value={eyeContactPct}
            color={getColor(eyeContactPct)}
          />
          <MetricRow
            label="Posture"
            value={posturePct}
            color={getColor(posturePct)}
          />
          <MetricRow
            label="Smile"
            value={smilingPct}
            color="bg-sky-500"
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between font-medium text-slate-700 dark:text-slate-100">
              <span>Distracted</span>
              <span className={"rounded-full px-3 py-1 text-xs font-semibold " + (distractedCount > 10 ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100")}>{distractedCount}</span>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Count of sudden head movement or distractions detected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricRow = ({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm font-semibold text-slate-700 dark:text-slate-100">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500 ease-in-out`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
};
