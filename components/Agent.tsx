"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useWebcam } from "@/hooks/useWebcam";
import { useMediaPipe } from "@/hooks/useMediaPipe";
import { useAnalysisLoop } from "@/hooks/useAnalysisLoop";
import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { createFeedback } from "@/lib/actions/general.action";
import { saveInterviewAttempt, normalizeInterviewId } from "@/utils/db";
import type { AgentProps, SavedMessage } from "@/types";
import { interviewer } from "@/constants";
import { VideoPreview } from "@/components/interview/VideoPreview";
import { LiveMetricsBar } from "@/components/interview/LiveMetricsBar";

enum CallStatus {
  INACTIVE = "INACTIVE",
  CONNECTING = "CONNECTING",
  ACTIVE = "ACTIVE",
  FINISHED = "FINISHED",
}

const Agent = ({
  userName,
  userId,
  interviewId,
  feedbackId,
  type,
  questions,
  language = "en",
  role,
}: AgentProps) => {
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  type InterviewStage =
    | "greeting"
    | "waitingGreetingReply"
    | "startInterview"
    | "question1"
    | "question2"
    | "question3"
    | "completed";
  const [, setInterviewStage] = useState<InterviewStage>("greeting");
  const [isProcessing, setIsProcessing] = useState(false);
  const [, setCurrentQuestionIndex] = useState(0);

  const stopRef = useRef(false);
  const feedbackGeneratedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ✅ FIXED: removed usePostureDetection — analyzePosture now comes from useMediaPipe
  const { videoRef, isActive: webcamActive, startCamera, stopCamera } = useWebcam();
  const { analyzeFrame, analyzePosture } = useMediaPipe();
  const { liveMetrics, sessionSeconds, getMetricsSummary, resetMetrics } = useAnalysisLoop({
    videoRef,
    analyzeFrame,
    analyzePosture,
    isActive: webcamActive,
  });

  useEffect(() => {
    const onCallStart = async () => {
      console.log("✅ Call started");
      setCallStatus(CallStatus.ACTIVE);
      try {
        resetMetrics();
        await startCamera();
        console.log("📹 Webcam started for video analysis");
      } catch (error) {
        console.error("❌ Failed to start webcam:", error);
      }
      if (questions && questions.length > 0) {
        console.log("\n========== INTERVIEW QUESTIONS ==========");
        console.log(`Total Questions: ${questions.length}`);
        questions.forEach((q, idx) => console.log(`[${idx + 1}] ${q}`));
        console.log("=========================================\n");
      }
    };

    const onCallEnd = () => {
      console.log("Call ended");
      setCallStatus(CallStatus.FINISHED);
    };

    type VapiIncomingMessage = {
      type?: string;
      transcriptType?: string;
      role?: string;
      transcript?: string;
      text?: string;
      message?: {
        role?: string;
        content?: string;
      };
    };

    const onMessage = (message: VapiIncomingMessage) => {
      console.log("📩 RAW MESSAGE RECEIVED:", message);

      if (message.type === "transcript" && message.transcriptType === "final") {
        console.log("🗣️ FINAL TRANSCRIPT [" + (message.role === "user" ? "USER" : "AI") + "]:", message.transcript);
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => {
          const exists = prev.some(
            (m) => m.role === newMessage.role && m.content === newMessage.content
          );
          return exists ? prev : [...prev, newMessage];
        });
        return;
      }

      if (message.transcriptType === "partial") return;

      if (message.role && message.transcript && message.transcriptType !== "partial") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => {
          const exists = prev.some(
            (m) => m.role === newMessage.role && m.content === newMessage.content
          );
          return exists ? prev : [...prev, newMessage];
        });
        return;
      }

      if (message.role && message.text) {
        const newMessage = { role: message.role, content: message.text };
        setMessages((prev) => {
          const exists = prev.some(
            (m) => m.role === newMessage.role && m.content === newMessage.content
          );
          return exists ? prev : [...prev, newMessage];
        });
        return;
      }

      if (message.message?.role && message.message?.content) {
        const newMessage = { role: message.message.role, content: message.message.content };
        setMessages((prev) => {
          const exists = prev.some(
            (m) => m.role === newMessage.role && m.content === newMessage.content
          );
          return exists ? prev : [...prev, newMessage];
        });
      }
    };

    const onSpeechStart = () => {
      console.log("🎤 AI STARTED SPEAKING [Voice: " + (language === "hi" ? "Saavi (Hindi)" : "Sarah (English)") + "]");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("🔇 AI STOPPED SPEAKING");
      setIsSpeaking(false);
    };

    const onError = (error: unknown) => {
      console.log(
        "🚨 VAPI ERROR:",
        typeof error === "object" && error !== null ? JSON.stringify(error, null, 2) : String(error)
      );
    };

    // ✅ FIXED: removed unused onTranscript/onSpeechUpdate/onConversationUpdate
    // handlers that were no-ops — no need to register them at all
    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, [language, questions, resetMetrics, startCamera]);

  useEffect(() => {
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      if (feedbackGeneratedRef.current) return;
      feedbackGeneratedRef.current = true;

      if (!messages || messages.length === 0) {
        console.error("No messages to generate feedback from");
        alert("No interview transcript available for feedback generation");
        router.push("/");
        return;
      }

      const videoSummary = getMetricsSummary();
      console.log("📊 Video summary:", videoSummary);

      try {
        const { success, feedbackId: id, feedback, error } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
          videoSummary,
        });

        if (success && id) {
          if (feedback) {
            try {
              console.log("🚀 FEEDBACK RECEIVED:", feedback);

              const normalizeName = (name: string) =>
                name.toLowerCase().replace(/[^a-z0-9]/g, "");

              const getScore = (name: string) =>
                feedback.categoryScores.find(
                  (category) =>
                    normalizeName(category.name) === normalizeName(name)
                )?.score ?? 0;

              const attempt = {
                attemptId: crypto.randomUUID(),
                interviewId: normalizeInterviewId(role, language || "en"),
                userId: userId!,
                role,
                language: (language || "en") as "en" | "hi",
                createdAt: new Date().toISOString(),
                scores: {
                  overallImpression: feedback.totalScore,
                  confidenceClarity: getScore("Confidence&Clarity"),
                  technicalKnowledge: getScore("TechnicalKnowledge"),
                  roleFit: getScore("RoleFit"),
                  culturalFit: getScore("CulturalFit"),
                  communication: getScore("CommunicationSkills"),
                  problemSolving: getScore("Problem-Solving"),
                },
              };

              console.log("📝 INTERVIEW ATTEMPT READY TO SAVE:", attempt);
              await saveInterviewAttempt(attempt);
              console.log("✅ LOCAL ANALYTICS SAVE COMPLETE:", {
                attemptId: attempt.attemptId,
                interviewId: attempt.interviewId,
                userId: attempt.userId,
              });
            } catch (saveError) {
              console.warn("⚠️ Local analytics save failed:", saveError);
            }
          }

          router.push(`/interview/${interviewId}/feedback`);
        } else {
          console.error("Error saving feedback:", error);
          alert(`Failed to generate feedback: ${error || "Unknown error"}`);
          router.push("/");
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        alert(`Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`);
        router.push("/");
      }
    };

    let timer: NodeJS.Timeout | null = null;

    if (callStatus === CallStatus.FINISHED) {
      if (type === "generate") {
        router.push("/");
      } else if (messages.length > 0) {
        timer = setTimeout(() => handleGenerateFeedback(messages), 500);
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId, getMetricsSummary, language, role]);

  const handleCall = async () => {
    console.log("📱 Call button clicked, language:", language, "type:", type);

    try {
      setCallStatus(CallStatus.CONNECTING);

      if (language === "hi" && type !== "generate") {
        stopRef.current = false;
        feedbackGeneratedRef.current = false;
        setMessages([]);
        setCallStatus(CallStatus.ACTIVE);

        try {
          resetMetrics();
          await startCamera();
        } catch (error) {
          console.error("❌ Failed to start webcam:", error);
        }

        setInterviewStage("greeting");
        await speakHindi("नमस्ते! आज मुझसे बात करने के लिए समय निकालने हेतु आपका धन्यवाद। मैं आपके बारे में और आपके अनुभव के बारे में अधिक जानने के लिए उत्साहित हूँ। क्या आप तैयार हैं?");

        setInterviewStage("waitingGreetingReply");
        const greetingResponse = await listenForAnswer();

        setInterviewStage("startInterview");
        await speakHindi(greetingResponse ? "बहुत बढ़िया, चलिए शुरू करते हैं।" : "चलिए शुरू करते हैं।");

        await runQuestion(0);
        return;
      }

      if (type === "generate") {
        await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
          variableValues: { username: userName, userid: userId },
        });
      } else {
        // ✅ FIXED: sanitize symbols so TTS doesn't mangle == and ===
        const sanitize = (q: string) =>
          q
            .replace(/===/g, "triple equals")
            .replace(/==/g, "double equals")
            .replace(/!=/g, "not equals")
            .replace(/\|\|/g, "or")
            .replace(/&&/g, "and")
            .replace(/=>/g, "arrow function");

        const formattedQuestions = questions
          ? questions.map((q: string) => `- ${sanitize(q)}`).join("\n")
          : "";

        await vapi.start(interviewer, {
          variableValues: { questions: formattedQuestions, language: "English" },
        });
      }
    } catch (error) {
      console.error("❌ Error starting interview:", error);
      setCallStatus(CallStatus.INACTIVE);
      alert(`Failed to start interview: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleEndCall = () => {
    console.log("🛑 Call stopped by user");
    stopRef.current = true;
    setCallStatus(CallStatus.FINISHED);
    stopCamera();
    if (language === "en") vapi.stop();
    audioRef.current?.pause();
    audioRef.current = null;
  };

  const speakHindi = async (text: string): Promise<boolean> => {
    if (stopRef.current) return false;

    try {
      setIsSpeaking(true);
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);

      const res = await fetch("/api/sarvam-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS failed");

      const { audio } = await res.json();
      const audioBytes = atob(audio);
      const array = new Uint8Array(audioBytes.length);
      for (let i = 0; i < audioBytes.length; i++) {
        array[i] = audioBytes.charCodeAt(i);
      }

      const blob = new Blob([array], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audioEl = new Audio(url);
      audioRef.current = audioEl;

      await new Promise<void>((resolve) => {
        audioEl.oncanplaythrough = () => resolve();
        audioEl.load();
      });

      await audioEl.play();

      return new Promise((resolve) => {
        audioEl.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve(true);
        };
        audioEl.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve(false);
        };
      });
    } catch (err) {
      console.error("❌ speakHindi error:", err);
      setIsSpeaking(false);
      return false;
    }
  };

  const generateShortFeedback = async (
    question: string,
    answer: string
  ): Promise<string | null> => {
    if (stopRef.current) return null;
    try {
      const res = await fetch("/api/generate-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, isFeedbackOnly: true }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.text;
      }
    } catch (error) {
      console.error("❌ Error generating feedback:", error);
    }
    return null;
  };

  const listenForAnswer = async (maxSeconds = 15): Promise<string | null> => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      const audioContext = new (
        window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      )();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;
      let hasSpoken = false;
      let stopped = false;

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.start(100);

      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        mediaRecorder.stop();
        audioContext.close();
        stream?.getTracks().forEach((t) => t.stop());
      };

      const maxTimer = setTimeout(stopRecording, maxSeconds * 1000);

      const vadInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (avg > 10) {
          hasSpoken = true;
          silenceStart = null;
        } else if (hasSpoken) {
          if (!silenceStart) silenceStart = Date.now();
          if (Date.now() - silenceStart > 1500) {
            clearInterval(vadInterval);
            clearTimeout(maxTimer);
            stopRecording();
          }
        }
      }, 100);

      return new Promise((resolve) => {
        mediaRecorder.onstop = async () => {
          clearInterval(vadInterval);
          clearTimeout(maxTimer);

          const blob = new Blob(chunks, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", blob, "audio.webm");

          const res = await fetch("/api/sarvam-stt", { method: "POST", body: formData });
          const data = await res.json();
          const transcript = data.transcript || "";

          setMessages((prev) => [...prev, { role: "user", content: transcript }]);
          resolve(transcript);
        };
      });
    } catch (error) {
      console.error("❌ STT error:", error);
      stream?.getTracks().forEach((t) => t.stop());
      return null;
    }
  };

  const runQuestion = async (index: number, retryCount = 0): Promise<void> => {
    if (stopRef.current) return;

    if (!questions || questions.length === 0) {
      await speakHindi("क्षमा करें, सवाल तैयार नहीं हैं।");
      setCallStatus(CallStatus.FINISHED);
      return;
    }

    if (index >= questions.length) {
      await speakHindi("इंटरव्यू समाप्त हुआ। धन्यवाद!");
      setCallStatus(CallStatus.FINISHED);
      return;
    }

    const question = questions[index];
    setCurrentQuestionIndex(index);
    setInterviewStage(`question${index + 1}` as InterviewStage);

    await speakHindi(question);

    const answer = await listenForAnswer();
    if (!answer) {
      if (retryCount >= 1) return runQuestion(index + 1);
      return runQuestion(index, retryCount + 1);
    }

    setIsProcessing(true);
    try {
      const feedback = await generateShortFeedback(question, answer);
      if (feedback) await speakHindi(feedback);
    } catch (error) {
      console.error("Feedback generation error:", error);
    }
    setIsProcessing(false);

    return runQuestion(index + 1);
  };

  return (
    <>
      <div className="call-view">
        <div className="card-interviewer">
          <div className="avatar">
            <Image
              src="/ai-avatar.png"
              alt="profile-image"
              width={65}
              height={54}
              className="object-cover"
            />
            {isSpeaking && <span className="animate-speak" />}
          </div>
          <h3>AI Interviewer</h3>
        </div>

        <div className="card-border">
          <div className="card-content">
            <Image
              src="/user-avatar.png"
              alt="profile-image"
              width={539}
              height={539}
              className="rounded-full object-cover size-[120px]"
            />
            <h3>{userName}</h3>
          </div>
        </div>

        {/* ✅ Always rendered so videoRef is always attached to the DOM */}
        <div className={webcamActive ? "w-full max-w-md mx-auto" : "hidden"}>
          <VideoPreview
            videoRef={videoRef}
            isActive={webcamActive}
            liveMetrics={liveMetrics}
            sessionSeconds={sessionSeconds}
          />
          {webcamActive && <LiveMetricsBar summary={getMetricsSummary()} />}
        </div>
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`p-2 rounded ${
                    message.role === "assistant"
                      ? "bg-gray-900/50 text-right ml-8"
                      : "bg-gray-700/50 text-left mr-8"
                  }`}
                >
                  <span className="text-sm font-medium text-gray-300">
                    {message.role === "assistant" ? "AI:" : "You:"}
                  </span>
                  <p className="text-white mt-1">{message.content}</p>
                </div>
              ))}
              {isProcessing && (
                <div className="p-2 rounded bg-gray-900/50 text-right ml-8">
                  <span className="text-sm font-medium text-gray-300">AI:</span>
                  <p className="text-lg text-white opacity-100 animate-pulse mt-1">
                    सोच रहा हूँ...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={handleCall}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />
            <span className="relative">
              {callStatus === "INACTIVE" || callStatus === "FINISHED" ? "Call" : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={handleEndCall}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;
