import { useEffect, useRef, useState } from "react";
import { PoseLandmarker } from "@mediapipe/tasks-vision";

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
        if (typeof window === "undefined") {
          return;
        }

        const poseLandmarker = await PoseLandmarker.createFromOptions({
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        if (!isMounted) {
          poseLandmarker.close?.();
          return;
        }

        poseLandmarkerRef.current = poseLandmarker;
        setIsLoaded(true);
      } catch {
        // silently fail; posture analysis is optional
      }
    };

    loadPoseLandmarker();

    return () => {
      isMounted = false;
      poseLandmarkerRef.current?.close?.();
      poseLandmarkerRef.current = null;
    };
  }, []);

  const analyzePosture = async (
    videoElement: HTMLVideoElement,
    timestamp: number
  ): Promise<PostureAnalysis | null> => {
    const poseLandmarker = poseLandmarkerRef.current;
    if (!poseLandmarker) {
      return null;
    }

    try {
      const result = await poseLandmarker.detectForVideo(videoElement, timestamp);
      const landmarks = result?.poseLandmarks;
      if (!Array.isArray(landmarks) || landmarks.length <= 12) {
        return null;
      }

      const leftShoulder = landmarks[11];
      const rightShoulder = landmarks[12];
      if (!leftShoulder || !rightShoulder) {
        return null;
      }

      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      return {
        postureGood: shoulderDiff < 0.05,
        shoulderDiff,
      };
    } catch {
      return null;
    }
  };

  return { analyzePosture, isLoaded } as const;
};
