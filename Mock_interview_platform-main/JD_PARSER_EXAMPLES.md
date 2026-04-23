# Integration Examples & Code Snippets

## 🔗 How to Use JD Parser Functions

### Example 1: Basic Usage in Feedback Generation

```typescript
import { extractRoleRequirements, generateRoleFit, getCombinedTechStack } from "@/lib/parser/jdParser";

// In createFeedback function
async function analyzeRoleFit(jdText: string, resumeProjects: any[]) {
  // Step 1: Extract requirements from JD
  const requirements = await extractRoleRequirements(jdText);
  // Output: { skills: ["python", "react"], tools: ["aws"], experience: "3+ years", other_requirements: [] }

  // Step 2: Get combined tech stack from projects
  const techStack = getCombinedTechStack(resumeProjects);
  // Output: ["react", "node.js", "mongodb", "python", "typescript"]

  // Step 3: Generate role fit assessment
  const roleFit = await generateRoleFit({ techStack, requirements });
  // Output: { score: 72, matched_skills: ["python", "react"], missing_skills: ["aws"], comment: "..." }

  return roleFit;
}
```

### Example 2: Using in Resume Mode Interview

```typescript
// In createFeedback with resume mode
const interviewData = await db.collection("interviews").doc(interviewId).get();

if (interviewData.data()?.interviewMode === "resume") {
  // Resume mode - has extracted projects
  const projects = interviewData.data()?.projects; // [{name, tech, fullText}]
  const combinedStack = getCombinedTechStack(projects);
  
  // Now use combinedStack for role fit
  const roleFit = await generateRoleFit({
    techStack: combinedStack,
    roleRequirements: requirements,
  });
}
```

### Example 3: Using in Standard Mode Interview

```typescript
// In createFeedback with standard mode
const interviewData = await db.collection("interviews").doc(interviewId).get();

if (interviewData.data()?.interviewMode === "standard") {
  // Standard mode - use techstack from parameters
  const techStack = interviewData.data()?.techstack || "";
  const parsedStack = Array.isArray(techStack) 
    ? techStack 
    : techStack.split(",").map(t => t.trim());
  
  // Use parsedStack for role fit
  const roleFit = await generateRoleFit({
    techStack: parsedStack,
    roleRequirements: requirements,
  });
}
```

---

## 🎯 Frontend Integration Examples

### Example 1: Display Feedback with 6 Categories

```typescript
// feedback/page.tsx
export default function FeedbackPage({ feedback }: { feedback: Feedback }) {
  const categoryOrder = [
    "Communication Skills",
    "Technical Knowledge",
    "Problem-Solving",
    "Cultural Fit",        // NEW - separate from Role Fit
    "Role Fit",            // NEW - separate category
    "Confidence & Clarity"
  ];

  return (
    <div className="feedback-container">
      {feedback.categoryScores.map((category, index) => (
        <div key={category.name} className="category-card">
          <h3>{category.name}</h3>
          
          {/* Role Fit - Show tech comparison */}
          {category.name === "Role Fit" && (
            <div className="role-fit-details">
              <ScoreBar score={category.score} />
              <p className="comment">{category.comment}</p>
              {/* Optional: Show matched_skills and missing_skills if stored */}
            </div>
          )}

          {/* Cultural Fit - Show behavioral insights */}
          {category.name === "Cultural Fit" && (
            <div className="cultural-fit-details">
              <ScoreBar score={category.score} />
              <p className="comment">{category.comment}</p>
            </div>
          )}

          {/* Other categories - Standard display */}
          {![..., "Role Fit", "Cultural Fit"].includes(category.name) && (
            <div>
              <ScoreBar score={category.score} />
              <p className="comment">{category.comment}</p>
            </div>
          )}
        </div>
      ))}

      {/* Total Score */}
      <div className="total-score">
        <h2>Total Score: {feedback.totalScore}/100</h2>
      </div>

      {/* Strengths & Areas for Improvement */}
      <StrengthsSection items={feedback.strengths} />
      <AreasForImprovementSection items={feedback.areasForImprovement} />
      <FinalAssessmentSection text={feedback.finalAssessment} />
    </div>
  );
}
```

### Example 2: Show Role Fit Tech Comparison

