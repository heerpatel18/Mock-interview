# PrepWise - Complete Architecture & Data Flow Documentation

## System Overview

PrepWise is an **AI-powered mock interview platform** that conducts real-time voice interviews with candidates, evaluates their responses, and provides detailed feedback using Gemini AI and Vapi for voice conversion.

---

## 1. AUTHENTICATION FLOW (URL → Firebase)

### Entry Point: `/sign-in` or `/sign-up`

```
┌──────────────────────────────────────────────────────────┐
│ User at /sign-in or /sign-up                            │
│ (app/(auth)/sign-in/page.tsx or sign-up/page.tsx)      │
│ Renders: <AuthForm type="sign-in" | "sign-up" />       │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ├─→ [SIGN-UP PATH]
                   │   └─→ components/AuthForm.tsx
                   │       ├─ Collects: name, email, password
                   │       ├─ Form validated with Zod schema
                   │       │
                   │       └─→ Client: createUserWithEmailAndPassword()
                   │           (firebase/client.ts - Firebase Auth)
                   │           ├─ Creates user in Firebase Auth
                   │           ├─ Returns: userCredential { uid }
                   │           │
                   │           └─→ Server Action: signUp()
                   │               (lib/actions/auth.action.ts)
                   │               ├─ Checks users collection
                   │               ├─ Creates user doc if new
                   │               └─ Returns: success/error
                   │
                   └─→ [SIGN-IN PATH]
                       └─→ components/AuthForm.tsx
                           ├─ Collects: email, password
                           │
                           └─→ Client: signInWithEmailAndPassword()
                               (firebase/client.ts - Firebase Auth)
                               ├─ Verifies with Firebase
                               ├─ Gets idToken from userCredential
                               │
                               └─→ Server Action: signIn()
                                   (lib/actions/auth.action.ts)
                                   ├─ Verifies user in Firestore
                                   ├─ Creates session cookie
                                   │  (auth.createSessionCookie())
                                   ├─ Sets httpOnly cookie
                                   └─ Returns: success
                                       │
                                       └─→ Client redirects to /
                                           (Dashboard)
```

### Detailed Steps:

#### **Sign-Up Process:**

1. **User fills form** → `AuthForm.tsx`
   - Name, Email, Password
   - Form validation with Zod schema

2. **Client-side Firebase Auth** → `firebase/client.ts`
   ```typescript
   createUserWithEmailAndPassword(auth, email, password)
   ```
   - Creates user in Firebase Authentication

3. **Server Action** → `auth.action.ts` - `signUp()`
   - Checks if user already exists in Firestore
   - If not, stores user in `users` collection:
     ```
     {
       name: string,
       email: string
     }
     ```
   - Returns success/error message

4. **Redirect** → `/sign-in`

#### **Sign-In Process:**

1. **User enters credentials** → `AuthForm.tsx`

2. **Client-side Firebase Auth** → `firebase/client.ts`
   ```typescript
   signInWithEmailAndPassword(auth, email, password)
   ```
   - Verifies credentials with Firebase Authentication
   - Returns user and ID token

3. **Server Action** → `auth.action.ts` - `signIn()`
   - Receives email and idToken from client
   - Verifies user exists in Firestore
   - Creates **session cookie** using Firebase Admin SDK:
     ```typescript
     auth.createSessionCookie(idToken, { expiresIn: 7 days })
     ```
   - Stores in httpOnly cookie (secure, cannot be accessed by JS)

4. **Session Verification** → `isAuthenticated()` / `getCurrentUser()`
   - Used in layout.tsx to protect routes
   - Verifies session cookie on every request
   - Returns User object with id, name, email

### Firebase Storage:

**Collection: `users`**
```
{
  uid (document ID): "firebase-auth-uid"
  ├── name: "John Doe"
  ├── email: "john@example.com"
}
```

---

## 2. INTERVIEW GENERATION FLOW (User Input → Groq API → Firebase)

### Entry Point: `/interview` (Interview Generation Page)

```
┌─────────────────────────────────────────────────────────┐
│ User at /interview page (app/(root)/interview/page.tsx) │
│ Views form with fields:                                 │
│ - Role, Type, Level, Techstack, Amount                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Form.handleSubmit() (using react-hook-form)
                  ↓
┌─────────────────────────────────────────────────────────┐
│ Form inputs collected & validated with Zod schema       │
│ (in app/(root)/interview/page.tsx)                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ fetch POST /api/vapi/generate
                  ↓
┌─────────────────────────────────────────────────────────┐
│ API Route Handler (app/api/vapi/generate/route.ts)      │
│ - Receives: { role, type, level, techstack, amount,     │
│             userid }                                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Constructs prompt with user inputs
                  │ Calls generateText() from @ai-sdk/google
                  ↓
┌─────────────────────────────────────────────────────────┐
│ Gemini API google("gemini-1.5-flash")                   │
│ - Receives prompt with role, level, tech, type          │
│ - Returns: ["Q1", "Q2", "Q3", "Q4", "Q5"] as JSON       │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Parse JSON.parse(questions)
                  ↓
┌─────────────────────────────────────────────────────────┐
│ Create Interview object & store in Firestore            │
│ (inside app/api/vapi/generate/route.ts)                 │
│ db.collection("interviews").add({                       │
│   role, type, level, techstack, questions,              │
│   userId, finalized, coverImage, createdAt              │
│ })                                                      │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Returns: { success: true, interviewId }
                  ↓
┌─────────────────────────────────────────────────────────┐
│ Client-side (app/(root)/interview/page.tsx)             │
│ router.push(`/interview/${result.interviewId}`)         │
│ Redirects to interview detail page                      │
└─────────────────────────────────────────────────────────┘
```

