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
       setError(null);
           const video = videoRef.current;


      // ✅ Set active FIRST so the video element renders in the DOM
      setIsActive(true);
      setError(null);

      // Wait for the video element to be available and attach the stream
      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const video = videoRef.current;
        if (video) {
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.srcObject = stream;
          await video.play().catch(() => {});
          return;
        }
      }
      console.error("useWebcam: <video> element never mounted");

    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      setIsActive(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return { videoRef, isActive, startCamera, stopCamera, error } as const;
};