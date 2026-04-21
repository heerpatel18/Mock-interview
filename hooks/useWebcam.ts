import { useEffect, useRef, useState } from "react";

const getFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    switch (error.name) {
      case "NotAllowedError":
        return "Please allow camera access";
      case "NotFoundError":
        return "No camera found on this device";
      case "NotReadableError":
        return "Camera is being used by another app";
      default:
        return error.message || "Unable to access camera";
    }
  }
  return "Unable to access camera";
};

export const useWebcam = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  };

  const startCamera = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        setError("Camera is not supported in this browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      // ✅ Set active FIRST so the video element renders in the DOM
      setIsActive(true);
      setError(null);

    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setIsActive(false);
    }
  };

  // ✅ Attach stream once video element exists in DOM
  useEffect(() => {
    if (isActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return { videoRef, isActive, startCamera, stopCamera, error } as const;
};