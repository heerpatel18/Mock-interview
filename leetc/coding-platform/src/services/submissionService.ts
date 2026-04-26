import { CodeSubmission, TestResult } from '../types/types';

const SUBMISSIONS_STORAGE_KEY = 'coding_submissions';
const PROBLEM_COMPLETION_KEY = 'problem_completion_';

/**
 * 📝 Submissions Service - Manages storing and retrieving code submissions
 */

export interface SubmissionData {
  id: string;
  problemId: string;
  problemTitle: string;
  code: string;
  language: string;
  status: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error';
  executionTime: number;
  memoryUsed: number;
  submittedAt: number; // timestamp
  tags: string[];
  results: TestResult[];
}

/**
 * Store a code submission
 */
export const storeSubmission = (submission: Omit<SubmissionData, 'id' | 'submittedAt'>) => {
  try {
    const submissions = getAllSubmissions();
    const newSubmission: SubmissionData = {
      ...submission,
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      submittedAt: Date.now(),
    };

    submissions.push(newSubmission);
    localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(submissions));

    // Mark problem as completed if status is "Accepted"
    if (submission.status === 'Accepted') {
      markProblemAsCompleted(submission.problemId);
    }

    console.log('✅ Submission stored:', newSubmission.id);
    return newSubmission;
  } catch (error) {
    console.error('❌ Failed to store submission:', error);
    return null;
  }
};

/**
 * Get all submissions
 */
export const getAllSubmissions = (): SubmissionData[] => {
  try {
    const stored = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('❌ Failed to get submissions:', error);
    return [];
  }
};

/**
 * Get submissions for a specific problem
 */
export const getSubmissionsForProblem = (problemId: string): SubmissionData[] => {
  try {
    const submissions = getAllSubmissions();
    return submissions.filter((sub) => sub.problemId === problemId).sort((a, b) => b.submittedAt - a.submittedAt);
  } catch (error) {
    console.error('❌ Failed to get submissions for problem:', error);
    return [];
  }
};

/**
 * Get the latest accepted submission for a problem
 */
export const getAcceptedSolutionForProblem = (problemId: string): SubmissionData | null => {
  try {
    const submissions = getSubmissionsForProblem(problemId);
    return submissions.find((sub) => sub.status === 'Accepted') || null;
  } catch (error) {
    console.error('❌ Failed to get accepted solution:', error);
    return null;
  }
};

/**
 * Get all recent submissions (latest first)
 */
export const getRecentSubmissions = (limit: number = 20): SubmissionData[] => {
  try {
    const submissions = getAllSubmissions();
    return submissions.sort((a, b) => b.submittedAt - a.submittedAt).slice(0, limit);
  } catch (error) {
    console.error('❌ Failed to get recent submissions:', error);
    return [];
  }
};

/**
 * Mark a problem as completed (all test cases passed)
 */
export const markProblemAsCompleted = (problemId: string) => {
  try {
    localStorage.setItem(`${PROBLEM_COMPLETION_KEY}${problemId}`, JSON.stringify({ completedAt: Date.now() }));
    console.log('✅ Problem marked as completed:', problemId);
  } catch (error) {
    console.error('❌ Failed to mark problem as completed:', error);
  }
};

/**
 * Check if a problem is completed
 */
export const isProblemCompleted = (problemId: string): boolean => {
  try {
    const completed = localStorage.getItem(`${PROBLEM_COMPLETION_KEY}${problemId}`);
    return !!completed;
  } catch (error) {
    console.error('❌ Failed to check problem completion:', error);
    return false;
  }
};

/**
 * Get all completed problem IDs
 */
export const getCompletedProblems = (): string[] => {
  try {
    const completedProblems: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PROBLEM_COMPLETION_KEY)) {
        const problemId = key.replace(PROBLEM_COMPLETION_KEY, '');
        completedProblems.push(problemId);
      }
    }
    return completedProblems;
  } catch (error) {
    console.error('❌ Failed to get completed problems:', error);
    return [];
  }
};

/**
 * Get submission statistics
 */
export const getSubmissionStats = () => {
  try {
    const submissions = getAllSubmissions();
    const completed = getCompletedProblems();

    return {
      totalSubmissions: submissions.length,
      acceptedSubmissions: submissions.filter((s) => s.status === 'Accepted').length,
      problemsSolved: completed.length,
      submissionsByStatus: {
        Accepted: submissions.filter((s) => s.status === 'Accepted').length,
        'Wrong Answer': submissions.filter((s) => s.status === 'Wrong Answer').length,
        'Time Limit Exceeded': submissions.filter((s) => s.status === 'Time Limit Exceeded').length,
        'Runtime Error': submissions.filter((s) => s.status === 'Runtime Error').length,
      },
      submissionsByLanguage: submissions.reduce(
        (acc, sub) => {
          acc[sub.language] = (acc[sub.language] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  } catch (error) {
    console.error('❌ Failed to get submission stats:', error);
    return null;
  }
};

/**
 * Format time relative to now (e.g., "just now", "2 hours ago")
 */
export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  const date = new Date(timestamp);
  return date.toLocaleDateString();
};
