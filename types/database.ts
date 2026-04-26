export interface InterviewAttempt {
  attemptId: string;
  interviewId: string;
  userId: string;
  role: string;
  language: "en" | "hi";
  createdAt: string;
  scores: {
    overallImpression: number;
    confidenceClarity: number;
    technicalKnowledge: number;
    roleFit: number;
    culturalFit: number;
    communication: number;
    problemSolving: number;
  };
}