### Detailed Steps:

#### **1. User Input Form** → `app/(root)/interview/page.tsx`

User provides:
- **Role**: Job title (e.g., "Software Engineer")
- **Type**: "technical" or "behavioural"
- **Level**: "junior", "mid", "senior"
- **Techstack**: Comma-separated technologies
- **Amount**: Number of questions (1-10)

#### **2. API Route** → `app/api/vapi/generate/route.ts` (POST request)

**Input received:**
```json
{
  "role": "Frontend Developer",
  "type": "technical",
  "level": "junior",
  "techstack": "React,TypeScript,Next.js",
  "amount": 5,
  "userid": "user-uid-123"
}
```

**Step 1: Send to Gemini API**
```typescript
const { text: questions } = await generateText({
  model: google("gemini-2.0-flash-001"),
  prompt: `Prepare questions for a job interview.
    The job role is ${role}.
    The job experience level is ${level}.
    The tech stack used in the job is: ${techstack}.
    The focus between behavioural and technical questions should lean towards: ${type}.
    The amount of questions required is: ${amount}.
    
    IMPORTANT: Return questions formatted as JSON array:
    ["Question 1", "Question 2", "Question 3"]
    
    No special characters (/, *) that break voice assistant.
  `
});
```

**Gemini's Response:** JSON array of questions tailored to role/level/tech stack

**Example Response:**
```json
[
  "Can you explain the component lifecycle in React and how hooks have changed that?",
  "How would you optimize a slow React application?",
  "Tell me about your experience with TypeScript. What are its benefits?",
  "How do you handle state management in a Next.js application?",
  "Describe a challenging project you worked on and how you solved it."
]
```

**Step 2: Parse and Store in Firestore**
```typescript
const interview = {
  role: "Frontend Developer",
  type: "technical",
  level: "junior",
  techstack: ["React", "TypeScript", "Next.js"],
  questions: [...parsed questions...],
  userId: "user-uid-123",
  finalized: true,
  coverImage: "/random-company-logo.png",
  createdAt: "2024-03-15T10:00:00Z"
};

await db.collection("interviews").add(interview);
```

**Step 3: Return Response**
```json
{
  "success": true,
  "interviewId": "interview-doc-id-123"
}
```

**Step 4: Redirect**
Frontend redirects to `/interview/[id]` to start the voice interview

> **Developer note:** the exact prompt text that is sent to Gemini in Step 1 is constructed in `app/api/vapi/generate/route.ts`.  Open that file to inspect or modify the wording used for question generation.

### Firebase Storage:

**Collection: `interviews`**
```
{
  document-id-123 (auto-generated)
  ├── role: "Frontend Developer"
  ├── type: "technical"
  ├── level: "junior"
  ├── techstack: ["React", "TypeScript", "Next.js"]
  ├── questions: ["Q1", "Q2", "Q3", "Q4", "Q5"]
  ├── userId: "user-uid-123"
  ├── finalized: true
  ├── coverImage: "/pinterest.png"
  ├── createdAt: "2024-03-15T10:00:00Z"
}
```

---

## 3. VOICE INTERVIEW FLOW (Vapi Integration)

### Entry Point: `/interview/[id]` (Interview Details Page)

