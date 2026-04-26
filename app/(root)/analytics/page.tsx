"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { InterviewAttempt } from "@/types/database";
import { getAllInterviewAttempts, syncFirestoreToIndexedDB } from "@/utils/db";
import { getCurrentUser } from "@/lib/actions/auth.action";

interface GroupedAttempt {
  interviewId: string;
  role: string;
  language: string;
  attempts: InterviewAttempt[];
  attemptCount: number;
  bestAttempt: InterviewAttempt;
  worstAttempt: InterviewAttempt;
  averages: Record<keyof InterviewAttempt["scores"], number>;
}

const metricLabels: Record<keyof InterviewAttempt["scores"], string> = {
  overallImpression: "Overall Impression",
  confidenceClarity: "Confidence & Clarity",
  technicalKnowledge: "Technical Knowledge",
  roleFit: "Role Fit",
  culturalFit: "Cultural Fit",
  communication: "Communication",
  problemSolving: "Problem Solving",
};

const containerClassName =
  "w-full rounded-3xl border border-white/10 bg-gradient-to-br from-[#171b24]/95 via-[#0f131c]/95 to-[#090c12]/95 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur";

const controlClassName =
  "w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-primary-200/60 focus:bg-white/8";

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const AnalyticsPage = () => {
  const [attempts, setAttempts] = useState<InterviewAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [roleFilter, setRoleFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);

  useEffect(() => {
    const loadAttempts = async () => {
      try {
        const user = await getCurrentUser();

        if (user?.id) {
          try {
            await syncFirestoreToIndexedDB(user.id);
          } catch (syncError) {
            console.error("❌ Sync error:", syncError);
          }
        }

        const allAttempts = await getAllInterviewAttempts();

        // ✅ Sanitize: only keep attempts with valid scores
        const validAttempts = allAttempts.filter(
          (a) => a.scores && a.scores.overallImpression != null
        );

        setAttempts(validAttempts);
      } catch (error) {
        console.error("❌ Failed to load interview attempts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAttempts();
  }, []);

  // ✅ Filter out undefined roles/languages
  const uniqueRoles = useMemo(
    () =>
      Array.from(
        new Set(attempts.map((a) => a.role).filter(Boolean))
      ).sort(),
    [attempts]
  );

  const uniqueLanguages = useMemo(
    () =>
      Array.from(
        new Set(attempts.map((a) => a.language).filter(Boolean))
      ).sort(),
    [attempts]
  );

  const groups = useMemo(() => {
    // ✅ Single clean filter with all guards
    const filtered = attempts.filter((attempt) => {
      if (!attempt.scores || attempt.scores.overallImpression == null) return false;

      const overall = attempt.scores.overallImpression;

      if (roleFilter !== "all" && attempt.role !== roleFilter) return false;
      if (languageFilter !== "all" && attempt.language !== languageFilter) return false;
      if (overall < minScore || overall > maxScore) return false;

      return true;
    });

    const map = new Map<string, GroupedAttempt>();

    for (const attempt of filtered) {
      const group = map.get(attempt.interviewId);
      if (!group) {
        map.set(attempt.interviewId, {
          interviewId: attempt.interviewId,
          role: attempt.role,
          language: attempt.language,
          attempts: [attempt],
          attemptCount: 1,
          bestAttempt: attempt,
          worstAttempt: attempt,
          averages: { ...attempt.scores },
        });
        continue;
      }

      group.attempts.push(attempt);
      group.attemptCount += 1;

      // ✅ Safe comparisons
      group.bestAttempt =
        (attempt.scores?.overallImpression ?? 0) >
        (group.bestAttempt.scores?.overallImpression ?? 0)
          ? attempt
          : group.bestAttempt;

      group.worstAttempt =
        (attempt.scores?.overallImpression ?? 0)<
        (group.worstAttempt.scores?.overallImpression ?? 0)
          ? attempt
          : group.worstAttempt;

      for (const key of Object.keys(group.averages) as Array<keyof InterviewAttempt["scores"]>) {
        group.averages[key] += attempt.scores?.[key] ?? 0;
      }
    }

   return Array.from(map.values())
    .map((group) => {
      for (const key of Object.keys(group.averages) as Array<keyof InterviewAttempt["scores"]>) {
        group.averages[key] = Number(
          (group.averages[key] / group.attemptCount).toFixed(1)
        );
      }

      group.attempts.sort(
        (a, b) =>
          (b.scores?.overallImpression ?? 0) -
          (a.scores?.overallImpression ?? 0) ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return group;
    })
    // 🔥 SORT BY BEST SCORE (HIGHEST FIRST)
    .sort(
      (a, b) =>
        (b.bestAttempt.scores?.overallImpression ?? 0) -
        (a.bestAttempt.scores?.overallImpression ?? 0)
    );
  }, [attempts, roleFilter, languageFilter, minScore, maxScore]);

  const toggleExpanded = (interviewId: string) =>
    setExpanded((prev) => ({ ...prev, [interviewId]: !prev[interviewId] }));

  const totalAttempts = attempts.length;
  const averageOverall =
    totalAttempts > 0
      ? (
          attempts.reduce(
            (sum, attempt) => sum + (attempt.scores?.overallImpression ?? 0),
            0
          ) / totalAttempts
        ).toFixed(1)
      : "0.0";

  const renderEmptyState = (title: string, description: string) => (
    <div className={`${containerClassName} px-6 py-12 text-center`}>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary-200/70">
        Analytics
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-[#AAB4D6]">{description}</p>
    </div>
  );

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,rgba(202,197,254,0.16),transparent_55%)]" />

      <section className={`${containerClassName} overflow-hidden px-6 py-8 sm:px-8`}>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-primary-200/70">
              Performance Hub
            </p>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
              Interview Analytics
            </h1>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/">Back to Dashboard</Link>
            </Button>
            <Button
              asChild
              className="bg-primary-200 text-dark-100 hover:bg-primary-200/85"
            >
              <Link href="/interview">New Interview</Link>
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-primary-200/20 bg-primary-200/10 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-primary-200/70">
              Total Attempts
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalAttempts}</p>
            <p className="mt-2 text-sm text-[#AAB4D6]">
              Stored interview runs available in local analytics.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-primary-200/70">
              Interview Groups
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{groups.length}</p>
            <p className="mt-2 text-sm text-[#AAB4D6]">
              Unique role-language combinations after current filters.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-primary-200/70">
              Average Overall
            </p>
            <p className="mt-3 text-3xl font-semibold text-white">{averageOverall}</p>
            <p className="mt-2 text-sm text-[#AAB4D6]">
              Quick read on how your recent interview quality is trending.
            </p>
          </div>
        </div>
      </section>

      <section className={`${containerClassName} px-6 py-6 sm:px-8`}>
        <div className="mb-5 flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-white">Filters</h2>
          <p className="text-sm text-[#AAB4D6]">
            Narrow the view by role, language, or overall score range.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Role</label>
            <select
              className={controlClassName}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all" className="bg-[#0F131C] text-white">All roles</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role} className="bg-[#0F131C] text-white">
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Language</label>
            <select
              className={controlClassName}
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="all" className="bg-[#0F131C] text-white">All languages</option>
              {uniqueLanguages.map((lang) => (
                <option key={lang} value={lang} className="bg-[#0F131C] text-white">
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Min Overall</label>
            <input
              type="number"
              className={controlClassName}
              value={minScore}
              min={0}
              max={100}
              onChange={(e) => setMinScore(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-white">Max Overall</label>
            <input
              type="number"
              className={controlClassName}
              value={maxScore}
              min={0}
              max={100}
              onChange={(e) => setMaxScore(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {isLoading ? (
        renderEmptyState(
          "Loading local analytics",
          "Pulling your saved interview attempts from IndexedDB and building the grouped performance view."
        )
      ) : !attempts.length ? (
        renderEmptyState(
          "No analytics data yet",
          "Take an interview first and this page will fill with grouped attempts, score trends, and breakdowns."
        )
      ) : !groups.length ? (
        renderEmptyState(
          "Nothing matches these filters",
          "Your local data exists, but the current role, language, or score range is hiding all entries."
        )
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section
              key={group.interviewId}
              className={`${containerClassName} overflow-hidden`}
            >
              <div className="flex flex-col gap-6 p-6 sm:p-8">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-primary-200/70">
                      Interview Group
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {group.role} / {group.language.toUpperCase()}
                    </h2>
                    <p className="mt-2 text-sm text-[#AAB4D6]">
                      {group.attemptCount} attempt
                      {group.attemptCount === 1 ? "" : "s"} tracked for this combination.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleExpanded(group.interviewId)}
                    className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  >
                    {expanded[group.interviewId] ? "Hide details" : "Show details"}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/80">
                      Best Overall
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {group.bestAttempt.scores?.overallImpression ?? 0}
                    </p>
                    <p className="mt-2 text-sm text-[#C6F6D5]">Strongest result in this track.</p>
                  </div>

                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
                    <p className="text-xs uppercase tracking-[0.25em] text-amber-100/80">
                      Worst Overall
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {group.worstAttempt.scores?.overallImpression ?? 0}
                    </p>
                    <p className="mt-2 text-sm text-[#FDE68A]">Lowest score captured for comparison.</p>
                  </div>

                  <div className="rounded-2xl border border-primary-200/20 bg-primary-200/10 p-5">
                    <p className="text-xs uppercase tracking-[0.25em] text-primary-200/80">
                      Average Overall
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {group.averages.overallImpression}
                    </p>
                    <p className="mt-2 text-sm text-[#D6E0FF]">Average across all attempts in this group.</p>
                  </div>
                </div>
              </div>

              {expanded[group.interviewId] && (
                <div className="border-t border-white/10 bg-black/15 px-6 py-6 sm:px-8">
                  {group.attemptCount === 1 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-primary-200/70">
                        Single Attempt Breakdown
                      </p>
                      <p className="mt-3 text-sm text-[#AAB4D6]">
                        Recorded on {formatDate(group.attempts[0].createdAt)}.
                      </p>

                      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(group.attempts[0].scores).map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded-2xl border border-white/10 bg-[#0E1420] p-4"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-primary-200/70">
                              {metricLabels[key as keyof InterviewAttempt["scores"]]}
                            </p>
                            <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-3xl border border-white/10">
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-[#090D15]">
                          <thead className="bg-white/5">
                            <tr className="border-b border-white/10">
                              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Attempt</th>
                              <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Captured</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Overall</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Confidence</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Technical</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Role Fit</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Cultural Fit</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Communication</th>
                              <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-primary-200/70">Problem Solving</th>
                            </tr>
                          </thead>

                          <tbody>
                            {group.attempts.map((attempt, index) => {
                              const isBest = attempt.attemptId === group.bestAttempt.attemptId;
                              return (
                                <tr
                                  key={attempt.attemptId}
                                  className={`border-b border-white/6 ${isBest ? "bg-emerald-400/10" : "bg-transparent"}`}
                                >
                                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-white">Attempt {index + 1}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-sm text-[#AAB4D6]">{formatDate(attempt.createdAt)}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm font-semibold text-white">{attempt.scores?.overallImpression ?? 0}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[#D6E0FF]">{attempt.scores?.confidenceClarity ?? 0}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[#D6E0FF]">{attempt.scores?.technicalKnowledge ?? 0}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[#D6E0FF]">{attempt.scores?.roleFit ?? 0}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[#D6E0FF]">{attempt.scores?.culturalFit ?? 0}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[#D6E0FF]">{attempt.scores?.communication ?? 0}</td>
                                  <td className="whitespace-nowrap px-4 py-4 text-right text-sm text-[#D6E0FF]">{attempt.scores?.problemSolving ?? 0}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;