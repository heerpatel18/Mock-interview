import { useEffect, useRef, useState } from "react";

export type SessionMetrics = {
  totalFrames: number;
  eyeContactFrames: number;
  lookingDownFrames: number;
  smilingFrames: number;
  goodPostureFrames: number;
  postureFrames: number;
  distractedCount: number;
  faceNotVisibleCount: number;
};

export type FrameMetrics = {
  eyeContact: boolean;
  lookingDown: boolean;
  smiling: boolean;
  faceVisible: boolean;
};

export type LiveMetrics = {
  eyeContact: boolean;
  smiling: boolean;
  postureGood: boolean;
  faceVisible: boolean;
};

export type AnalyzeFrameFn = (
  videoElement: HTMLVideoElement,
  timestamp: number
) => Promise<FrameMetrics | null>;

export type AnalyzePostureFn = (
  videoElement: HTMLVideoElement,
  timestamp: number
) => Promise<{ postureGood: boolean; shoulderDiff: number } | null>;

const INITIAL_METRICS: SessionMetrics = {
  totalFrames: 0,
  eyeContactFrames: 0,
  lookingDownFrames: 0,
  smilingFrames: 0,
  goodPostureFrames: 0,
  postureFrames: 0,
  distractedCount: 0,
  faceNotVisibleCount: 0,
};