```
┌─────────────────────────────────────────────────────────────┐
│ User at /interview/[id] page                               │
│ (app/(root)/interview/[id]/page.tsx - SERVER COMPONENT)   │
│ - Fetches interview: getInterviewById(id)                  │
│   (lib/actions/general.action.ts)                          │
│ - Fetches feedback: getFeedbackByInterviewId()             │
│   (lib/actions/general.action.ts)                          │
│ - Renders: <Agent questions={interview.questions} />      │
└──────────────────┬────────────────────────────────────────┘
                   │
                   │ User clicks "Call" button
                   ↓
┌─────────────────────────────────────────────────────────────┐
│ Agent.tsx (CLIENT COMPONENT)                               │
│ Calls: handleCall() function                               │
│ - Initializes Vapi (lib/vapi.sdk.ts)                       │
│ - Calls: vapi.start(interviewer, { questions })           │
└──────────────────┬────────────────────────────────────────┘
                   │
                   │ Vapi connects via WebRTC
                   ├─→ (constants/index.ts - interviewer config)
                   │   ├─ Transcriber: Deepgram (STT)
                   │   ├─ Model: OpenAI GPT-4
                   │   └─ Voice: 11Labs (TTS)
                   │
        ┌──────────┴──────────────────────────────────┐
        │ VOICE INTERVIEW LOOP (in Agent.tsx)         │
        │                                             │
        │ 1. User speaks → Deepgram converts to text  │
        │    vapi.on("message") captures:             │
        │    { role: "user", content: "..." }         │
        │    (stored in Agent component state)        │
        │                                             │
        │ 2. GPT-4 processes message + questions      │
        │    (via Vapi configuration)                 │
        │                                             │
        │ 3. 11Labs converts GPT-4 response to speech │
        │    vapi.on("message") captures:             │
        │    { role: "assistant", content: "..." }    │
        │    (stored in Agent component state)        │
        │                                             │
        │ 4. AI speaks to user via speaker            │
        │                                             │
        │ 5. Loop continues until user clicks "End"   │
        └────────────┬─────────────────────────────────┘
                     │
                     │ User clicks "End" button
                     ↓
┌──────────────────────────────────────────────────────────┐
│ Agent.tsx: handleDisconnect()                            │
│ - vapi.stop()                                            │
│ - setCallStatus = FINISHED                              │
│ - Triggers useEffect to run handleGenerateFeedback()   │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ↓ (messages array in local state passed to)
```

### Detailed Steps:

#### **1. Interview Page Setup** → `app/(root)/interview/[id]/page.tsx`

```typescript
// Fetches interview data from general.action.ts
const interview = await getInterviewById(id);

// Fetches existing feedback (if user retakes)
const feedback = await getFeedbackByInterviewId({
  interviewId: id,
  userId: user?.id
});

// Passes to Agent component:
<Agent
  userName={user?.name}
  userId={user?.id}
  interviewId={id}
  type="interview"
  questions={interview.questions}
  feedbackId={feedback?.id}
/>
```

#### **2. Agent Component** → `components/Agent.tsx`

**Initialization:**
```typescript
import { vapi } from "@/lib/vapi.sdk";

// Vapi SDK initialized with API token:
export const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN!);
```

#### **3. Vapi Call Configuration**

When user clicks "Call":

```typescript
const handleCall = async () => {
  setCallStatus(CallStatus.CONNECTING);

  // Format questions for the AI interviewer
  const formattedQuestions = questions
    .map((q: string) => `- ${q}`)
    .join("\n");

  // Start Vapi call with interviewer config
  await vapi.start(interviewer, {
    variableValues: {
      questions: formattedQuestions,
    },
  });
};
```

**Interviewer Configuration** → `constants/index.ts`

```typescript
export const interviewer: CreateAssistantDTO = {
  name: "Interviewer",
  firstMessage: "Hello! Thank you for taking the time to speak with me today...",
  
  // SPEECH-TO-TEXT (User's voice → Text)
  transcriber: {
    provider: "deepgram",      // Converts user speech to text
    model: "nova-2",
    language: "en",
  },
  
  // TEXT-TO-SPEECH (AI response → Voice)
  voice: {
    provider: "11labs",        // Converts AI text to speech
    voiceId: "sarah",          // Professional female voice
    stability: 0.4,
    similarityBoost: 0.8,
    speed: 0.9,
    style: 0.5,
    useSpeakerBoost: true,
  },
  
  // AI MODEL (Processes responses)
  model: {
    provider: "openai",
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a professional job interviewer...
          Follow the structured question flow: {{questions}}
          Listen actively and ask brief follow-up questions...
          Keep responses concise (voice interview style)...
        `,
      },
    ],
  },
};
```

#### **4. Vapi Event Listeners** → `components/Agent.tsx`

```typescript
useEffect(() => {
  // When call starts
  vapi.on("call-start", () => {
    setCallStatus(CallStatus.ACTIVE);  // Enable "End" button
  });

  // When call ends
  vapi.on("call-end", () => {
    setCallStatus(CallStatus.FINISHED);
  });

  // Capture transcript messages
  vapi.on("message", (message: any) => {
    if (message.type === "transcript" && message.transcriptType === "final") {
      const newMessage = {
        role: message.role,  // "user" or "assistant"
        content: message.transcript
      };
      setMessages((prev) => [...prev, newMessage]);
    }
  });

  // Detect when AI is speaking
  vapi.on("speech-start", () => setIsSpeaking(true));
  vapi.on("speech-end", () => setIsSpeaking(false));

  vapi.on("error", (error) => console.error("Vapi error:", error));

  return () => {
    // Cleanup listeners
    vapi.off("call-start", ...);
    vapi.off("call-end", ...);
    // etc...
  };
}, []);
```

#### **5. Message Flow During Interview**

```
┌─────────────────────────────────────┐
│  User speaks: "I love React..."    │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Deepgram (Speech-to-Text)         │
│  Output: "I love React..."         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  OpenAI GPT-4 (AI Interviewer)      │
│  - Receives: user message          │
│  - Refers to: interview questions  │
│  - Generates: follow-up question   │
│  Output: "That's great! Can you..." │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  11Labs (Text-to-Speech)           │
│  Converts to audio and plays       │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Messages saved in Component State  │
│  [{                                 │
│    role: "user",                    │
│    content: "I love React..."       │
│  },                                 │
│  {                                  │
│    role: "assistant",               │
│    content: "That's great!..."      │
│  }]                                 │
└─────────────────────────────────────┘
```

#### **6. Interview Transcript Display** → `components/Agent.tsx`

```typescript
{messages.length > 0 && (
  <div className="transcript-border">
    <div className="transcript">
      <p>{lastMessage}</p>  {/* Shows last message from either user or AI */}
    </div>
  </div>
)}
```

#### **7. End Interview & Generate Feedback**

```typescript
const handleDisconnect = () => {
  setCallStatus(CallStatus.FINISHED);
  vapi.stop();  // Disconnects Vapi call
};

