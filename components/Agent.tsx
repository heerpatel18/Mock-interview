// initializes Vapi client, listens for events (call start/end,transcripts,speech start/end,asking questions, recording answers, and saving feedback), and maintains an array of message
// objects (msg). When the call finishes, it forwards the transcript to `createFeedback` and navigates to 
// feedback page. All AI/user Messages are kept in local state during the call; nothing is persisted until feedback generation.

// When finished : Agent component can finalize interview and update corresponding interview record in the database with interview results and feedbac
// Agent receives interview questions and user/interview IDs as props
// gets user name id int id feedb id type ques


"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
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
}: AgentProps) => { 
  const router = useRouter();
  const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);   // State to track current status of the call (inactive, connecting, active, finished). 
  const [messages, setMessages] = useState<SavedMessage[]>([]);    // Local state to store transcript during interview. Each message has a role + content 
  const [isSpeaking, setIsSpeaking] = useState(false);      // State to track if AI interviewer is currently speaking
  const [lastMessage, setLastMessage] = useState<string>(""); //  State to store content of the last message received


  useEffect(() => {
    
    const onCallStart = () => {
      console.log("Call started");
      setCallStatus(CallStatus.ACTIVE);
    };

    const onCallEnd = () => {
      console.log("Call ended, logging final state...");
      setCallStatus(CallStatus.FINISHED);
    };

    const onMessage = (message: any) => { 
      console.log("Message received:", message); // Debug log
      
      // Check for transcript messages with final transcripts . Depending on how Vapi sends the final transcript, we check multiple possible structures in the message object to extract the transcript text and role. Once we identify a message that contains the final transcript, we add it to our local messages state with the appropriate role (e.g., "interviewer") and content (the transcript text). This ensures that we capture the final interview transcript accurately for feedback generation later.
      if (message.type === "transcript" && message.transcriptType === "final") {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added final transcript message:", newMessage);
        return;
      }
      
      // Alternative: Check for message with role and transcript directly 
      if (message.role && message.transcript) {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added transcript from message.transcript:", newMessage);
        return;
      }
      
      // Alternative: Check for message with role and text
      if (message.role && message.text) {
        const newMessage = { role: message.role, content: message.text };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added message from message.text:", newMessage);
        return;
      }
      
      // Alternative: Check for message with message field (nested)
      if (message.message?.role && message.message?.content) {
        const newMessage = { role: message.message.role, content: message.message.content };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added nested message:", newMessage);
        return;
      }
    };
    
    // Handle transcript updates from Vapi
    const onTranscript = (message: any) => {
      console.log("Transcript event:", message);
      if (message.role && message.transcript) {
        const newMessage = { role: message.role, content: message.transcript };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added message from transcript event:", newMessage);
      }
    };
    
    // Handle speech-update events which may contain transcripts
    const onSpeechUpdate = (data: any) => {
      console.log("Speech update:", data);
      if (data.role && data.text) {
        const newMessage = { role: data.role, content: data.text };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added message from speech update:", newMessage);
      }
    };
    
    // Handle conversation-update events
    const onConversationUpdate = (data: any) => {
      console.log("Conversation update:", data);
      
      // If it's a messages array
      if (Array.isArray(data)) {
        data.forEach((msg: any) => {
          if (msg.role && (msg.content || msg.text || msg.transcript)) {
            const newMessage = { 
              role: msg.role, 
              content: msg.content || msg.text || msg.transcript 
            };
            setMessages((prev) => [...prev, newMessage]);
            console.log("Added message from conversation update:", newMessage);
          }
        });
      }
      
      // If it's a single message with role and content
      if (data.role && (data.content || data.text || data.transcript)) {
        const newMessage = { 
          role: data.role, 
          content: data.content || data.text || data.transcript 
        };
        setMessages((prev) => [...prev, newMessage]);
        console.log("Added message from conversation update:", newMessage);
      }
    };

    const onSpeechStart = () => {
      console.log("speech start");
      setIsSpeaking(true);
    };

    const onSpeechEnd = () => {
      console.log("speech end");
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
  }, []);





  useEffect(() => {
    if (messages.length > 0) {
      setLastMessage(messages[messages.length - 1].content); //Shows most recent transcript on screen.
    }

    // MAIN 2 
    //sends transcript to the backend.
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
     
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
    setCallStatus(CallStatus.CONNECTING);

  //  If interview type is "generate"
  // start workflow that generates questions
    if (type === "generate") {
      await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
        variableValues: {
          username: userName,
          userid: userId,
        },
      });
    } else {
      let formattedQuestions = ""; // Convert questions array → single string because Vapi variables usually expect strings
      if (questions) {
        formattedQuestions = questions
          .map((question: string) => `- ${question}`)
          .join("\n");
      }

    // Start interview workflow with my questions
      await vapi.start(interviewer, {
        variableValues: {
          questions: formattedQuestions, // send questions to AI interviewer
        },
      });
    }
  };

  // MAIN
  // clicks "End Call" , it sets call status to finished  , USE EFFECT AUTO TRIGGERED when any dependency change
  const handleDisconnect = () => {
    setCallStatus(CallStatus.FINISHED);
    vapi.stop();
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
            <p
              key={lastMessage}
              className={cn(
                "transition-opacity duration-500 opacity-0",
                "animate-fadeIn opacity-100"
              )}
            >
              {lastMessage}
            </p>
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
          <button className="btn-disconnect" onClick={() => handleDisconnect()}>
            End
          </button>
        )}
      </div>
    </>
  );
};

export default Agent;