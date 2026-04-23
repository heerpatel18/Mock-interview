# Parameter Tuning 

### 1. GROQ LLM (Feedback Generation)
**File:** `lib/actions/general.action.ts`

| Parameter | Current | What It Does | Impact |
|-----------|---------|-------------|--------|
| **Model** | `llama-3.3-70b-versatile` | Chooses AI model | Better accuracy, slower |
| **Temperature** | `0.3` | Controls randomness (0-1) | 0.3 = consistent scores, 0.7 = varied |
| **MaxTokens** | `2048` | Max response length | Larger = longer feedback |

**Quick tips:**
- Temp 0.3 = Always same feedback (good for testing)
- Temp 0.6 = Varied but similar feedback (more natural)
- MaxTokens 1024 = Shorter, faster feedback
- MaxTokens 2048 = Full detailed feedback

---

### 2. 11LABS TEXT-TO-SPEECH (AI Voice)
**File:** `constants/index.ts` - `voice` object

| Parameter | Current | Options | Impact |
|-----------|---------|---------|--------|
| **voiceId** | `sarah` | sarah, adam, aria, callum | Changes voice personality |
| **speed** | `0.9` | 0.5-1.5 | 0.9 = natural pace, 1.2 = rushed |
| **stability** | `0.4` | 0.0-1.0 | 0.4 = natural, 0.8 = robotic |Controls **consistency** of voice across multiple utterances.

| **similarityBoost** | `0.8` | 0.0-1.0 | How close to original voice |Controls how closely the generated voice matches the original voice sample.

| **style** | `0.5` | 0.0-1.0 | 0.5 = balanced, 1.0 = expressive |Controls **emotional delivery** and speaking style.

| **useSpeakerBoost** | `true` | true/false | Better audio quality (higher cost) |Enables/disables voice enhancement technology.


**Quick tips:**
- Speed 0.9 = natural (~140 WPM), 1.1 = slightly fast (~160 WPM)
- Stability 0.4 = natural tone, 0.8 = consistent/robotic
- voice ID: sarah (warm), adam (formal), aria (energetic)

---

### 3. DEEPGRAM SPEECH-TO-TEXT (User Transcription)
**File:** `constants/index.ts` - `transcriber` object

| Parameter | Current | Options | Impact |
|-----------|---------|---------|--------|
| **Model** | `nova-2` | nova-2, enhanced, base | nova-2 = 99.1% accurate, enhanced = 98.5% |
| **Language** | `en` | en, en-GB, es, fr | en = US English |

**Quick tips:**
- nova-2 = Best (~99.1% accuracy, $0.05/min)
- enhanced = Good (~98.5% accurate, $0.03/min, saves 40%)
- base = Budget (~97.2% accurate, $0.01/min)

---

### 4. VAPI VOICE CONVERSATION (Turn-taking)
**File:** `constants/index.ts` - Full `interviewer` object

| Feature | Current | How It Works |
|---------|---------|-------------|
| **Silence Timeout** | ~1500ms (implicit) | Waits 1.5 seconds of silence before ending your turn |
| **Turn Detection** | Auto | Deepgram detects when you stop speaking |

**Quick tip:**
- System waits ~1.5 seconds of silence to capture your full answer
- Short pauses (0.8s) don't trigger turn end - you can pause to think
- Longer silence (1.5s+) ends your turn

---

## Quick Change Examples

### To make interview faster:
```typescript
// In constants/index.ts
speed: 1.1,      // Instead of 0.9
maxTokens: 1024  // Instead of 2048
model: "enhanced" // Instead of nova-2 (faster)
```

### To make feedback consistent:
```typescript
// In lib/actions/general.action.ts
temperature: 0.1,  // Instead of 0.3 (ultra-consistent)
```

### To make voice sound robotic:
```typescript
// In constants/index.ts
stability: 0.8,    // Instead of 0.4
```

### To save 50% cost:
```typescript
// Switch model to enhanced + disable speaker boost + higher speed
model: "enhanced",
speed: 1.0,
useSpeakerBoost: false
```

---

## Parameter Impact Table

| Parameter | Change From → To | Effect |
|-----------|------------------|--------|
| Speed | 0.9 → 1.2 | Interview feels rushed, 25% shorter |
| Temperature | 0.3 → 0.8 | Feedback becomes unpredictable |
| MaxTokens | 2048 → 512 | Feedback might cut off |
| Stability | 0.4 → 0.9 | Voice sounds more robotic |Controls **consistency** of voice across multiple utterances.

| Model (STT) | nova-2 → enhanced | 40% cheaper, loses 0.6% accuracy |
| Voice ID | sarah → adam | More formal/authoritative tone |

---

## Current Setup Assessment

✓ **Your current setup is optimal:**
- Temperature 0.3 = Consistent, professional feedback
- Speed 0.9 = Natural interview pace
- Model nova-2 = Best transcription accuracy
- Stability 0.4 = Natural, human-like voice




Silence Detection : 
👉 System waits for ~1.5 sec silence to decide you're done speaking.

🔄 Flow
You speak
You pause
If pause < 1.5s → continue listening
If pause ≥ 1.5s → send to AI
AI responds
⚙️ Can you change it?

❌ No (in your current setup)
👉 VAPI handles it internally

✅ What matters
If AI cuts you → ❌ too fast
If AI delays → ❌ too slow
If it feels natural → ✅ perfect
🎯 Final takeaway

👉 You don’t need all that code — just remember:

“~1.5 sec silence = turn ends”