useEffect(() => {
  if (callStatus === CallStatus.FINISHED) {
    // Trigger feedback generation
    handleGenerateFeedback(messages);
  }
}, [callStatus]);
```

---

## 4. FEEDBACK GENERATION FLOW (Transcript → Gemini API → Evaluation)

### Process: `components/Agent.tsx` → `lib/actions/general.action.ts` → Firestore

```
┌──────────────────────────────────────────────────────────────┐
│ Agent.tsx (CLIENT COMPONENT)                                │
│ Interview ended → messages array in local state             │
│ [                                                            │
│   { role: "user", content: "..." },                         │
│   { role: "assistant", content: "..." },                    │
│   ...                                                        │
│ ]                                                            │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Calls: createFeedback()
                   │ (lib/actions/general.action.ts - SERVER ACTION)
                   ↓
┌──────────────────────────────────────────────────────────────┐
│ createFeedback() receives:                                  │
│ - interviewId, userId, transcript (messages array)          │
│ - feedbackId (optional, for retakes)                        │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Formats transcript:
                   │ "- user: I love React..."
                   │ "- assistant: That's great!..."
                   ↓
┌──────────────────────────────────────────────────────────────┐
│ Calls Gemini API                                            │
│ (google("gemini-2.0-flash-001"))                            │
│ generateObject() from @ai-sdk/google                        │
│ - Passes formatted transcript                               │
│ - Passes feedbackSchema (Zod validation)                    │
│ - Passes evaluation prompt                                  │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Gemini analyzes transcript and returns:
                   │ {
                   │   totalScore: 78,
                   │   categoryScores: [5 objects],
                   │   strengths: [...],
                   │   areasForImprovement: [...],
                   │   finalAssessment: "..."
                   │ }
                   ↓
┌──────────────────────────────────────────────────────────────┐
│ Store in Firestore (db.collection("feedback"))             │
│ (inside lib/actions/general.action.ts)                     │
│ feedbackRef.set({                                           │
│   interviewId, userId, totalScore, categoryScores,         │
│   strengths, areasForImprovement, finalAssessment,         │
│   createdAt                                                │
│ })                                                          │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ Returns: { success: true, feedbackId }
                   ↓
┌──────────────────────────────────────────────────────────────┐
│ Agent.tsx                                                    │
│ router.push(`/interview/${interviewId}/feedback`)           │
│ Redirects to feedback display page                          │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────────────────┐
│ Feedback Page (app/(root)/interview/[id]/feedback/page.tsx) │
│ - Fetches feedback: getFeedbackByInterviewId()              │
│   (lib/actions/general.action.ts)                           │
│ - Displays: totalScore, categoryScores, strengths, etc.     │
└──────────────────────────────────────────────────────────────┘
```

#### **1. Collect Complete Transcript**

When interview ends, `messages` array contains:
```typescript
[
  { role: "assistant", content: "Can you tell me about your React experience?" },
  { role: "user", content: "I've worked with React for 3 years..." },
  { role: "assistant", content: "That's impressive. Tell me about hooks..." },
  { role: "user", content: "Hooks allow you to use state in functional components..." },
  // ... more messages
]

