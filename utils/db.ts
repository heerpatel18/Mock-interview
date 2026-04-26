import Dexie from "dexie";
import type { InterviewAttempt } from "@/types/database";

export const normalizeInterviewId = (role: string, language: string) => {
  const normalizedRole = role
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const normalizedLanguage = language.trim().toLowerCase() || "en";
  return `${normalizedRole}_${normalizedLanguage}_default`;
};

class InterviewAnalyticsDB extends Dexie {
  interviews!: Dexie.Table<InterviewAttempt, string>;

  constructor() {
    super("InterviewAnalyticsDB");
    this.version(1).stores({
      interviews: "attemptId, interviewId, userId, createdAt",
    });
  }
}

export const db = new InterviewAnalyticsDB();

if (typeof window !== "undefined") {
  (
    window as typeof window & {
      interviewAnalyticsDb?: InterviewAnalyticsDB;
    }
  ).interviewAnalyticsDb = db;
}

export async function saveInterviewAttempt(attempt: InterviewAttempt) {
  console.log("🔥 SAVING INTERVIEW TO INDEXEDDB:", attempt);

  const id = await db.interviews.add(attempt);
  const totalCount = await db.interviews.count();

  console.log("✅ SAVED INTERVIEW TO INDEXEDDB:", {
    attemptId: id,
    totalCount,
    interviewId: attempt.interviewId,
    userId: attempt.userId,
  });

  return id;
}

export async function getAllInterviewAttempts() {
  const attempts = await db.interviews.toArray();
  console.log("📦 ALL INDEXEDDB DATA:", attempts);
  return attempts;
}

export async function getInterviewAttemptsByUserId(userId: string) {
  const allAttempts = await db.interviews.toArray();
  const indexedAttempts = await db.interviews.where("userId").equals(userId).toArray();
  const filteredAttempts = allAttempts.filter((attempt) => attempt.userId === userId);

  console.log("👤 ANALYTICS USER ID:", userId);
  console.log("📇 INDEXED USER MATCHES:", indexedAttempts);
  console.log("🧪 FILTERED USER MATCHES:", filteredAttempts);

  return filteredAttempts.length >= indexedAttempts.length
    ? filteredAttempts
    : indexedAttempts;
}

export async function getAttemptsByInterviewId(interviewId: string) {
  const normalizedInterviewId = interviewId.trim();
  const allAttempts = await db.interviews.toArray();
  const indexedAttempts = await db.interviews
    .where("interviewId")
    .equals(normalizedInterviewId)
    .toArray();
  const filteredAttempts = allAttempts.filter(
    (attempt) => attempt.interviewId?.trim() === normalizedInterviewId
  );

  console.log("🆔 LOOKING UP INTERVIEW ID:", normalizedInterviewId);
  console.log("📇 INDEXED INTERVIEW MATCHES:", indexedAttempts);
  console.log("🧪 FILTERED INTERVIEW MATCHES:", filteredAttempts);

  return filteredAttempts.length >= indexedAttempts.length
    ? filteredAttempts
    : indexedAttempts;
}

/**
 * 🔥 FIRESTORE SYNC FUNCTION
 * Syncs all user interviews from Firestore to IndexedDB
 * ✅ Only syncs if not already synced
 * ✅ Handles duplicates gracefully
 */
export async function syncFirestoreToIndexedDB(userId: string) {
  if (typeof window === "undefined") {
    console.warn("⚠️ DB-SYNC: Sync can only run in browser environment");
    return;
  }

  try {
    console.log(`🔄 DB-SYNC: Starting Firestore sync for user: ${userId}`);
    
    // Import here to avoid circular dependency
    const {
      fetchUserInterviewsFromFirestore,
      hasUserBeenSynced,
      markUserAsSynced,
    } = await import("./firestore-sync");

    // Check if already synced
  const existingData = await db.interviews
  .where("userId")
  .equals(userId)
  .toArray();

const hasValidScores = existingData.some(
  (d) => d.scores && d.scores.overallImpression != null
);

if (hasUserBeenSynced(userId) && existingData.length > 0 && hasValidScores) {
  console.log(`✅ DB-SYNC: Already synced with valid data, skipping...`);
  return;
}

if (existingData.length > 0 && !hasValidScores) {
  console.log(`⚠️ DB-SYNC: Scores missing — clearing and re-syncing...`);
  await db.interviews.clear();
  localStorage.removeItem(`sync_status_${userId}`);
}

console.log(`⚠️ DB-SYNC: No local data → fetching from Firestore...`);

    console.log(`🔄 DB-SYNC: First time sync - fetching from Firestore for user: ${userId}`);

    // Fetch from Firestore
    const firestoreData = await fetchUserInterviewsFromFirestore(userId);
    console.log(`📥 DB-SYNC: Retrieved ${firestoreData.length} records from Firestore`);

    if (firestoreData.length === 0) {
      console.log("ℹ️ DB-SYNC: No interviews found in Firestore for this user");
      markUserAsSynced(userId);
      return;
    }

    // Sync to IndexedDB
    let syncedCount = 0;
    let duplicateCount = 0;

    for (const interview of firestoreData) {
      try {
        // Check if already exists in IndexedDB
        const existing = await db.interviews.get(interview.attemptId);

        if (existing) {
          duplicateCount++;
          console.log(
            `⏭️ DB-SYNC: Skipping duplicate: ${interview.attemptId}`
          );
          continue;
        }

        // Save to IndexedDB
       await db.interviews.put({
  attemptId: interview.attemptId,
  interviewId: interview.interviewId,
  userId: interview.userId,
  role: interview.role,
  language: interview.language,
  createdAt: interview.createdAt,
  scores: interview.scores,
});

        syncedCount++;
        console.log(`✅ DB-SYNC: Saved interview ${interview.attemptId} to IndexedDB`);
      } catch (error) {
        console.error(`⚠️ DB-SYNC: Error syncing interview ${interview.attemptId}:`, error);
      }
    }

    // Mark as synced
    markUserAsSynced(userId);

    console.log(`✅ DB-SYNC: FIRESTORE SYNC COMPLETE:
      📊 Total Firestore records: ${firestoreData.length}
      ✔️ Synced to IndexedDB: ${syncedCount}
      ⏭️ Duplicates skipped: ${duplicateCount}
      👤 User: ${userId}`);

    return { syncedCount, duplicateCount, totalRecords: firestoreData.length };
  } catch (error) {
    console.error("❌ DB-SYNC: Firestore sync failed:", error);
    throw error;
  }
}
