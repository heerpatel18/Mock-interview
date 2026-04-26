import { useEffect, useRef, useState, useCallback } from "react";
import {
  FaceLandmarker,
  PoseLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

export type MediaPipeFaceAnalysis = {
  eyeContact: boolean;
  lookingDown: boolean;
  smiling: boolean;
  faceVisible: boolean;
};

export type PostureAnalysis = {
  postureGood: boolean;
  shoulderDiff: number;
};

type PoseDetectionResultCompat = {
  landmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
  poseLandmarks?: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
};

export const useMediaPipe = () => {
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadModels = async () => {
      try {
        if (typeof window === "undefined") return;

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );

        const [faceLandmarker, poseLandmarker] = await Promise.all([
          FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
          }),
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            },
            runningMode: "VIDEO",
            numPoses: 1,
          }),
        ]);

        if (!isMounted) {
          faceLandmarker.close();
          poseLandmarker.close();
          return;
        }

        faceLandmarkerRef.current = faceLandmarker;
        poseLandmarkerRef.current = poseLandmarker;
        setIsLoaded(true);
        console.log("FaceLandmarker and PoseLandmarker loaded");
      } catch (err) {
        console.error("Failed to load MediaPipe models:", err);
      }
    };

    loadModels();

    return () => {
      isMounted = false;
      faceLandmarkerRef.current?.close();
      faceLandmarkerRef.current = null;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, []);

  const analyzeFrame = useCallback(
    async (
      video: HTMLVideoElement,
      timestamp: number
    ): Promise<MediaPipeFaceAnalysis | null> => {
      const faceLandmarker = faceLandmarkerRef.current;
      if (!faceLandmarker || !video || video.videoWidth === 0) return null;

      try {
        const result = faceLandmarker.detectForVideo(video, timestamp);
        const landmarks = result.faceLandmarks?.[0];
        const blendshapes = result.faceBlendshapes?.[0]?.categories;

        if (!landmarks) {
          return {
            eyeContact: false,
            lookingDown: false,
            smiling: false,
            faceVisible: false,
          };
        }

        const nose = landmarks[1];
        const eyeContact =
          nose.x > 0.35 && nose.x < 0.65 && nose.y > 0.3 && nose.y < 0.7;

        const smileLeft =
          blendshapes?.find((b) => b.categoryName === "mouthSmileLeft")?.score ?? 0;
        const smileRight =
          blendshapes?.find((b) => b.categoryName === "mouthSmileRight")?.score ?? 0;
        const smiling = (smileLeft + smileRight) / 2 > 0.4;

        const lookingDown = nose.y > 0.6;

        return { eyeContact, lookingDown, smiling, faceVisible: true };
      } catch (err) {
        console.warn("Face detection error:", err);
        return null;
      }
    },
    []
  );

  const analyzePosture = useCallback(
    async (
      video: HTMLVideoElement,
      timestamp: number
    ): Promise<PostureAnalysis | null> => {
      const poseLandmarker = poseLandmarkerRef.current;
      if (!poseLandmarker || !video || video.videoWidth === 0) {
        console.log("Posture skipped: model or video not ready");
        return null;
      }

      try {
        const result = poseLandmarker.detectForVideo(
          video,
          timestamp
        ) as PoseDetectionResultCompat;
        const poseSets = result.landmarks ?? result.poseLandmarks ?? [];
        const landmarks = poseSets[0];

        if (!landmarks || landmarks.length < 13) {
          console.log("No usable pose landmarks detected");
          return null;
        }

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        if (!leftShoulder || !rightShoulder) {
          console.log("Shoulder landmarks missing in pose result");
          return null;
        }

        const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);

        return {
          postureGood: shoulderDiff < 0.15,
          shoulderDiff,
        };
      } catch (err) {
        console.warn("Posture detection error:", err);
        return null;
      }
    },
    []
  );

  return { analyzeFrame, analyzePosture, isLoaded } as const;
};