> These message objects are kept locally in the `Agent` component state while the call is active. They are not written to Firestore until the feedback routine runs.
```

#### **2. Send to Gemini for Analysis**

**Action: `createFeedback()`** → `lib/actions/general.action.ts`

```typescript
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  // Format transcript for Gemini
  const formattedTranscript = transcript
    .map((sentence) => `- ${sentence.role}: ${sentence.content}\n`)
    .join("");

  // Send to Gemini API
  // now using generateText + JSON.parse instead of generateObject
    model: google("gemini-2.0-flash-001"),
    schema: feedbackSchema,  // Defines output structure
    prompt: `
      You are an AI interviewer analyzing a mock interview.
      
      Transcript:
      ${formattedTranscript}

      Please evaluate the candidate and provide:
      1. Total score (0-100)
      2. Individual scores for 5 categories (0-100 each):
         - Communication Skills
         - Technical Knowledge
         - Problem-Solving
         - Cultural & Role Fit
         - Confidence & Clarity
      3. List of strengths
      4. List of areas for improvement
      5. Final assessment summary
    `,
  });
}
```

> The string above is the exact instruction Gemini receives when evaluating the transcript; it lives verbatim in `lib/actions/general.action.ts`.  You can edit it there if you need different scoring rules or wording.

#### **3. Gemini's Response Structure**

Gemini uses `feedbackSchema` (Zod validation) to return:

```typescript
export const feedbackSchema = z.object({
  totalScore: z.number().min(0).max(100),
  categoryScores: z.array(z.object({
    name: z.enum([
      "Communication Skills",
      "Technical Knowledge",
      "Problem-Solving",
      "Cultural & Role Fit",
      "Confidence & Clarity"
    ]),
    score: z.number().min(0).max(100),
    comment: z.string(),
  })).length(5),  // Exactly 5 categories
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});
```

**Example Gemini Response:**
```json
{
  "totalScore": 78,
  "categoryScores": [
    {
      "name": "Communication Skills",
      "score": 82,
      "comment": "Clear articulation and structured responses..."
    },
    {
      "name": "Technical Knowledge",
      "score": 75,
      "comment": "Good understanding of React fundamentals..."
    },
    {
      "name": "Problem-Solving",
      "score": 70,
      "comment": "Showed some problem-solving ability but needed guidance..."
    },
    {
      "name": "Cultural & Role Fit",
      "score": 80,
      "comment": "Demonstrated alignment with team values..."
    },
    {
      "name": "Confidence & Clarity",
      "score": 82,
      "comment": "Spoke confidently and maintained engagement..."
    }
  ],
  "strengths": [
    "Strong communication skills",
    "Good technical foundation",
    "Professional demeanor"
  ],
  "areasForImprovement": [
    "Deeper knowledge of advanced React patterns",
    "More examples from past projects"
  ],
  "finalAssessment": "The candidate showed solid technical knowledge..."
}
```

#### **4. Store Feedback in Firestore**

```typescript
const feedback = {
  interviewId: interviewId,
  userId: userId,
  totalScore: object.totalScore,
  categoryScores: object.categoryScores,
  strengths: object.strengths,
  areasForImprovement: object.areasForImprovement,
  finalAssessment: object.finalAssessment,
  createdAt: new Date().toISOString(),
};

await db.collection("feedback").doc(feedbackId || auto).set(feedback);
```

### Firebase Storage:

**Collection: `feedback`**
```
{
  document-id-456 (auto-generated or provided)
  ├── interviewId: "interview-doc-id-123"
  ├── userId: "user-uid-123"
  ├── totalScore: 78
  ├── categoryScores: [
  │   {
  │     name: "Communication Skills",
  │     score: 82,
  │     comment: "Clear articulation..."
  │   },
  │   ...
  │ ]
  ├── strengths: ["Good communication", "Strong fundamentals"]
  ├── areasForImprovement: ["Advanced patterns", "More examples"]
  ├── finalAssessment: "The candidate showed solid..."
  ├── createdAt: "2024-03-15T10:30:00Z"
}
```

#### **5. Display Feedback**

Page: `app/(root)/interview/[id]/feedback/page.tsx`

```typescript
const feedback = await getFeedbackByInterviewId({
  interviewId: id,
  userId: user?.id
});

// Display:
<div>
  <h1>Overall Impression: {feedback.totalScore}/100</h1>
  <p>{feedback.finalAssessment}</p>
  
  {feedback.categoryScores.map((category) => (
    <div>
      <p>{category.name} ({category.score}/100)</p>
      <p>{category.comment}</p>
    </div>
  ))}
  
  <h3>Strengths</h3>
  <ul>
    {feedback.strengths.map((s) => <li>{s}</li>)}
  </ul>
  
  <h3>Areas for Improvement</h3>
  <ul>
    {feedback.areasForImprovement.map((a) => <li>{a}</li>)}
  </ul>
