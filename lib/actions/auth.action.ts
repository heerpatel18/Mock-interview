// Server-side authentication actions.
// These functions are invoked by frontend components to sign up, sign in,
// sign out, and check the session cookie. They interact with Firebase Admin
// SDK (auth + Firestore) to create users, set session cookies, and fetch
// the current user from the `users` collection.

"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie :- login vakhte direct thai jay e mate signUp vakhte store krisu
export async function setSessionCookie(idToken: string) {
  try {
    const cookieStore = await cookies();

    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION * 1000, // milliseconds
    });

    // Set cookie in the browser
    cookieStore.set("session", sessionCookie, {
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    console.log("✅ Session cookie set successfully");
  } catch (error: any) {
    console.error("❌ Error setting session cookie:", error);
    throw new Error(
      `Failed to set session: ${error.message || "Unknown error"}`
    );
  }
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    // check if user exists in db by uid
    const userRecord = await db.collection("users").doc(uid).get();
    if (userRecord.exists)
      return {
        success: false,
        message: "User already exists. Please sign in.",
      };

    // save user to db
    await db.collection("users").doc(uid).set({
      name,
      email,
    });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  }

  catch (error: any) {
    console.error("Error creating user:", error);

    // Handle Firebase specific errors
    if (error.code === "auth/email-already-exists") {
      return {
        success: false,
        message: "This email is already in use",
      };
    }

    return {
      success: false,
      message: `Failed to create account. Please try again. Error: ${
        error.code || error.message
      }`,
    };
  }
}

// Check if email already exists in Firestore
export async function checkEmailExists(email: string) {
  try {
    const snapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    return {
      exists: !snapshot.empty,
      message: snapshot.empty ? "" : "This email is already registered. Please sign in.",
    };
  } catch (error: any) {
    console.error("Error checking email:", error);
    return {
      exists: false,
      message: "",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    console.log("🔐 Starting sign-in for:", email);

    const userRecord = await auth.getUserByEmail(email);
    if (!userRecord) {
      console.log("❌ User not found in Firebase:", email);
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };
    }

    console.log("✅ User found in Firebase:", email);
    const uid = userRecord.uid;

    // Check if user document exists in Firestore
    const firestoreUser = await db.collection("users").doc(uid).get();

    if (!firestoreUser.exists) {
      console.log(
        "⚠️  User document not found in Firestore, creating it:",
        uid
      );

      // Create user document if it doesn't exist (recovery for incomplete signups)
      await db.collection("users").doc(uid).set({
        name: userRecord.displayName || email.split("@")[0],
        email: userRecord.email,
        createdAt: new Date().toISOString(),
      });

      console.log("✅ User document created in Firestore for:", uid);
    }

    await setSessionCookie(idToken);

    console.log("✅ Sign-in successful for:", email);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Sign in error:", error);

    // Handle specific Firebase Admin SDK errors
    if (
      error.message?.includes("DECODER routines") ||
      error.message?.includes("Failed to get document")
    ) {
      return {
        success: false,
        message:
          "Server configuration error. Please contact support or try again later.",
      };
    }

    if (error.code === "auth/user-not-found") {
      return {
        success: false,
        message: "User does not exist. Create an account.",
      };
    }

    return {
      success: false,
      message: "Failed to log into account. Please try again.",
    };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) {
    console.log("❌ No session cookie found");
    return null; //user doesn't exist
  }

  try {
    console.log("🔍 Verifying session cookie...");
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    console.log("✅ Session cookie verified for UID:", decodedClaims.uid);

    // get user info from db
    const userRecord = await db
      .collection("users")
      .doc(decodedClaims.uid)
      .get();
    
    if (!userRecord.exists) {
      console.log("❌ User document not found in Firestore for UID:", decodedClaims.uid);
      return null;
    }

    console.log("✅ User found in Firestore:", userRecord.data());
    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (error) {
    console.log("❌ Error getting current user:", error);

    // Invalid or expired session
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user; //bool return karva mate
}