export const useAnalysisLoop = ({
  videoRef,
  analyzeFrame,
  analyzePosture,
  isActive,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  analyzeFrame: AnalyzeFrameFn;
  analyzePosture: AnalyzePostureFn;
  isActive: boolean;
}) => {
  const metricsRef = useRef<SessionMetrics>({ ...INITIAL_METRICS });
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics>({
    eyeContact: false,
    smiling: false,
    postureGood: false,
    faceVisible: false,
  });
  const liveMetricsRef = useRef<LiveMetrics>(liveMetrics);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const frameCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastSecondUpdateRef = useRef(0);
  const previousLookStateRef = useRef({
    lookingDown: false,
    faceVisible: false,
  });

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Stash functions in refs to avoid effect re-runs
  const analyzeFrameRef = useRef(analyzeFrame);
  const analyzePostureRef = useRef(analyzePosture);
  useEffect(() => {
    analyzeFrameRef.current = analyzeFrame;
  }, [analyzeFrame]);
  useEffect(() => {
    analyzePostureRef.current = analyzePosture;
  }, [analyzePosture]);

  const resetMetrics = () => {
    metricsRef.current = { ...INITIAL_METRICS };
    startTimeRef.current = null;
    frameCountRef.current = 0;
    lastSecondUpdateRef.current = 0;
    setSessionSeconds(0);
    liveMetricsRef.current = {
      eyeContact: false,
      smiling: false,
      postureGood: false,
      faceVisible: false,
    };
    setLiveMetrics({
      eyeContact: false,
      smiling: false,
      postureGood: false,
      faceVisible: false,
    });
    previousLookStateRef.current = {
      lookingDown: false,
      faceVisible: false,
    };
  };

  const getMetricsSummary = () => {
    const metrics = metricsRef.current;
    const durationMs = startTimeRef.current
      ? Math.max(0, performance.now() - startTimeRef.current)
      : 0;
    const durationMinutes = Number((durationMs / 60000).toFixed(2));

    const safePct = (value: number, total: number) =>
      total > 0 ? Math.round((value / total) * 100) : 0;

    return {
      eyeContactPct: safePct(metrics.eyeContactFrames, metrics.totalFrames),
      lookingDownPct: safePct(metrics.lookingDownFrames, metrics.totalFrames),
      smilingPct: safePct(metrics.smilingFrames, metrics.totalFrames),
      posturePct:
        metrics.postureFrames > 0
          ? Math.round((metrics.goodPostureFrames / metrics.postureFrames) * 100)
          : 0,
      distractedCount: metrics.distractedCount,
      totalFrames: metrics.totalFrames,
      durationMinutes,
    };
  };

  const lastAnalysisTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) return; // Don't start the loop until active

    const video = videoRef.current;
    if (!video) return;

    console.log("🟡 Waiting for video readiness...");

    const runFrame = async (timestamp: number) => {
      const videoElement = videoRef.current;

      console.log("🔍 Loop check:", {
        isActive: isActiveRef.current,
        hasVideo: !!videoElement,
        readyState: videoElement?.readyState,
        width: videoElement?.videoWidth,
        height: videoElement?.videoHeight,
      });

      if (!videoElement || !isActiveRef.current) {
        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }

      // Wait until webcam stream is actually ready
      if (
        !videoElement ||
        videoElement.readyState < 2 ||
        videoElement.videoWidth === 0
      ) {
        // Try to recover video playback
        videoElement?.play?.().catch(() => {});

        rafRef.current = requestAnimationFrame(runFrame);
        return;
      }

      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
        lastSecondUpdateRef.current = timestamp;
        lastAnalysisTimeRef.current = timestamp;
        console.log("� Analysis loop started", {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
        });
      }

      console.log("💓 Loop tick");

      const shouldAnalyze =
        !lastAnalysisTimeRef.current ||
        timestamp - lastAnalysisTimeRef.current >= 2000;

      if (shouldAnalyze) {
        if (videoElement.videoWidth === 0) {
          console.warn("⚠️ Video width still 0 — skipping frame");
        }

        lastAnalysisTimeRef.current = timestamp;
        frameCountRef.current += 1;
        const currentFrame = frameCountRef.current;
        const shouldAnalyzePosture = currentFrame % 3 === 0;
        console.log("📸 Running analysis", currentFrame);

        let postureGood = liveMetricsRef.current.postureGood;

        try {
          const frameAnalysis = await analyzeFrameRef.current(videoElement, timestamp);
          metricsRef.current.totalFrames += 1;

          if (frameAnalysis) {
            if (frameAnalysis.eyeContact) {
              metricsRef.current.eyeContactFrames += 1;
            }
            if (frameAnalysis.lookingDown) {
              metricsRef.current.lookingDownFrames += 1;
            }
            if (frameAnalysis.smiling) {
              metricsRef.current.smilingFrames += 1;
            }

            if (
              frameAnalysis.lookingDown &&
              !previousLookStateRef.current.lookingDown
            ) {
              metricsRef.current.distractedCount += 1;
            }

            if (
              !frameAnalysis.faceVisible &&
              previousLookStateRef.current.faceVisible
            ) {
              metricsRef.current.distractedCount += 1;
            }

            previousLookStateRef.current = {
              lookingDown: frameAnalysis.lookingDown,
              faceVisible: frameAnalysis.faceVisible,
            };

            if (!frameAnalysis.faceVisible) {
              metricsRef.current.faceNotVisibleCount += 1;
            }

            if (shouldAnalyzePosture) {
              const postureAnalysis = await analyzePostureRef.current(
                videoElement,
                timestamp
              );
              if (postureAnalysis) {
                metricsRef.current.postureFrames += 1;
                if (postureAnalysis.postureGood) {
                  metricsRef.current.goodPostureFrames += 1;
                }
                postureGood = postureAnalysis.postureGood;
              } else {
                postureGood = false;
              }
            }

            const nextLiveMetrics: LiveMetrics = {
              eyeContact: frameAnalysis.eyeContact,
              smiling: frameAnalysis.smiling,
              postureGood,
              faceVisible: frameAnalysis.faceVisible,
            };

            const currentLiveMetrics = liveMetricsRef.current;
            const hasChanged =
              nextLiveMetrics.eyeContact !== currentLiveMetrics.eyeContact ||
              nextLiveMetrics.smiling !== currentLiveMetrics.smiling ||
              nextLiveMetrics.postureGood !== currentLiveMetrics.postureGood ||
              nextLiveMetrics.faceVisible !== currentLiveMetrics.faceVisible;

            if (hasChanged) {
              liveMetricsRef.current = nextLiveMetrics;
              setLiveMetrics(nextLiveMetrics);
            }
          } else {
            metricsRef.current.faceNotVisibleCount += 1;
            previousLookStateRef.current.faceVisible = false;
            metricsRef.current.distractedCount += 1;

            const nextLiveMetrics = {
              ...liveMetricsRef.current,
              faceVisible: false,
            };

            if (liveMetricsRef.current.faceVisible) {
              liveMetricsRef.current = nextLiveMetrics;
              setLiveMetrics(nextLiveMetrics);
            }
          }
        } catch {
          // Ignore intermittent analysis failures to keep the loop running.
        }
      }

      if (timestamp - lastSecondUpdateRef.current >= 1000) {
        lastSecondUpdateRef.current = timestamp;
        setSessionSeconds(
          Math.floor(
            (timestamp - (startTimeRef.current ?? timestamp)) / 1000
          )
        );
      }

      rafRef.current = requestAnimationFrame(runFrame);
    };

    const waitForVideo = async () => {
      const videoElement = videoRef.current;
      if (!videoElement) return;

      return new Promise<void>((resolve) => {
        const check = () => {
          if (videoElement.videoWidth > 0 && videoElement.readyState >= 2) {
            console.log("✅ Video is ready for analysis");
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        };
        check();
      });
    };

    waitForVideo().then(() => {
      rafRef.current = requestAnimationFrame(runFrame);
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isActive, videoRef]);

  return {
    metrics: metricsRef.current,
    liveMetrics,
    sessionSeconds,
    getMetricsSummary,
    resetMetrics,
  } as const;
};