</div>
```

---

## 5. COMPLETE DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PREPWISE SYSTEM                             │
└─────────────────────────────────────────────────────────────────────┘

1. AUTHENTICATION (Login/Sign-up)
   ┌──────────────────────────────────────────────────┐
   │ User Browser                                     │
   │ ├─ /sign-in or /sign-up page                    │
   │ └─ AuthForm.tsx                                  │
   └────────────────────┬─────────────────────────────┘
                        │
         ┌──────────────┴──────────────┐
         ▼                             ▼
   ┌─────────────┐             ┌──────────────┐
   │ Firebase    │             │Firebase Admin│
   │ Auth        │             │SDK           │
   │ (Client)    │             │(Server)      │
   └──────┬──────┘             └────────┬─────┘
          │                            │
          └────────────┬───────────────┘
                       ▼
              ┌─────────────────┐
              │Firestore        │
              │ - users         │
              │   collection    │
              └─────────────────┘

2. INTERVIEW GENERATION (Questions Creation)
   ┌──────────────────────────────────────┐
   │ User at /interview page              │
   │ Form: role, type, level, tech, qty   │
   └──────────────┬───────────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │POST /api/vapi/  │
         │generate (route) │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Gemini API      │
         │ (LLM)           │
         │ Generates Q's   │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │Firestore        │
         │ - interviews    │
         │   collection    │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │Redirect to      │
         │/interview/[id]  │
         └─────────────────┘

3. VOICE INTERVIEW (Real-time conversation)
   ┌──────────────────────────────────────────┐
   │ /interview/[id] page                     │
   │ Agent.tsx component                      │
   │ User clicks "Call"                       │
   └────────────┬─────────────────────────────┘
                │
                ▼
       ┌────────────────────────┐
       │ Vapi WebRTC Connection │
       └────────┬───────────────┘
                │
      ┌─────────┼─────────┐
      ▼         ▼         ▼
   ┌──────┐ ┌──────┐ ┌──────┐
   │Deep  │ │OpenAI│ │11    │
   │gram  │ │GPT-4 │ │Labs  │
   │(STT) │ │(LLM) │ │(TTS) │
   │      │ │      │ │      │
   │User  │ │  AI  │ │ AI   │
   │voice │ │Inter │ │voice │
   │→text │ │viewer│ │→user │
   └──────┘ └──────┘ └──────┘
      ▲         │         │
      └─────────┴─────────┘
            │
            ▼
   ┌─────────────────┐
   │Messages Array   │
   │[{role, content}]│
   │Stored in state  │
   └─────────────────┘

4. FEEDBACK GENERATION (Analysis & Scoring)
   ┌──────────────────────────────┐
   │ Interview ends               │
   │ Call handleGenerateFeedback()│
   └────────────┬─────────────────┘
                │
                ▼
       ┌──────────────────────┐
       │ createFeedback()     │
       │ server action        │
       └──────────┬───────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Gemini API      │
         │ Analyzes        │
         │ transcript      │
         │ Returns scores  │
         │ & assessment    │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │Firestore        │
         │ - feedback      │
         │   collection    │
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │Redirect to      │
         │/interview/[id]/ │
         │feedback page    │
         └─────────────────┘

5. FEEDBACK DISPLAY
   ┌──────────────────────────────┐
   │ /interview/[id]/feedback     │
   │ Displays:                    │
   │ - Total score               │
   │ - Category scores           │
   │ - Strengths                 │
   │ - Areas for improvement     │
   │ - Final assessment          │
   └──────────────────────────────┘
```

---

## 6. KEY COMPONENTS & FILES

### Frontend Components:
- **`AuthForm.tsx`** - Login/Sign-up UI
- **`Agent.tsx`** - Voice interview interface (main component)
- **`InterviewCard.tsx`** - Interview list display
- **`DisplayTechIcons.tsx`** - Shows tech stack icons
- **`LogoutButton.tsx`** - User logout

### Pages (Routes):
- **`app/(auth)/sign-in/page.tsx`** - Sign-in page
- **`app/(auth)/sign-up/page.tsx`** - Sign-up page
- **`app/(root)/page.tsx`** - Dashboard (list of interviews)
- **`app/(root)/interview/page.tsx`** - Generate new interview form
- **`app/(root)/interview/[id]/page.tsx`** - Interview details (voice call)
- **`app/(root)/interview/[id]/feedback/page.tsx`** - Feedback display

### Backend (Server Actions):
- **`lib/actions/auth.action.ts`** - Authentication logic
  - `signUp()` - Create user
  - `signIn()` - Authenticate user
  - `getCurrentUser()` - Get session user
  - `isAuthenticated()` - Check auth status

- **`lib/actions/general.action.ts`** - Interview/Feedback logic
  - `createFeedback()` - Generate feedback from transcript
  - `getInterviewById()` - Fetch interview details
  - `getFeedbackByInterviewId()` - Fetch feedback
  - `getLatestInterviews()` - Get recent interviews
  - `getInterviewsByUserId()` - Get user's interviews

### API Routes:
- **`app/api/vapi/generate/route.ts`** - Generate interview questions via Gemini

### Services:
- **`firebase/admin.ts`** - Firebase Admin SDK (backend)
- **`firebase/client.ts`** - Firebase Client SDK (frontend)
- **`lib/vapi.sdk.ts`** - Vapi SDK initialization

### Constants:
- **`constants/index.ts`** - Interviewer config, feedback schema, icon mappings

---

## 7. DATA TYPES

### User
```typescript
interface User {
  id: string;           // Firebase UID
  name: string;
  email: string;
}
```

### Interview
```typescript
interface Interview {
  id: string;
  userId: string;
  role: string;
  type: string;
  techstack: string[];
  level: string;
  questions: string[];
  finalized: boolean;
  createdAt: string;
  coverImage?: string;
}
```

