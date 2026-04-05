import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
function initFirebaseAdmin() {
    const apps = getApps();

    if (!apps.length) {
        // Validate required environment variables
        const requiredVars = [
            "FIREBASE_PROJECT_ID",
            "FIREBASE_CLIENT_EMAIL",
            "FIREBASE_PRIVATE_KEY",
        ];

        const missingVars = requiredVars.filter(
            (varName) => !process.env[varName]
        );

        if (missingVars.length > 0) {
            throw new Error(
                `Missing Firebase Admin credentials. Please set these environment variables in your .env.local file:\n${missingVars.join(
                    "\n"
                )}\n\nSee QUICK_REFERENCE.md for setup instructions.`
            );
        }

        try {
            initializeApp({
                credential: cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    // Replace escaped newlines with actual newlines
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(
                        /\\n/g,
                        "\n"
                    ),
                }),
            });
        } catch (error: any) {
            console.error(
                "Failed to initialize Firebase Admin SDK:",
                error.message
            );
            throw new Error(
                `Firebase Admin initialization failed: ${error.message}. Check that FIREBASE_PRIVATE_KEY is correctly formatted in .env.local`
            );
        }
    }

    return {
        auth: getAuth(),
        db: getFirestore(),
    };
}

export const { auth, db } = initFirebaseAdmin();
