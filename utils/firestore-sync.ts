import { collection, getDocs, query, where } from "firebase/firestore";
import { firebaseDb } from "@/firebase/client";
import type { InterviewAttempt } from "@/types/database";

/**
 * 🔥 STEP 1: Fetch all interviews from Firestore
 * This retrieves the "feedback" collection which contains all attempt records
 */
export const fetchAllInterviewsFromFirestore = async (): Promise<
  Array<InterviewAttempt & { firestoreId: string }>
> => {
  try {
    console.log("🔄 Fetching interviews from Firestore...");
    const snapshot = await getDocs(collection(firebaseDb, "feedback"));

    const data = snapshot.docs.map((doc) => ({
      ...(doc.data() as Omit<InterviewAttempt, "attemptId">),
      firestoreId: doc.id,
      attemptId: doc.id,
    }));

    console.log(`✅ Fetched ${data.length} interviews from Firestore`);
    return data;
  } catch (error) {
    console.error("❌ Error fetching from Firestore:", error);
    throw error;
  }
};

/**
 * 🔥 STEP 2: Fetch interviews by userId from Firestore
 * Only syncs user-specific interviews, more efficient
 */
export const fetchUserInterviewsFromFirestore = async (
  userId: string
): Promise<Array<InterviewAttempt & { firestoreId: string }>> => {
  try {
    const q = query(
      collection(firebaseDb, "feedback"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);

    const data = snapshot.docs.map((doc) => {
      const d = doc.data();

      // ✅ Map categoryScores array to named scores object
      const categoryScores = d.categoryScores ?? [];
      
      const getScore = (name: string) => {
        const found = categoryScores.find(
          (c: any) => c.name?.toLowerCase().includes(name.toLowerCase())
        );
        return found?.score ?? 0;
      };

      const scores = {
        overallImpression: d.totalScore ?? 0,
        confidenceClarity: getScore("Confidence"),
        technicalKnowledge: getScore("Technical"),
        roleFit: getScore("Role"),
        culturalFit: getScore("Cultural"),
        communication: getScore("Communication"),
        problemSolving: getScore("Problem"),
      };

      return {
        attemptId: doc.id,
        firestoreId: doc.id,
        interviewId: d.interviewId ?? doc.id,
        userId: d.userId,
        role: d.role ?? "General",        // feedback doc has no role
        language: d.language ?? "en",
        createdAt: d.createdAt ?? new Date().toISOString(),
        scores,
      } as InterviewAttempt & { firestoreId: string };
    });

    console.log(`✅ Fetched ${data.length} interviews`, data);
    return data;
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
};

/**
 * 🔥 STEP 3: Get last sync timestamp for user
 * Checks if we've already synced this user's data
 */
export const getLastSyncTime = (userId: string): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`sync_timestamp_${userId}`);
};

/**
 * 🔥 STEP 4: Set sync timestamp after successful sync
 * Prevents unnecessary re-syncing
 */
export const setLastSyncTime = (userId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`sync_timestamp_${userId}`, new Date().toISOString());
};

/**
 * 🔥 STEP 5: Check if user data has already been synced
 * Returns true if sync timestamp exists
 */
export const hasUserBeenSynced = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`sync_status_${userId}`) === "synced";
};

/**
 * 🔥 STEP 6: Mark user as synced
 * Sets flag to prevent re-syncing
 */
export const markUserAsSynced = (userId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(`sync_status_${userId}`, "synced");
};