### Feedback
```typescript
interface Feedback {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: CategoryScore[];  // 5 categories
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

interface CategoryScore {
  name: string;
  score: number;
  comment: string;
}
```

### Message (Transcript)
```typescript
interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}
```

---

## 8. EXTERNAL APIS & SERVICES

### 1. **Gemini AI (Google)**
- **Use Case**: Generate interview questions and feedback
- **Package**: `@ai-sdk/google`
- **Model**: `gemini-2.0-flash-001`
- **Called in**: 
  - `/api/vapi/generate` route (question generation)
  - `createFeedback()` action (evaluation)

### 2. **Vapi (Voice AI)**
- **Use Case**: Voice conversation and transcript handling
- **Package**: `@vapi-ai/web`
- **Integration**: Real-time voice interview
- **Components Used**:
  - **Deepgram** (Speech-to-Text) - Transcriber
  - **11Labs** (Text-to-Speech) - Voice provider
  - **OpenAI GPT-4** (LLM) - AI interviewer logic
- **Called in**: `components/Agent.tsx`

### 3. **Firebase (Google)**
- **Authentication**: Firebase Auth (user login/signup)
- **Database**: Firestore (store users, interviews, feedback)
- **Packages**: `firebase` (client), `firebase-admin` (server)

### 4. **OpenAI (via Vapi)**
- **Model**: GPT-4
- **Purpose**: AI interviewer logic (what to say/ask)
- **Configured in**: `constants/interviewer` object

---

## 9. ENV VARIABLES NEEDED

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=prepwise-1c672
FIREBASE_CLIENT_EMAIL=...@....iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n

# Vapi
NEXT_PUBLIC_VAPI_WEB_TOKEN=your-vapi-token

# (Optional) Vapi Workflow ID for generation mode
NEXT_PUBLIC_VAPI_WORKFLOW_ID=workflow-id-if-used
```

---

## 10. INTERVIEW WORKFLOW SUMMARY

### User Journey:

1. **Sign-up/Sign-in**
   - Register email & password
   - Session created in Firebase
   - Redirected to dashboard

2. **Create Interview**
   - Fill form (role, tech stack, level, type, qty)
   - Click "Start Interview"
   - Gemini generates 5 questions
   - Stored in Firestore
   - Redirected to interview page

3. **Conduct Interview**
   - Click "Call" button
   - Vapi connects (WebRTC)
   - AI speaks first question
   - User answers (speech captured)
   - Deepgram converts speech to text
   - GPT-4 processes and generates follow-up
   - 11Labs converts response to speech
   - AI speaks response
   - Cycle repeats or interview ends
   - All messages stored in component state

4. **Get Feedback**
   - Interview ends
   - All transcript sent to Gemini
   - Gemini analyzes and scores (0-100) on 5 categories
   - Feedback stored in Firestore
   - User redirected to feedback page

5. **View Results**
   - See total score
   - See category breakdown
   - See strengths & improvements
   - Option to retake interview

---

## 11. VOICE FLOW DETAILS

### Speech-to-Text (Deepgram)
- **Triggers**: When user speaks
- **Input**: Audio stream
- **Output**: Text transcript with role: "user"
- **Captured in**: Agent's message listener

### Text-to-Speech (11Labs)
- **Triggers**: After GPT-4 generates response
- **Input**: AI generated text
- **Output**: Audio speech
- **Heard by**: User through speakers

### Message Types in Vapi
```typescript
// Captured message structure
{
  type: "transcript",
  transcriptType: "final",  // "partial" or "final"
  role: "user" or "assistant",
  transcript: "actual text content"
}
```

---

## 12. ERROR HANDLING & VALIDATION

### Form Validation (Zod)
- Auth form: email, password, name
- Interview form: role, type, level, techstack, amount

### API Error Handling
- Gemini API failures logged
- Vapi connection errors caught
- Feedback generation errors with fallback

### Firestore Query Errors
- User existence checks
- Interview retrieval with redirect on not found
- Feedback retrieval with null checks

---

## 13. SECURITY NOTES

1. **Session Management**: httpOnly cookies, 7-day expiration
2. **Firebase Rules**: Ensure Firestore rules protect user data
3. **API Tokens**: Stored in environment variables
4. **Client-side**: No sensitive data in localStorage

---

## 14. SYSTEM PROMPTS (Complete List)

### Prompt #1: Question Generation (Interview Creation)

**Location**: `app/api/vapi/generate/route.ts`

**When used**: When user submits the interview generation form with role, type, level, techstack, and amount.

**What it does**: Instructs Gemini to generate interview questions based on job details.

```
Prepare questions for a job interview.
The job role is ${role}.
The job experience level is ${level}.
The tech stack used in the job is: ${techstack}.
The focus between behavioural and technical questions should lean towards: ${type}.
The amount of questions required is: ${amount}.
Please return only the questions, without any additional text.
The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
Return the questions formatted like this:
["Question 1", "Question 2", "Question 3"]