```typescript
// components/RoleFitComparison.tsx
// This could be added to show matched vs missing skills

interface RoleFitComparisonProps {
  matchedSkills: string[];
  missingSkills: string[];
  score: number;
  comment: string;
}

export function RoleFitComparison({
  matchedSkills,
  missingSkills,
  score,
  comment
}: RoleFitComparisonProps) {
  return (
    <div className="role-fit-comparison">
      <div className="header">
        <h3>Role Fit Analysis</h3>
        <span className={`score ${score >= 70 ? 'good' : score >= 45 ? 'okay' : 'poor'}`}>
          {score}/100
        </span>
      </div>

      <div className="summary">{comment}</div>

      {matchedSkills.length > 0 && (
        <div className="matched-section">
          <h4>✓ Matching Skills</h4>
          <SkillTags skills={matchedSkills} variant="success" />
        </div>
      )}

      {missingSkills.length > 0 && (
        <div className="missing-section">
          <h4>✗ Missing Skills</h4>
          <SkillTags skills={missingSkills} variant="warning" />
        </div>
      )}

      <div className="recommendation">
        {score >= 70 ? (
          <p>Strong alignment with role requirements.</p>
        ) : score >= 45 ? (
          <p>Moderate alignment. Training needed for missing skills.</p>
        ) : (
          <p>Significant upskilling required. Consider alternative roles.</p>
        )}
      </div>
    </div>
  );
}
```

---

## 🔌 API Integration Examples

### Example 1: Complete Feedback Flow

```typescript
// lib/actions/general.action.ts flow
export async function createFeedback(params: CreateFeedbackParams) {
  const { interviewId, userId, transcript, feedbackId } = params;

  try {
    // 1. Get interview data with JD and resume/techstack
    const interviewData = await fetchInterviewData(interviewId);
    const jobDescription = interviewData.jobDescription;
    const interviewMode = interviewData.interviewMode;

    // 2. ROLE FIT GENERATION
    console.log("🔍 Starting role fit analysis...");
    
    // 2a. Extract role requirements
    const roleRequirements = await extractRoleRequirements(jobDescription);
    console.log("📋 Role requirements extracted:", roleRequirements);

    // 2b. Get candidate tech stack
    let techStack: string[] = [];
    if (interviewMode === "resume" && interviewData.projects) {
      techStack = getCombinedTechStack(interviewData.projects);
      console.log("💻 Tech stack from resume:", techStack);
    } else if (interviewData.techstack) {
      techStack = Array.isArray(interviewData.techstack)
        ? interviewData.techstack
        : interviewData.techstack.split(",").map(t => t.trim());
      console.log("💻 Tech stack from params:", techStack);
    }

    // 2c. Generate role fit
    const roleFitResult = await generateRoleFit({ techStack, roleRequirements });
    console.log("📊 Role fit result:", roleFitResult);

    // 3. FEEDBACK GENERATION (LLM - all 6 categories)
    console.log("🧠 Generating feedback for 6 categories...");
    const feedbackResponse = await generateFeedbackJson(
      transcript,
      jobDescription,
      interviewMode
    );
    // Output: { totalScore, categoryScores[6], strengths, areas, assessment }

    // 4. OVERRIDE ROLE FIT
    const roleFitIndex = feedbackResponse.categoryScores.findIndex(
      c => c.name === "Role Fit"
    );
    if (roleFitIndex !== -1) {
      feedbackResponse.categoryScores[roleFitIndex] = {
        name: "Role Fit",
        score: roleFitResult.score,
        comment: roleFitResult.comment,
      };
    }

    // 5. SAVE TO FIRESTORE
    await saveToFirestore(feedbackResponse, interviewId, userId);

    return { success: true, feedbackId };
  } catch (error) {
    console.error("❌ Error in feedback generation:", error);
    return { success: false, error: String(error) };
  }
}
```

### Example 2: Error Handling Pattern

```typescript
// Try extract role requirements with error handling
let roleRequirements: RoleRequirements = {
  skills: [],
  tools: [],
  experience: "Not specified",
  other_requirements: [],
};

try {
  if (jobDescription && jobDescription.length > 0) {
    roleRequirements = await extractRoleRequirements(jobDescription);
  }
} catch (error) {
  console.warn("⚠️ Failed to extract role requirements:", error);
  // Continue with empty requirements
}

// Try generate role fit with error handling
let roleFitScore = 50; // Default
let roleFitComment = "Could not evaluate role fit.";

try {
  if (techStack.length > 0 && roleRequirements.skills.length > 0) {
    const result = await generateRoleFit({ techStack, roleRequirements });
    roleFitScore = result.score;
    roleFitComment = result.comment;
  } else {
    roleFitComment = "Not enough information to evaluate role fit.";
  }
} catch (error) {
  console.warn("⚠️ Failed to generate role fit:", error);
  // Score remains at 50
}
```

---

## 📚 Database Query Examples

### Example 1: Fetch Feedback with Both Fit Scores

