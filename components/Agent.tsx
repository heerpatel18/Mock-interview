// initializes Vapi client, listens for events (call start/end,transcripts,speech start/end,asking questions, recording answers, and saving feedback), and maintains an array of message
// objects (msg). When the call finishes, it forwards the transcript to `createFeedback` and navigates to 
// feedback page. All AI/user Messages are kept in local state during the call; nothing is persisted until feedback generation.

// When finished : Agent component can finalize interview and update corresponding interview record in the database with interview results and feedbac
// Agent receives interview questions and user/interview IDs as props
// gets user name id int id feedb id type ques


"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { interviewer } from "@/constants";
import { createFeedback } from "@/lib/actions/general.action";
import type { AgentProps, SavedMessage } from "@/types";


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
}: AgentProps) => { 
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);   // State to track current status of the call (inactive, connecting, active, finished). 
  const [messages, setMessages] = useState<SavedMessage[]>([]);    // Local state to store transcript during interview. Each message has a role + content 
  const [isSpeaking, setIsSpeaking] = useState(false);      // State to track if AI interviewer is currently speaking
  const [lastMessage, setLastMessage] = useState<string>(""); //  State to store content of the last message received

  // Interview state management
  const [interviewStage, setInterviewStage] = useState<'greeting' | 'waitingGreetingReply' | 'startInterview' | 'question1' | 'question2' | 'question3' | 'completed'>('greeting');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // ✅ Add stop and feedback refs
  const stopRef = useRef(false);
  const feedbackGeneratedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    
    const onCallStart = async () => {
      console.log("✅ Call started");
      setCallStatus(CallStatus.ACTIVE);
      
      // Log all questions at the start of interview
      if (questions && questions.length > 0) {
        console.log("\n========== INTERVIEW QUESTIONS ==========");
        console.log(`Total Questions: ${questions.length}`);
        questions.forEach((q, idx) => {
          console.log(`[${idx + 1}] ${q}`);
        });
        console.log("=========================================\n");
      }
    };

    const onCallEnd = () => {
      console.log("Call ended, logging final state...");
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: any) => { 
      console.log("📩 RAW MESSAGE RECEIVED:", message);
      
      // Only handle final transcripts, ignore partial ones
      if (message.type === "transcript" && message.transcriptType === "final") {
        console.log("🗣️ FINAL TRANSCRIPT [" + (message.role === "user" ? "USER" : "AI") + "]:", message.transcript);
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => {
          // Avoid duplicates - check if we already have this message
          const exists = prev.some(m => m.role === newMessage.role && m.content === newMessage.content);
          if (!exists) {
            return [...prev, newMessage];
          }
          return prev;
        });
        return;
      }
      
      // Skip partial transcripts and other incremental updates
      if (message.transcriptType === "partial") {
        return;
      }
      
      // Fallback cases - but avoid duplicates
      if (message.role && message.transcript && message.transcriptType !== "partial") {
        console.log("🗣️ TRANSCRIPT [" + (message.role === "user" ? "USER" : "AI") + "]:", message.transcript);
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => {
          const exists = prev.some(m => m.role === newMessage.role && m.content === newMessage.content);
          if (!exists) {
            return [...prev, newMessage];
          }
          return prev;
        });
        return;
      }

      if (message.role && message.text) {
        console.log("🤖 AI MESSAGE:", message.text);
        const newMessage = { role: message.role, content: message.text };
        setMessages((prev) => {
          const exists = prev.some(m => m.role === newMessage.role && m.content === newMessage.content);
          if (!exists) {
            return [...prev, newMessage];
          }
          return prev;
        });
        return;
      }
      
      // Alternative: Check for message with message field (nested)
      if (message.message?.role && message.message?.content) {
        const newMessage = { role: message.message.role, content: message.message.content };
        setMessages((prev) => {
          const exists = prev.some(m => m.role === newMessage.role && m.content === newMessage.content);
          if (!exists) {
            return [...prev, newMessage];
          }
          return prev;
        });
        console.log("Added nested message:", newMessage);
        return;
      }
    };
    
    // Disable transcript events to avoid duplicates - we handle transcripts via onMessage
    const onTranscript = (message: any) => {
      // Skip this to avoid duplicate handling
      return;
    };
    
    // Disable speech-update events to avoid incremental updates
    const onSpeechUpdate = (data: any) => {
      // Skip this to avoid incremental updates
      return;
    };
    
    // Disable conversation-update events to avoid duplicates
    const onConversationUpdate = (data: any) => {
      // Skip this to avoid duplicate handling
      return;
    };

    const onSpeechStart = () => {
      console.log("🎤 AI STARTED SPEAKING [Voice: " + (language === "hi" ? "Saavi (Hindi)" : "Sarah (English)") + "]");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("🔇 AI STOPPED SPEAKING");
      setIsSpeaking(false);
    };

    const onError = (error: Error) => {
      console.log("Error:", error);
    };

    vapi.on("call-start", onCallStart);
    vapi.on("call-end", onCallEnd);
    vapi.on("message", onMessage);
    vapi.on("transcript", onTranscript);
    vapi.on("speech-update", onSpeechUpdate);
    vapi.on("conversation-update", onConversationUpdate);
    vapi.on("speech-start", onSpeechStart);
    vapi.on("speech-end", onSpeechEnd);
    vapi.on("error", onError);

    return () => {
      vapi.off("call-start", onCallStart);
      vapi.off("call-end", onCallEnd);
      vapi.off("message", onMessage);
      vapi.off("transcript", onTranscript);
      vapi.off("speech-update", onSpeechUpdate);
      vapi.off("conversation-update", onConversationUpdate);
      vapi.off("speech-start", onSpeechStart);
      vapi.off("speech-end", onSpeechEnd);
      vapi.off("error", onError);
    };
  }, [language, questions]);





  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content); //Shows most recent transcript on screen.
    }

    // MAIN 2 
    //sends transcript to the backend.
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
      // ✅ Prevent multiple feedback generation
      if (feedbackGeneratedRef.current) {
        console.log("Feedback already generated, skipping");
        return;
      }

      feedbackGeneratedRef.current = true;
     
      // Ensure we have messages to process
      if (!messages || messages.length === 0) {
        console.error("No messages to generate feedback from");
        console.log("Messages state:", messages);
        console.log("Call status:", callStatus);
        alert("No interview transcript available for feedback generation");
        router.push("/");
        return;
      }

      console.log("Generating feedback with messages:", messages);

      // MAIN
      try { // send this 4 gen.act.ts creates feedback, it eval , generates feedback , saved in fb , return result -> returns true and f id 
        const { success, feedbackId: id, error } = await createFeedback({
          interviewId: interviewId!,
          userId: userId!,
          transcript: messages,
          feedbackId,
        });

        // Depending on success of feedback generation, navigate to the feedback page or show an error message. If feedback is generated successfully, it navigates to the feedback page for the interview. If there is an error during feedback generation, it logs the error and shows an alert to the user, then navigates back to the home page. This ensures that the user receives appropriate feedback on the outcome of their interview and can review their performance if feedback was generated successfully.
        if (success && id) {
          console.log("Feedback generated successfully:", id);
          router.push(`/interview/${interviewId}/feedback`);
        } else {
          console.error("Error saving feedback:", error);
          alert(`Failed to generate feedback: ${error || 'Unknown error'}`);
          router.push("/");
        }
      } catch (error) {
        console.error("Unexpected error in handleGenerateFeedback:", error);
        alert(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        router.push("/");
      }
    };


    //MAIN 1 
    // call end -> feedback generation start
    let timer: NodeJS.Timeout | null = null;
    
    if (callStatus === CallStatus.FINISHED) {
      console.log("Call is FINISHED. Checking conditions...");
      console.log("Messages count:", messages.length);
      console.log("Messages:", messages);
      console.log("Interview type:", type);
      
      if (type === "generate") {
        console.log("Type is 'generate', redirecting to home");
        router.push("/");
      } else if (messages.length > 0) {
        console.log("Type is NOT 'generate' and we have messages. Starting feedback generation...");
        // Add a small delay to ensure all final messages are processed
        timer = setTimeout(() => {
          console.log("Timer fired, calling handleGenerateFeedback with", messages.length, "messages");
          handleGenerateFeedback(messages);
        }, 500);
      } else {
        console.log("Call finished but no messages collected and type is not 'generate'");
      }
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [messages, callStatus, feedbackId, interviewId, router, type, userId]); // Dependency array





  //MAIN 1
