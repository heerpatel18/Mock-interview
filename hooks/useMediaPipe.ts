import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export type MediaPipeFaceAnalysis = {
  eyeContact: boolean;
  lookingDown: boolean;
  smiling: boolean;
  faceVisible: boolean;
};

export const useMediaPipe = () => {
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadFaceLandmarker = async () => {
      try {
        if (typeof window === "undefined") {
          return;
        }

        const wasmFileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(wasmFileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 1,
        });

        if (!isMounted) {
          faceLandmarker.close?.();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        setIsLoaded(true);
        console.log("✅ MediaPipe loaded");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load face landmark model"
        );
      }
    };

    loadFaceLandmarker();

    return () => {
      isMounted = false;
      faceLandmarkerRef.current?.close?.();
      faceLandmarkerRef.current = null;
    };
  }, []);

  const analyzeFrame = async (
    videoElement: HTMLVideoElement,
    timestamp: number
  ): Promise<MediaPipeFaceAnalysis | null> => {
    const faceLandmarker = faceLandmarkerRef.current;
    if (!faceLandmarker) {
      return null;
    }

    try {
      const result = await faceLandmarker.detectForVideo(videoElement, timestamp);
      if (!Array.isArray(result.faceLandmarks) || result.faceLandmarks.length === 0) {
        return null;
      }

      const blendshapes = result.faceBlendshapes ?? [];
      const scores = blendshapes
        .flatMap((classification) => classification.categories)
        .reduce<Record<string, number>>((acc, category) => {
          if (category.categoryName) {
            acc[category.categoryName] = category.score;
          }
          return acc;
        }, {});

      const eyeLookInLeft = scores.eyeLookInLeft ?? 0;
      const eyeLookInRight = scores.eyeLookInRight ?? 0;
      const eyeLookOutLeft = scores.eyeLookOutLeft ?? 0;
      const eyeLookOutRight = scores.eyeLookOutRight ?? 0;
      const eyeLookDownLeft = scores.eyeLookDownLeft ?? 0;
      const eyeLookDownRight = scores.eyeLookDownRight ?? 0;
      const mouthSmileLeft = scores.mouthSmileLeft ?? 0;
      const mouthSmileRight = scores.mouthSmileRight ?? 0;

      const eyeContact =
        eyeLookInLeft < 0.3 &&
        eyeLookInRight < 0.3 &&
        eyeLookOutLeft < 0.3 &&
        eyeLookOutRight < 0.3;
      const lookingDown = eyeLookDownLeft > 0.4 || eyeLookDownRight > 0.4;
      const smiling = mouthSmileLeft > 0.3 && mouthSmileRight > 0.3;

      return {
        eyeContact,
        lookingDown,
        smiling,
        faceVisible: true,
      };
    } catch (err) {
  console.error("MediaPipe frame error:", err);
  return null;
}
  };

  return { analyzeFrame, isLoaded, error } as const;
};
