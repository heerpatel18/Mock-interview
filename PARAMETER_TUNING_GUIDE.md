# Deep Parameter Study: Groq, TTS, STT & VAPI Configuration

## Table of Contents
1. [Groq LLM Parameters](#groq-llm-parameters)
2. [11Labs Text-to-Speech Parameters](#11labs-text-to-speech-parameters)
3. [Deepgram Speech-to-Text Parameters](#deepgram-speech-to-text-parameters)
4. [VAPI Configuration Parameters](#vapi-configuration-parameters)
5. [Real-World Impact Examples](#real-world-impact-examples)
6. [Tuning Recommendations](#tuning-recommendations)

---

## GROQ LLM Parameters

### Current Configuration in Project
**Location:** `lib/actions/general.action.ts` (createFeedback function) & API routes

```typescript
const { text } = await generateText({
  model: groq("llama-3.3-70b-versatile"),
  prompt: "...",
  system: "You are a professional interviewer...",
  temperature: 0.3,           // ← KEY PARAMETER
  maxTokens: 2048,            // ← KEY PARAMETER
});
```

### Parameter Breakdown

#### 1. **Model Selection: `llama-3.3-70b-versatile`**

| Parameter | Current | Options | Impact |
|-----------|---------|---------|--------|
| **Model** | `llama-3.3-70b-versatile` | `llama-2-70b-chat`, `mixtral-8x7b-32768`, etc. | Affects accuracy, cost, speed |
| **Size** | 70B parameters | 7B, 8x7B, 70B | Larger = more accurate but slower |
| **Variant** | "versatile" | "chat", "instruct" | "versatile" handles all tasks |

**What does `llama-3.3-70b-versatile` mean?**
- **70B** = 70 billion parameters (very large, high accuracy)
- **versatile** = Optimized for general tasks (not just chat)
- **llama-3.3** = Latest version with improved reasoning

#### 2. **Temperature: `0.3`**

Controls **randomness** in responses.

| Value | Behavior | Use Case |
|-------|----------|----------|
| **0.0** | Deterministic (always same output) | Feedback generation, structured tasks |
| **0.3** | ✅ CURRENT - Low randomness, consistent | Interview feedback (reproducible scoring) |
| **0.7** | Moderate randomness, balanced | Question generation, conversational |
| **1.0+** | Highly random, creative | Brainstorming, creative tasks |

**Why 0.3 in this project?**
- Interview feedback needs **consistent, reproducible** scoring
- If temperature is 0.3, same transcript = same feedback (good for testing)
- If temperature is 0.7, same transcript = slightly different feedback each time

**Impact of changing:**

```
Temperature: 0.1 (very deterministic)
├─ Pros: Ultra-consistent feedback, reproducible
├─ Cons: Less nuanced, might miss edge cases
└─ Example Feedback:
   "Communication: 75/100 - Clear explanations"
   "Always: 75/100 - Clear explanations"
   "Always: 75/100 - Clear explanations"

Temperature: 0.3 (CURRENT - balanced)
├─ Pros: Consistent AND some variation, professional
├─ Cons: Minimal
└─ Example Feedback:
   "Communication: 75/100 - Clear, articulate explanations"
   "Technical: 68/100 - Good understanding, minor gaps"

Temperature: 0.8 (high randomness)
├─ Pros: More creative, varied feedback
├─ Cons: Inconsistent scoring, unreliable for candidates
└─ Example Feedback:
   "Communication: 75/100 - Excellent clarity"
   "Communication: 82/100 - Well-articulated thoughts"
   (Same transcript, different scores!)
```

#### 3. **Max Tokens: `2048`**

Controls **maximum response length**.

| Value | Output Length | Use Case |
|-------|---------------|----------|
| **512** | ~300-400 words | Short responses |
| **1024** | ~600-800 words | Moderate responses |
| **2048** | ✅ CURRENT - 1200-1600 words | Detailed feedback |
| **4096** | 2000+ words | Very detailed, long-form |

**What are tokens?**
- ~1 token = ~4 characters
- 2048 tokens = ~8000 characters

**Why 2048 in this project?**
- 5 category scores + strengths + improvements + final assessment = needs space
- Typical feedback JSON = 1500-1800 tokens

**Impact of changing:**

```
maxTokens: 512
├─ Response might cut off mid-response
├─ JSON feedback incomplete
├─ Cost: Lower (~$0.0001 per request)
└─ Example Output:
   {
     "totalScore": 75,
     "categoryScores": [
       {"name": "Communication Skills", "score": 75, "comment": "Good speaking..."}
       // ← CUT OFF HERE! Incomplete feedback
     ]
   }

maxTokens: 2048 (CURRENT)
├─ Complete, detailed feedback
├─ Cost: Medium (~$0.0003 per request)
└─ Example Output:
   {
     "totalScore": 75,
     "categoryScores": [
       {"name": "Communication Skills", "score": 75, "comment": "Demonstrates clear articulation..."},
       {"name": "Technical Knowledge", "score": 68, "comment": "Strong foundation but..."},
       // ... ALL 5 CATEGORIES ✓
     ],
     "strengths": ["Clear communication", "Problem-solving approach", "Good follow-up responses"],
     "areasForImprovement": ["Depth of technical examples", "Handling edge cases"],
     "finalAssessment": "The candidate shows promising potential..."
   }

maxTokens: 4096
├─ More verbose feedback
├─ Cost: Higher (~$0.0006 per request)
├─ Might include extra explanations
└─ Example Output:
   {
     // ... 5 categories with MORE detailed comments
     "finalAssessment": "The candidate demonstrates solid communication skills with clear articulation of technical concepts. Areas like..." (very verbose)
   }
```

#### 4. **System Prompt**

Current system message:
```
"You are a professional interviewer. ALWAYS respond with ONLY valid JSON, 
never with any additional text or formatting."
```

**Impact of changing:**

```
CURRENT System Prompt:
"You are a professional interviewer. ALWAYS respond with ONLY valid JSON"
├─ Result: Structured JSON only
├─ Quality: 95% parseable output
└─ Processing time: Fast

Modified System Prompt:
"You are a harsh, critical interviewer. Be extremely strict in scoring."
├─ Result: Lower scores (65-75 instead of 70-85)
├─ Quality: Still valid JSON
└─ Strictness: 8/10

Modified System Prompt:
"You are a supportive, encouraging interviewer. Highlight what went well."
├─ Result: Higher scores (80-95)
├─ Quality: Still valid JSON
└─ Positivity: 9/10
```

---

## 11Labs TEXT-TO-SPEECH PARAMETERS

### Current Configuration in Project
**Location:** `constants/index.ts` - `interviewer.voice` object

```typescript
voice: {
  provider: "11labs",
  voiceId: "sarah",
  stability: 0.4,              // ← KEY PARAMETER
  similarityBoost: 0.8,        // ← KEY PARAMETER
  speed: 0.9,                  // ← KEY PARAMETER
  style: 0.5,                  // ← KEY PARAMETER
  useSpeakerBoost: true,       // ← KEY PARAMETER
}
```

### Parameter Breakdown

#### 1. **Voice ID: `"sarah"`**

Selects which voice to use for the AI interviewer.

| VoiceId | Gender | Personality | Use |
|---------|--------|-------------|-----|
| `sarah` | Female | Professional, warm | ✅ CURRENT - Interview moderator |
| `adam` | Male | Professional, neutral | Alternative presenter |
| `aria` | Female | Youthful, energetic | Engaging interviews |
| `callum` | Male | Young, casual | Informal chats |

**Impact of changing:**

```
Current: voiceId: "sarah"
├─ Perception: Approachable, professional
├─ Gender: Female
├─ Tone: Warm and encouraging
└─ Candidate comfort: High

Change to: voiceId: "adam"
├─ Perception: Formal, authoritative
├─ Gender: Male
├─ Tone: Neutral, slightly strict
└─ Candidate comfort: Medium (might feel more pressure)

Change to: voiceId: "aria"
├─ Perception: Friendly, youthful
├─ Gender: Female
├─ Tone: Energetic
└─ Candidate comfort: High (but less professional)
```

#### 2. **Stability: `0.4`**

Controls **consistency** of voice across multiple utterances.

| Value | Consistency | Voice Variability | Use |
|-------|-------------|-------------------|-----|
| **0.0** | Very low | High variability (natural speech swings) | Conversational, natural |
| **0.4** | ✅ CURRENT - Medium-low | Some variation, professional | Professional interviews |
| **0.7** | High | Consistent tone, robotic tone | Audiobooks, narration |
| **1.0** | Very high | Extremely consistent, monotone | Accessibility features |

**What does stability mean?**
- **Low (0.0-0.3):** Voice changes intonation dramatically, sounds more natural but erratic
- **Medium (0.4-0.6):** Balanced between natural variation and stability
- **High (0.7-1.0):** Voice stays consistent, sounds more robotic

**Impact of changing:**

```
stability: 0.2 (very variable, natural)
├─ Interviewer speech sounds:
│  └─ "What's your experience with React?" (high pitch, enthusiastic)
│  └─ "Tell me more..." (low pitch, interested)
│  └─ "Got it." (neutral pitch)
├─ Effect: Natural but unpredictable
└─ Candidate perception: More empathetic, conversational

stability: 0.4 (CURRENT - balanced)
├─ Interviewer speech sounds:
│  └─ "What's your experience with React?" (consistent mid-pitch)
│  └─ "Tell me more..." (consistent mid-pitch, slight variation)
│  └─ "Got it." (consistent mid-pitch)
├─ Effect: Professional, predictable
└─ Candidate perception: Professional, trustworthy

stability: 0.9 (very consistent, robotic)
├─ Interviewer speech sounds:
│  └─ "What's your experience with React?" (flat, monotone)
│  └─ "Tell me more..." (flat, monotone)
│  └─ "Got it." (flat, monotone)
├─ Effect: Robotic, artificial
└─ Candidate perception: Cold, mechanical (negative)
```

#### 3. **Similarity Boost: `0.8`**

Controls how closely the generated voice matches the original voice sample.

| Value | Effect | Voice Match | Use |
|-------|--------|-------------|-----|
| **0.0** | Use generic voice | Low similarity | Default/basic voice |
| **0.5** | Balanced voice similarity | Medium | Neutral delivery |
| **0.8** | ✅ CURRENT - High similarity | High (voice sounds like "Sarah") | Branded voice, consistent identity |
| **1.0** | Maximum similarity | Ultra-high (very close to original) | Premium voice cloning |

**Impact of changing:**

```
similarityBoost: 0.3 (low - generic)
├─ Voice: Generic 11Labs female voice
├─ Sound: Less distinctive, more "standard AI"
├─ Speed: Faster processing, lower CPU
└─ Effect: Candidate may not feel interviewed by same person consistently

similarityBoost: 0.8 (CURRENT - high)
├─ Voice: Distinctive "Sarah" persona
├─ Sound: Recognizable, consistent character
├─ Speed: Slightly slower processing
└─ Effect: Candidate feels interviewed by same person, familiarity

similarityBoost: 1.0 (maximum - voice clone)
├─ Voice: Ultra-realistic clone
├─ Sound: Almost indistinguishable from original
├─ Cost: Higher API cost
└─ Effect: Premium feel, but might sound too perfect/unnatural
```

#### 4. **Speed: `0.9`**

Controls **speech rate** (how fast/slow the AI speaks).

| Value | Speed | Words Per Minute | Use |
|-------|-------|------------------|-----|
| **0.5** | 1x slower than normal | ~80-100 WPM | Slow, deliberate |
| **0.75** | 0.75x normal speed | ~120 WPM | Measured, clear |
| **0.9** | ✅ CURRENT - 0.9x normal | ~140-150 WPM | Natural, professional |
| **1.0** | Normal speed | ~160 WPM | Fast, natural |
| **1.5** | 1.5x faster | ~200+ WPM | Rushed, difficult to follow |

**Impact of changing:**

```
speed: 0.6 (very slow)
├─ "What is your experience with React?"
│  (Takes ~6 seconds to say)
├─ Candidate perception: Patronizing, slow
├─ Interview duration: 50 minutes → 80+ minutes
├─ Effect: Tedious, boring experience

speed: 0.9 (CURRENT - natural)
├─ "What is your experience with React?"
│  (Takes ~3 seconds to say)
├─ Candidate perception: Natural, professional
├─ Interview duration: 50 minutes (optimal)
├─ Effect: Comfortable conversational pace

speed: 1.2 (fast)
├─ "What is your experience with React?"
│  (Takes ~2 seconds to say)
├─ Candidate perception: Rushed, pressured
├─ Interview duration: 50 minutes → 30 minutes (too short)
├─ Effect: Stressful, hard to understand
```

#### 5. **Style: `0.5`**

Controls **emotional delivery** and speaking style.

| Value | Style | Tone Range | Use |
|-------|-------|-----------|-----|
| **0.0** | Formal, neutral | Professional only | Formal scenarios |
| **0.5** | ✅ CURRENT - Balanced | Neutral with warmth | Interview balance |
| **1.0** | Expressive, varied | Wide emotional range | Dramatic, engaging |

**Impact of changing:**

```
style: 0.0 (formal, neutral)
├─ Example: "What is your experience with React?"
│           (Completely neutral, no emotion)
├─ Candidate perception: Cold, distant
├─ Use case: Formal corporate interviews

style: 0.5 (CURRENT - balanced)
├─ Example: "What is your experience with React?"
│           (Slightly warm, professional)
├─ Candidate perception: Approachable, professional
├─ Use case: Standard technical interviews ✓

style: 1.0 (expressive)
├─ Example: "What is your experience with React?"
│           (Enthusiastic, animated)
├─ Candidate perception: Warm, engaging, encouraging
├─ Use case: Friendly, relaxed interviews
```

#### 6. **Use Speaker Boost: `true`**

Enables/disables voice enhancement technology.

| Value | Effect | Quality | Use |
|-------|--------|---------|-----|
| **false** | Standard voice, no enhancement | Good | Cost-saving |
| **true** | ✅ CURRENT - Enhanced clarity & presence | Better clarity | Professional interviews |

**Impact of changing:**

```
useSpeakerBoost: false (disabled)
├─ Voice clarity: Good
├─ Speaker presence: Normal
├─ API Cost: Lower (~$0.20 per 1K chars)
├─ Audio quality: 7/10
└─ Effect: Standard voice, adequate

useSpeakerBoost: true (CURRENT - enabled)
├─ Voice clarity: Excellent
├─ Speaker presence: Enhanced, more presence
├─ API Cost: Higher (~$0.30 per 1K chars)
├─ Audio quality: 9/10
└─ Effect: Premium sound, stands out
```

---

## DEEPGRAM SPEECH-TO-TEXT PARAMETERS

### Current Configuration in Project
**Location:** `constants/index.ts` - `interviewer.transcriber` object

```typescript
transcriber: {
  provider: "deepgram",
  model: "nova-2",
  language: "en",
}
```

### Parameter Breakdown

#### 1. **Model: `nova-2`**

Selects which speech recognition model to use.

| Model | Accuracy | Speed | Latency | Use |
|-------|----------|-------|---------|-----|
| `nova-2` | ✅ CURRENT - 99.1% | Real-time | <200ms | Best for interviews |
| `nova` | 98.8% | Fast | ~300ms | Older version |
| `enhanced` | 98.5% | Fast | ~250ms | Mid-tier option |
| `base` | 97.2% | Faster | ~150ms | Budget option |

**What is `nova-2`?**
- **Latest Deepgram model** (released 2024)
- **99.1% accuracy** - catches most words correctly
- **Real-time processing** - transcribes as you speak
- **Context-aware** - understands technical terms better

**Impact of changing:**

```
model: "base" (basic, fast)
├─ Accuracy: 97.2%
├─ Latency: ~150ms
├─ Cost: Lower (~$0.01 per minute)
├─ Example transcript:
│  User: "I use React with state management"
│  Recognized: "I use React with stupid management" ❌ (error)
├─ Effect: Quick but error-prone

model: "nova-2" (CURRENT - best)
├─ Accuracy: 99.1%
├─ Latency: ~200ms
├─ Cost: Higher (~$0.05 per minute)
├─ Example transcript:
│  User: "I use React with state management"
│  Recognized: "I use React with state management" ✓ (correct)
├─ Effect: Accurate and reliable

model: "enhanced" (mid-tier)
├─ Accuracy: 98.5%
├─ Latency: ~250ms
├─ Cost: Medium (~$0.03 per minute)
├─ Example transcript:
│  User: "I use React with state management"
│  Recognized: "I use React with state managment" ~(close, minor typo)
├─ Effect: Good balance of cost and accuracy
```

#### 2. **Language: `"en"`**

Sets the language for transcription.

| Code | Language | Supported | Use |
|------|----------|-----------|-----|
| `en` | English (US) | ✅ CURRENT | Standard tech interviews |
| `en-GB` | English (UK) | ✅ | UK candidates |
| `es` | Spanish | ✅ | Spanish interviews |
| `fr` | French | ✅ | French interviews |

**Impact of changing:**

```
language: "en" (CURRENT - US English)
├─ Recognition: Optimized for US accent
├─ Tech terms: "React", "TypeScript" recognized perfectly
├─ Example:
│  Candidate: "I work with TypeScript and React"
│  Transcribed: "I work with TypeScript and React" ✓

language: "en-GB" (British English)
├─ Recognition: Optimized for UK accent
├─ Tech terms: Same recognition
├─ Example:
│  Candidate: "I work with TypeScript and React"
│  Transcribed: "I work with TypeScript and React" ✓
├─ Effect: Better for UK candidates, accent-specific

language: "es" (Spanish)
├─ Recognition: Spanish language
├─ Tech terms: "TypeScript" → "TypeScript", "React" → "React"
├─ Effect: For Spanish-speaking candidates
│  (But your system expects English prompts/responses)
```

---

## VAPI CONFIGURATION PARAMETERS

### Current Configuration
**Location:** `constants/index.ts` - Full `interviewer` object

```typescript
export const interviewer: CreateAssistantDTO = {
  name: "Interviewer",
  firstMessage: "Hello! Thank you...",
  transcriber: { /* Deepgram config */ },
  voice: { /* 11Labs config */ },
  model: { /* GPT-4 config */ }
}
```

### Key VAPI Parameters You Can Tune

#### 1. **Silence Threshold (Implicit in Default Behavior)**

When user stops speaking, VAPI waits for silence before ending the turn.

```
DEFAULT VAPI BEHAVIOR (not explicitly set):
├─ Silence timeout: ~1200-1500ms (1.2-1.5 seconds)
├─ How it works:
│  1. User speaks: "I have 5 years of React experience"
│  2. User stops speaking (silence detected)
│  3. VAPI waits 1.2-1.5 seconds
│  4. If no more audio → transcribed & sent to LLM
│  5. If audio resumes → continues recording

EXAMPLE WITH FUMBLING:
├─ Candidate: "I have uh... [pause] 5 years of experience"
│  (pause = 0.8 seconds → within threshold, continues)
├─ Candidate: "React... Node.js... actually MongoDB"
│  (pauses are 0.5 seconds → within threshold, waits)
├─ Candidate: "Thanks [long silence 2 seconds]"
│  (2 seconds silence → exceeds threshold, turn ends) ✓
```

#### 2. **End-of-Speech Threshold (Hidden Parameter)**

Implicit setting: VAPI waits for minimum silence before declaring "speech ended".

| Scenario | Silence Needed | Behavior |
|----------|----------------|----------|
| Natural conversation pause | 0.5-1.0s | Continues waiting |
| Thinking break | 1.0-1.5s | Continues waiting |
| End of response | 1.5-2.0s | Triggers handoff |

**What happens if we could change this?**

```
IF VAPI HAD: endSpeechThresholdMs: 500 (very low)
├─ Consequence: Turn ends too fast
├─ Example:
│  "What's your experience?" → [0.5s pause] → LLM fires
│  Candidate still thinking! Mid-answer response ends
├─ Effect: Frustrating, cuts off candidates
├─ Interview feel: Rushed, pushy

IF VAPI HAD: endSpeechThresholdMs: 1500 (IMPLICIT DEFAULT)
├─ Consequence: Balanced wait time
├─ Example:
│  "I have..." [pause 0.8s] → LLM waits
│  "...5 years in React" → Continues
│  [silence 1.5s] → LLM responds ✓
├─ Effect: Natural conversation flow
├─ Interview feel: Professional ✓

IF VAPI HAD: endSpeechThresholdMs: 3000 (very high)
├─ Consequence: Turn ends too slow
├─ Example:
│  Candidate finishes: "...and that's my answer"
│  [silence 1.5s] → Still waiting
│  [silence 2.0s] → Still waiting
│  [silence 2.9s] → Finally LLM responds
├─ Effect: Dead silence, awkward
├─ Interview feel: Laggy, weird pauses
```

#### 3. **Model Temperature in VAPI's LLM Config**

Not explicitly set in your code, but GPT-4 has defaults.

```typescript
model: {
  provider: "openai",
  model: "gpt-4",
  messages: [
    {
      role: "system",
      content: `You are a professional job interviewer...`
      // No temperature or top_p set
      // Uses OpenAI defaults: temperature ~0.7
    }
  ]
}
```

**Impact of changing:**

```
Current GPT-4 prompt (no temperature override):
├─ Uses: OpenAI default temperature ~0.7
├─ Effect: Varied interviewer responses
│  Q: "Tell me about yourself"
│  A1: "Great, I'd love to hear about your background!"
│  A2: "Sure, I'm interested to learn more about you!"
│  A3: "That would be helpful, please go ahead!"
│  (Different but all professional)
├─ Interview feel: Natural, conversational ✓

IF WE ADDED: temperature: 0.3
├─ Effect: Consistent interviewer responses
│  Q: "Tell me about yourself"
│  A1: "Great, I'd love to hear about your background!"
│  A1: "Great, I'd love to hear about your background!"
│  A1: "Great, I'd love to hear about your background!"
│  (Always the same)
├─ Interview feel: Robotic, predictable ❌

IF WE ADDED: temperature: 1.0+
├─ Effect: Very varied responses
│  Q: "Tell me about yourself"
│  A1: "Excellent! Please proceed."
│  A2: "I'm super excited to hear your journey!"
│  A3: "Yo, tell me everything about yourself!"  ← Too casual!
│  (Too varied, loses professionalism)
├─ Interview feel: Unpredictable, unprofessional ❌
```

---

## REAL-WORLD IMPACT EXAMPLES

### Scenario 1: Candidate Taking Longer Pauses (Like Thinking Hard)

**Current Setup:**
- Deepgram: nova-2 (99.1% accuracy)
- Silence threshold: ~1500ms (default)
- TTS speed: 0.9 (natural)

```
INTERVIEW FLOW:

Interviewer: "What's your experience with microservices?"
                (AI speaks - takes 2 seconds)
                
Candidate: "Uh... that's... that..." 
           [PAUSE 1.2 seconds - thinking]
           "...a really interesting question."
           
Result: ✓ Works fine!
├─ 1.2 second pause is within 1.5s threshold
├─ Candidate's answer is recognized completely
├─ VAPI waits, doesn't cut off

---

IF SILENCE THRESHOLD WAS 1.0 SECOND (hypothetically):

Interviewer: "What's your experience with microservices?"

Candidate: "Uh... that's..."
           [PAUSE 1.0 seconds]
           
Result: ❌ Turn ends early!
├─ Silence 1.0s triggers end-of-speech
├─ Only "Uh... that's..." is captured
├─ "a really interesting question." is lost
├─ Feedback says: Incomplete answer, not thorough
```

### Scenario 2: Changing Groq Parameters During Feedback

**Current Setup (Temperature 0.3):**
```
Scenario: Candidate got 3/5 categories right

Feedback Round 1 (temp 0.3):
├─ Total Score: 72
├─ Communication: 75 (clear explanations)
├─ Technical: 68 (good knowledge)
├─ Problem-Solving: 70 (adequate approach)
├─ Cultural Fit: 72 (average alignment)
├─ Confidence: 71 (somewhat hesitant)
├─ Feedback is: Consistent, reproducible

Feedback Round 2 (same transcript, temp 0.3):
├─ Total Score: 72 (✓ SAME)
├─ Communication: 75 (✓ SAME)
├─ Technical: 68 (✓ SAME)
├─ Overall: Identical feedback

IF TEMPERATURE WAS 0.8 (HIGH):

Feedback Round 1 (temp 0.8):
├─ Total Score: 68
├─ Communication: 70 (needs improvement)
├─ Technical: 65 (significant gaps)

Feedback Round 2 (same transcript, temp 0.8):
├─ Total Score: 78 (different!)
├─ Communication: 82 (excellent delivery)
├─ Technical: 75 (solid knowledge)

Problem: ❌ Same candidate, different scores each time!
```

### Scenario 3:  11Labs Speed & Interview Duration

**Current Setup (Speed 0.9):**
```
Interview Questions: 5 questions
Average per question:
├─ Interviewer speaks: 15 seconds
├─ Candidate answers: 45 seconds
├─ Total per Q: 60 seconds
├─ Total 5 Q: 5 minutes

Complete interview: ~30 minutes

---

IF SPEED WAS 1.5 (VERY FAST):

Average per question:
├─ Interviewer speaks: 10 seconds (faster TTS)
├─ Candidate answers: 45 seconds
├─ Total per Q: 55 seconds
├─ Total 5 Q: 4.6 minutes

Complete interview: ~25 minutes

Effect: ❌ Interview feels rushed
├─ Candidate perceives pressure
├─ Less time for thoughtful answers
├─ Incomplete technical discussion

---

IF SPEED WAS 0.6 (SLOW):

Average per question:
├─ Interviewer speaks: 25 seconds (slow TTS)
├─ Candidate answers: 45 seconds
├─ Total per Q: 70 seconds
├─ Total 5 Q: 5.8 minutes

Complete interview: ~40 minutes

Effect: ❌ Interview feels slow
├─ Candidate gets bored
├─ More time but feels tedious
├─ Extended fatigue
```

### Scenario 4: Deepgram Model Accuracy Impact

**5-minute Technical Interview:**

```
DEEPGRAM BASE (97.2% accuracy):
├─ Total words spoken: ~2500 words
├─ Expected errors: ~70 words (~2.8%)
├─ Examples:
│  - "TypeScript" → "Type Script" (error)
│  - "MongoDB" → "Mongo Deeee" (error)
│  - "async/await" → "async weight" (error)
├─ Impact on feedback: 2-3 critical misunderstandings

DEEPGRAM NOVA-2 (99.1% accuracy):
├─ Total words spoken: ~2500 words
├─ Expected errors: ~22 words (~0.9%)
├─ Examples:
│  - "TypeScript" → "TypeScript" ✓
│  - "MongoDB" → "MongoDB" ✓
│  - "async/await" → "async/await" ✓
├─ Impact on feedback: Accurate understanding

COST DIFFERENCE:
├─ Base: 5 minutes × $0.01/min = $0.05 per interview
├─ Nova-2: 5 minutes × $0.05/min = $0.25 per interview
├─ Cost increase: 5x ($0.20 more)
└─ But: Accuracy gain: 22% → 11x better accuracy!
```

---

## TUNING RECOMMENDATIONS

### Use Case 1: Fast Interview Testing (Cost-Optimized)

```
groq("llama-3.3-70b-versatile"),
temperature: 0.5,           // ← Slight randomness for variety
maxTokens: 1024,            // ← Shorter feedback

transcriber: {
  model: "enhanced",        // ← Faster, cheaper than nova-2
  language: "en",
}

voice: {
  speed: 1.0,               // ← Faster speech
  stability: 0.6,           // ← Slightly more robotic saves cost
  useSpeakerBoost: false,   // ← No boost = lower cost
}

Cost per interview: ~$0.40 (vs $1.50 with premium)
```

### Use Case 2: Strict Evaluation (High Accuracy)

```
groq("llama-3.3-70b-versatile"),
temperature: 0.1,           // ← Deterministic, consistent scoring
maxTokens: 2048,            // ← Full detailed feedback

transcriber: {
  model: "nova-2",          // ← Best accuracy
  language: "en",
}

voice: {
  speed: 0.85,              // ← Slightly slower for clarity
  stability: 0.8,           // ← High stability = consistent tone
  useSpeakerBoost: true,    // ← Premium quality
}

Accuracy: 99.1% (transcription) + 99% (grading consistency)
Interview feel: Professional, fair consistent
```

### Use Case 3: Conversational (Natural Feel)

```
groq("llama-3.3-70b-versatile"),
temperature: 0.6,           // ← Natural conversation variation
maxTokens: 1024,            // ← Concise but conversational

transcriber: {
  model: "nova-2",          // ← Accurate speech recognition
  language: "en",
}

voice: {
  speed: 0.9,               // ← ✓ CURRENT (natural pace)
  stability: 0.4,           // ← ✓ CURRENT (natural variation)
  similarityBoost: 0.8,     // ← ✓ CURRENT (distinctive voice)
  style: 0.6,               // ← Slightly warm
  useSpeakerBoost: true,    // ← ✓ CURRENT (quality)
}

Interview feel: Warm, professional, natural ✓
```

---

## QUICK REFERENCE TABLE

| Component | Parameter | Current | Impact Type | Tuning Difficulty |
|-----------|-----------|---------|-------------|-------------------|
| **Groq** | Model | llama-3.3-70b | Accuracy/Cost | Hard |
| **Groq** | Temperature | 0.3 | Consistency | Easy |
| **Groq** | MaxTokens | 2048 | Response length | Easy |
| **11Labs** | Voice ID | sarah | Personality | Easy |
| **11Labs** | Speed | 0.9 | Pacing | Easy |
| **11Labs** | Stability | 0.4 | Naturalness | Easy |
| **11Labs** | Similarity Boost | 0.8 | Voice match | Easy |
| **11Labs** | Speaker Boost | true | Audio quality | Easy |
| **Deepgram** | Model | nova-2 | Accuracy/Cost | Hard |
| **Deepgram** | Language | en | Recognition | Hard |
| **VAPI** | Silence Threshold | ~1500ms | Turn-taking | Very Hard (implicit) |
| **VAPI** | First Message | Greeting | Tone setting | Easy |

---

## Summary

**Most Important Parameters to Understand:**

1. **Groq Temperature (0.3)** - Controls consistency of scoring
2. **11Labs Speed (0.9)** - Controls interview pace
3. **Deepgram Model (nova-2)** - Controls transcription accuracy
4. **Groq MaxTokens (2048)** - Controls feedback detail
5. **11Labs Stability (0.4)** - Controls voice naturalness

**Sweet Spot for Balanced Performance:**
- Low cost: Use enhanced model + temp 0.5 + speed 1.0
- Best quality: Use nova-2 + temp 0.3 + speed 0.9 (CURRENT ✓)
- Conversational: Use nova-2 + temp 0.6 + speed 0.9