Thank you! <3
```

**Input Variables**:
- `${role}` – Job title (e.g., "Frontend Developer")
- `${type}` – "technical" or "behavioural"
- `${level}` – "junior", "mid", or "senior"
- `${techstack}` – Comma-separated technologies
- `${amount}` – Number of questions (1-10)

**Expected Output**: 
```json
[
  "Question 1 text",
  "Question 2 text",
  "Question 3 text"
]
```

---

### Prompt #2: AI Interviewer Logic (Voice Interview)

**Location**: `constants/index.ts` (in the `interviewer` object)

**When used**: During the voice interview when Vapi/GPT-4 needs to decide what to say to the candidate.

**What it does**: Instructs GPT-4 (via Vapi) on how to conduct the interview professionally.

```
You are a professional job interviewer conducting a real-time voice interview with a candidate. Your goal is to assess their qualifications, motivation, and fit for the role.

Interview Guidelines:
Follow the structured question flow:
{{questions}}

Engage naturally & react appropriately:
Listen actively to responses and acknowledge them before moving forward.
Ask brief follow-up questions if a response is vague or requires more detail.
Keep the conversation flowing smoothly while maintaining control.
Be professional, yet warm and welcoming:

Use official yet friendly language.
Keep responses concise and to the point (like in a real voice interview).
Avoid robotic phrasing—sound natural and conversational.
Answer the candidate's questions professionally:

If asked about the role, company, or expectations, provide a clear and relevant answer.
If unsure, redirect the candidate to HR for more details.

Conclude the interview properly:
Thank the candidate for their time.
Inform them that the company will reach out soon with feedback.
End the conversation on a polite and positive note.

Be sure to be professional and polite.
Keep all your responses short and simple. Use official language, but be kind and welcoming.
This is a voice conversation, so keep your responses short, like in a real conversation. Don't ramble for too long.
```

**Input Variables**:
- `{{questions}}` – List of interview questions (formatted with hyphens) that GPT-4 should follow

**Expected Output**: Natural conversational responses that follow the question flow

---

### Prompt #3: Feedback Evaluation (Analysis & Scoring)

**Location**: `lib/actions/general.action.ts` (in the `createFeedback()` function)

**When used**: After the voice interview ends, to analyze the transcript and generate scoring.

**What it does**: Instructs Gemini to analyze the interview transcript and provide detailed feedback with scores.

```
You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.

Transcript:
${formattedTranscript}

Please evaluate the candidate and provide:
1. A total score from 0-100
2. Individual scores (0-100) for these 5 categories in this exact order:
   - Communication Skills: Clarity, articulation, structured responses
   - Technical Knowledge: Understanding of key concepts for the role
   - Problem-Solving: Ability to analyze problems and propose solutions
   - Cultural & Role Fit: Alignment with company values and job role
   - Confidence & Clarity: Confidence in responses, engagement, and clarity
3. A list of strengths
4. A list of areas for improvement
5. A final assessment summary

Return the response in the exact JSON structure required.
```

**System Prompt** (sent alongside):
```
You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories.
```

**Input Variables**:
- `${formattedTranscript}` – The entire conversation between user and assistant, formatted as:
  ```
  - user: candidate's answer
  - assistant: interviewer's question/response
  - user: candidate's answer
  - ...
  ```

**Expected Output** (validated by `feedbackSchema`):
```json
{
  "totalScore": 78,
  "categoryScores": [
    {
      "name": "Communication Skills",
      "score": 82,
      "comment": "Clear articulation and structured responses..."
    },
    {
      "name": "Technical Knowledge",
      "score": 75,
      "comment": "Good understanding of React fundamentals..."
    },
    {
      "name": "Problem-Solving",
      "score": 70,
      "comment": "Showed ability but needed guidance..."
    },
    {
      "name": "Cultural & Role Fit",
      "score": 80,
      "comment": "Demonstrated alignment with team values..."
    },
    {
      "name": "Confidence & Clarity",
      "score": 82,
      "comment": "Spoke confidently and maintained engagement..."
    }
  ],
  "strengths": [
    "Strong communication skills",
    "Good technical foundation",
    "Professional demeanor"
  ],
  "areasForImprovement": [
    "Deeper knowledge of advanced patterns",
    "More examples from past projects"
  ],
  "finalAssessment": "The candidate showed solid technical knowledge..."
}
```

---

### Summary of Prompts

| Prompt | Used In | Purpose | API |
|--------|---------|---------|-----|
| **Question Generation** | `app/api/vapi/generate/route.ts` | Create interview questions | Gemini |
| **Interviewer Logic** | `constants/index.ts` | Guide AI interviewer behavior | GPT-4 (via Vapi) |
| **Feedback Evaluation** | `lib/actions/general.action.ts` | Score & analyze interview | Gemini |

---

This completes the comprehensive architecture and data flow documentation for PrepWise!