```typescript
// Get feedback and extract both fit scores
async function getFeedbackWithFitAnalysis(feedbackId: string) {
  const feedback = await db.collection("feedback").doc(feedbackId).get();
  const data = feedback.data() as Feedback;

  // Extract both fit scores
  const culturalFit = data.categoryScores.find(c => c.name === "Cultural Fit");
  const roleFit = data.categoryScores.find(c => c.name === "Role Fit");

  return {
    ...data,
    culturalFitScore: culturalFit?.score ?? 0,
    roleFitScore: roleFit?.score ?? 0,
    fitComparison: {
      cultural: culturalFit?.comment,
      role: roleFit?.comment,
    },
  };
}
```

### Example 2: Query Interviews by Role Fit Range

```typescript
// Note: Role Fit is in nested array, so this requires client-side filtering
async function getInterviewsBySuitability(
  userId: string,
  minRoleFit: number = 60
) {
  // Get all interviews
  const interviews = await db
    .collection("interviews")
    .where("userId", "==", userId)
    .get();

  // Get all feedback
  const feedback = await db
    .collection("feedback")
    .where("userId", "==", userId)
    .get();

  // Filter by role fit score (client-side)
  return interviews.docs.map(doc => {
    const interviewId = doc.id;
    const feedbackDoc = feedback.docs.find(f => 
      f.data().interviewId === interviewId
    );

    const roleFitScore = feedbackDoc?.data().categoryScores.find(
      c => c.name === "Role Fit"
    )?.score ?? 0;

    return {
      interview: { id: interviewId, ...doc.data() },
      roleFitScore,
      suitable: roleFitScore >= minRoleFit,
    };
  });
}
```

---

## 🧪 Testing Examples

### Example 1: Unit Test for getCombinedTechStack

```typescript
import { getCombinedTechStack } from "@/lib/parser/jdParser";

describe("getCombinedTechStack", () => {
  test("merges and deduplicates tech stacks", () => {
    const projects = [
      { name: "Project A", tech: ["React", "TypeScript", "Node.js"] },
      { name: "Project B", tech: ["react", "MongoDB", "Express"] },
    ];

    const result = getCombinedTechStack(projects);

    expect(result).toEqual([
      "express",
      "mongodb",
      "node.js",
      "react",
      "typescript",
    ]);
  });

  test("returns empty array for no projects", () => {
    expect(getCombinedTechStack([])).toEqual([]);
  });

  test("normalizes tech names", () => {
    const projects = [
      { name: "Project", tech: ["  React  ", "NODE.JS", "typescript"] },
    ];

    const result = getCombinedTechStack(projects);

    expect(result).toEqual(["node.js", "react", "typescript"]);
  });
});
```

### Example 2: Integration Test for Role Fit

```typescript
import { generateRoleFit } from "@/lib/parser/jdParser";

describe("generateRoleFit", () => {
  test("scores high for tech match", async () => {
    const result = await generateRoleFit({
      techStack: ["python", "flask", "postgresql", "aws"],
      roleRequirements: {
        skills: ["python", "backend development"],
        tools: ["postgresql", "aws"],
        experience: "3+ years",
        other_requirements: [],
      },
    });

    expect(result.score).toBeGreaterThan(70);
    expect(result.matched_skills.length).toBeGreaterThan(0);
  });

  test("scores low for tech mismatch", async () => {
    const result = await generateRoleFit({
      techStack: ["react", "vue", "javascript"],
      roleRequirements: {
        skills: ["python", "java", "scala"],
        tools: ["hadoop", "spark"],
        experience: "data engineering",
        other_requirements: [],
      },
    });

    expect(result.score).toBeLessThan(35);
    expect(result.missing_skills.length).toBeGreaterThan(0);
  });
});
```

---

## 🔍 Debugging Tips

### Enable Verbose Logging

```typescript
// In general.action.ts, uncomment for detailed logs
console.log("[Feedback] JD extracted:", jobDescription.substring(0, 100));
console.log("[Feedback] Role requirements:", roleRequirements);
console.log("[Feedback] Tech stack:", techStack);
console.log("[Feedback] Role fit result:", roleFitResult);
console.log("[Feedback] LLM response:", text);
console.log("[Feedback] Parsed feedback:", object);
console.log("[Feedback] Final category scores:", object.categoryScores);
```

### Common Issues & Solutions

**Issue:** Role Fit score is always 50
- **Cause:** generateRoleFit failing silently
- **Solution:** Check jdParser imports, verify Groq API key

**Issue:** Category count validation error
- **Cause:** LLM returning 5 categories instead of 6
- **Solution:** Check prompt clarity, increase temperature slightly

**Issue:** Tech stack is empty in standard mode
- **Cause:** techstack not properly split
- **Solution:** Verify interview.techstack format (comma-separated)

**Issue:** Missing skills list is empty
- **Cause:** normalizeResumeText extracting partial tech
- **Solution:** Check resume PDF extraction quality