const handleCall = async () => {
  console.log("📱 Call button clicked");
  console.log("Language:", language);
  console.log("Interview type:", type);
  console.log("Questions:", questions);
  
  try {
    setCallStatus(CallStatus.CONNECTING);

    // 🇮🇳 HINDI MODE: Use browser-based pipeline (NO Vapi)
    if (language === "hi" && type !== "generate") {
      console.log("🇮🇳 Starting Hindi Interview");

      // ✅ Reset flags
      stopRef.current = false;
      feedbackGeneratedRef.current = false;

      setMessages([]);
      setCallStatus(CallStatus.ACTIVE);

      // ✅ Greeting FIRST - start TTS immediately
      setInterviewStage('greeting');
      await speakHindi("नमस्ते! आज मुझसे बात करने के लिए समय निकालने हेतु आपका धन्यवाद। मैं आपके बारे में और आपके अनुभव के बारे में अधिक जानने के लिए उत्साहित हूँ। क्या आप तैयार हैं? ");

      // ✅ Listen for greeting response
      setInterviewStage('waitingGreetingReply');
      const greetingResponse = await listenForAnswer();
      
      if (greetingResponse) {
        // ✅ Simple natural response to greeting
        setInterviewStage('startInterview');
        await speakHindi("बहुत बढ़िया, चलिए शुरू करते हैं।");
      } else {
        // If no response, still start interview
        setInterviewStage('startInterview');
        await speakHindi("चलिए शुरू करते हैं।");
      }

      // ✅ Start questions
      await runQuestion(0);

      return;
    }

    // 🇬🇧 ENGLISH MODE: Use Vapi
    if (type === "generate") {
      console.log("🎯 Generate mode - starting Vapi workflow");
      await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
        variableValues: {
          username: userName,
          userid: userId,
        },
      });
    } else {
      let formattedQuestions = "";

      if (questions) {
        formattedQuestions = questions
          .map((q: string) => `- ${q}`)
          .join("\n");
      }

      console.log("🚀 Starting Vapi (English) with:", {
        language,
        questionsCount: questions?.length,
      });

      await vapi.start(interviewer, {
  variableValues: {
    questions: formattedQuestions,
    language: "English",
  },

    voice: {
      provider: "11labs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en",
  
  },
});

    }
  } catch (error) {
    console.error("❌ Error starting interview:", error);
    setCallStatus(CallStatus.INACTIVE);
    alert(`Failed to start interview: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

  // MAIN
  // clicks "End Call" , it sets call status to finished  , USE EFFECT AUTO TRIGGERED when any dependency change
  const handleEndCall = () => {
    console.log("🛑 Call stopped by user");

    stopRef.current = true;

    setCallStatus(CallStatus.FINISHED);

    // Stop Vapi for English mode
    if (language === "en") {
      vapi.stop();
    }

    audioRef.current?.pause();
    audioRef.current = null;
  };

  // 🇮🇳 HINDI PIPELINE - REAL-TIME BROWSER-BASED

  /**
   * Speak Hindi text using Sarvam TTS via backend
   */
  const speakHindi = async (text: string): Promise<boolean> => {
    if (stopRef.current) return false;

    try {
      console.log("🔊 TTS Request:", text);

      setIsSpeaking(true);

      // ✅ update transcript immediately
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: text },
      ]);

      const res = await fetch("/api/sarvam-tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      console.log("▶️ Playing audio...");

      await audioEl.play();

      return new Promise((resolve) => {
        audioEl.onended = () => {
          console.log("▶️ Audio completed");
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
          resolve(true);
        };

        audioEl.onerror = () => {
          console.error("❌ Audio error");
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

  /**
   * Generate short, TTS-friendly feedback only (no follow-up questions)
   */
  const generateShortFeedback = async (question: string, answer: string): Promise<string | null> => {
    if (stopRef.current) return null;

    try {
      console.log("🤖 Generating short feedback for answer:", answer);

      const res = await fetch("/api/generate-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          isFeedbackOnly: true, // New flag for short feedback
        }),
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

  /**
   * Listen for user answer using Sarvam STT via backend
   * Uses Voice Activity Detection to stop recording after 1.5s of silence (after user has spoken)
   */
  const listenForAnswer = async (maxSeconds = 15): Promise<string | null> => {
    let stream: MediaStream | null = null;

    try {
      console.log("🎤 Recording started with VAD");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      // VAD setup
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let silenceStart: number | null = null;
      let hasSpoken = false;
      let stopped = false;

      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      mediaRecorder.start(100); // collect in 100ms chunks

      const stopRecording = () => {
        if (stopped) return;
        stopped = true;
        console.log("🛑 VAD triggered - stopping recording");
        mediaRecorder.stop();
        audioContext.close();
        stream?.getTracks().forEach((t) => t.stop());
      };

      // Hard max timeout
      const maxTimer = setTimeout(() => {
        console.log("⏱️ Max recording time reached");
        stopRecording();
      }, maxSeconds * 1000);

      // VAD loop — stop after 1.5s silence AFTER user has spoken
      const vadInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        if (avg > 10) {
          // User is speaking
          hasSpoken = true;
          silenceStart = null;
        } else if (hasSpoken) {
          // User was speaking, now silent
          if (!silenceStart) silenceStart = Date.now();
          if (Date.now() - silenceStart > 1500) {
            // 1.5s of silence = done
            console.log("🤐 1.5s of silence detected - stopping");
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
          console.log("🛑 Recording stopped");

          const blob = new Blob(chunks, { type: "audio/webm" });
          const formData = new FormData();
          formData.append("file", blob, "audio.webm");

          const res = await fetch("/api/sarvam-stt", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();
          const transcript = data.transcript || "";

          console.log("🧠 User transcript:", transcript);

          setMessages((prev) => [
            ...prev,
            { role: "user", content: transcript },
          ]);

          resolve(transcript);
        };
      });
    } catch (err) {
      console.error("❌ STT error:", err);
      stream?.getTracks().forEach((track) => track.stop());
      return null;
    }
  };

  /**
   * Start Hindi interview - real-time in browser
   */
  const runQuestion = async (index: number, retryCount = 0) => {
    if (stopRef.current) return;

    // Ensure we have questions
    if (!questions || questions.length === 0) {
      console.error("❌ Need at least 1 question, got:", questions?.length);
      await speakHindi("क्षमा करें, सवाल तैयार नहीं हैं। कृपया पुनः प्रयास करें।");
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
    setInterviewStage(`question${index + 1}` as any);

    // Log which question is being asked
    console.log(`\n🎯 ASKING QUESTION ${index + 1}/${questions.length}:`);
    console.log(`   "${question}"`);

    // 1️⃣ Ask main question
    await speakHindi(question);

    // 2️⃣ Listen for answer
    const answer = await listenForAnswer();
    if (!answer) {
      if (retryCount >= 1) {
        console.warn("Skipping question due to repeated mic/STT failure", index);
        return runQuestion(index + 1);
      }
      return runQuestion(index, retryCount + 1);
    }

    // 3️⃣ Generate short feedback only (no follow-up question)
    setIsProcessing(true);
    try {
      const feedback = await generateShortFeedback(question, answer);
      if (feedback) {
        await speakHindi(feedback);
      }
    } catch (error) {
      console.error("Feedback generation error:", error);
    }
    setIsProcessing(false);

    // 4️⃣ Move to next question
    return runQuestion(index + 1);
  };

  return (
    <>
      <div className="call-view">
        {/* AI Interviewer Card */}
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

        {/* User Profile Card */}
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
      </div>

      {messages.length > 0 && (
        <div className="transcript-border">
          <div className="transcript">
            {isProcessing ? (
              <p className="text-lg text-center text-white opacity-100 animate-pulse">
                सोच रहा हूँ...
              </p>
            ) : (
              <div className="space-y-2">
                {messages.length > 0 && (
                  <div
                    className={`p-2 rounded ${
                      messages[messages.length - 1].role === 'assistant'
                        ? 'bg-gray-900/50 text-right ml-8'
                        : 'bg-gray-700/50 text-left mr-8'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-300">
                      {messages[messages.length - 1].role === 'assistant' ? 'AI:' : 'You:'}
                    </span>
                    <p className="text-white mt-1">{messages[messages.length - 1].content}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full flex justify-center">
        {callStatus !== "ACTIVE" ? (
          <button className="relative btn-call" onClick={() => handleCall()}>
            <span
              className={cn(
                "absolute animate-ping rounded-full opacity-75",
                callStatus !== "CONNECTING" && "hidden"
              )}
            />

            <span className="relative">
              {callStatus === "INACTIVE" || callStatus === "FINISHED"
                ? "Call"
                : ". . ."}
            </span>
          </button>
        ) : (
          <button className="btn-disconnect" onClick={() => handleEndCall()}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;