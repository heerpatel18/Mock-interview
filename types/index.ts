export interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: SavedMessage[];
  feedbackId?: string;
}

export interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

export interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

export interface SavedMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

export type InterviewMode = "standard" | "resume";

export interface Interview {
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
  /** standard = generic questions; resume = generated from RAG + resume context */
  interviewMode?: InterviewMode;
  jobDescription?: string;
}

export interface Feedback {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

export interface CategoryScore {
  name: string;
  score: number;
  comment: string;
}

export interface AgentProps {
  userName: string;
  userId: string;
  interviewId: string;
  feedbackId?: string;
  type: string;
  questions?: string[];
  language?: "en" | "hi";
}

export interface InterviewCardProps {
  id: string;
  role: string;
  type: string;
  techstack: string[];
  level: string;
  questions: string[];
  finalized: boolean;
  createdAt: string;
  coverImage?: string;
  interviewMode?: InterviewMode;
  companyType?: string;
  jobDescription?: string;
  language?: "en" | "hi";
}

export interface RouteParams {
  params: Promise<{ id: string }>;
}


