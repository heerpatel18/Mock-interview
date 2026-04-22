import { useEffect, useRef, useState, useCallback } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export type PostureAnalysis = {
  postureGood: boolean;
  shoulderDiff: number;
};

export const usePostureDetection = () => {
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadPoseLandmarker = async () => {
      try {
        if (typeof window === "undefined") return;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        const poseLandmarker = await PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          }
        );

        if (!isMounted) {
          poseLandmarker.close();
          return;
        }

        poseLandmarkerRef.current = poseLandmarker;
        setIsLoaded(true);
        console.log("✅ PoseLandmarker loaded");
      } catch (err) {
        console.error("❌ Failed to load PoseLandmarker", err);
      }
    };

    loadPoseLandmarker();

    return () => {
      isMounted = false;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, []);

  const analyzePosture = useCallback(
    async (
      videoElement: HTMLVideoElement,
      timestamp: number
    ): Promise<PostureAnalysis | null> => {
      const poseLandmarker = poseLandmarkerRef.current;

      if (
        !poseLandmarker ||
        !videoElement ||
        videoElement.videoWidth === 0
      ) {
        return null;
      }

      try {
        const result = poseLandmarker.detectForVideo(
          videoElement,
          timestamp
        );

        // ✅ FIX: access first pose
        const landmarks = result?.poseLandmarks?.[0];

        if (!landmarks || landmarks.length < 13) {
          return null;
        }

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        if (!leftShoulder || !rightShoulder) {
          return null;
        }

        const shoulderDiff = Math.abs(
          leftShoulder.y - rightShoulder.y
        );

        return {
          postureGood: shoulderDiff < 0.05,
          shoulderDiff,
        };
      } catch (err) {
        console.warn("⚠️ Posture detection error:", err);
        return null;
      }
    },
    []
  );

  return { analyzePosture, isLoaded } as const;
};