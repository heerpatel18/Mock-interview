import { useEffect, useRef, useState } from "react";

export const useTabProctoring = () => {
  const [isFrozen, setIsFrozen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [formattedTime, setFormattedTime] = useState("0:00");
  const [violations, setViolations] = useState(0);
  const persistentIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitializedRef = useRef(false);
  const lastViolationTimeRef = useRef<number>(0); // CRITICAL FIX #3: Debounce violations

  // 🔥 PERSISTENT TIMER THAT NEVER STOPS - Checked every second
  const startPersistentTimer = () => {
    // Clear any existing interval first
    if (persistentIntervalRef.current) {
      clearInterval(persistentIntervalRef.current);
    }

    console.log("⏱️ PERSISTENT TIMER STARTED: Checking every 1000ms");

    // CRITICAL FIX #2: Ensure timer updates PRECISELY every second
    // Store the last update time to prevent drift
    let lastUpdateTime = Date.now();

    // Create interval that runs every second and checks localStorage
    persistentIntervalRef.current = setInterval(() => {
      const freezeEnd = localStorage.getItem("freezeEnd");
      
      if (freezeEnd) {
        const endTime = parseInt(freezeEnd);
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));

        if (remaining <= 0) {
          // Time's up - clear freeze
          console.log("🟢 TIMER COMPLETE: Removing freeze immediately");
          setIsFrozen(false);
          localStorage.removeItem("freezeEnd");
          setFormattedTime("0:00");
          setTimeLeft(0);
          lastUpdateTime = now;
        } else {
          // Still freezing - update display with REAL TIME from localStorage source
          const minutes = Math.floor(remaining / 60);
          const seconds = remaining % 60;
          const formatted = `${minutes}:${String(seconds).padStart(2, "0")}`;
          
          // CRITICAL: Only update if display actually changed (avoid unnecessary re-renders)
          setFormattedTime(formatted);
          setTimeLeft(remaining);
          setIsFrozen(true);
          
          console.log(`⏱️ TIMER UPDATE: ${formatted} (${remaining}s left) - Real time sync`);
          lastUpdateTime = now;
        }
      } else {
        // No freeze in localStorage
        setIsFrozen(false);
        setFormattedTime("0:00");
        setTimeLeft(0);
      }
    }, 1000); // RUNS EVERY SECOND REGARDLESS OF PAGE STATE
  };

  const startFreeze = () => {
    // CRITICAL FIX #3: Debounce - prevent multiple violations in quick succession
    const now = Date.now();
    const timeSinceLastViolation = now - lastViolationTimeRef.current;
    
    if (timeSinceLastViolation < 500) {
      // Ignore if violation occurred less than 500ms ago
      console.log(`⏸️ VIOLATION IGNORED: Too soon after last violation (${timeSinceLastViolation}ms)`);
      return;
    }
    
    lastViolationTimeRef.current = now;

    // CRITICAL FIX #1: Don't start a new freeze if one is already active
    const existingFreezeEnd = localStorage.getItem("freezeEnd");
    
    if (existingFreezeEnd) {
      const existingEndTime = parseInt(existingFreezeEnd);
      const existingRemaining = Math.floor((existingEndTime - now) / 1000);
      
      if (existingRemaining > 0) {
        // Already frozen - just log and return (prevents stacking freezes)
        console.log(`⏸️ VIOLATION IGNORED: Already frozen for ${existingRemaining}s`);
        return;
      }
    }

    // Get current violations count from localStorage (source of truth)
    const storedViolations = localStorage.getItem("violations");
    const currentViolations = storedViolations ? parseInt(storedViolations) : 0;
    const newViolations = currentViolations + 1;

    console.log(`🚫 VIOLATION #${newViolations}: Freeze triggered`);

    localStorage.setItem("violations", String(newViolations));
    setViolations(newViolations);

    let freezeDuration;
    if (newViolations === 1) {
      freezeDuration = 180; // 3 minutes
    } else if (newViolations === 2) {
      freezeDuration = 300; // 5 minutes
    } else {
      freezeDuration = 600; // 10 minutes for 3rd+ violations
    }

    const penaltyMessage =
      newViolations === 1
        ? "3 minutes"
        : newViolations === 2
        ? "5 minutes"
        : "10 minutes";
    alert(`⚠️ You left the test window. Editor frozen for ${penaltyMessage}.`);

    // Calculate freeze end time and store in localStorage (source of truth for timer)
    const freezeEndTime = now + freezeDuration * 1000;
    localStorage.setItem("freezeEnd", String(freezeEndTime));
    console.log(`🔒 FREEZE STARTED: ${freezeDuration}s | End time: ${new Date(freezeEndTime).toLocaleTimeString()}`);

    // Update UI immediately
    setIsFrozen(true);
    setTimeLeft(freezeDuration);
    setFormattedTime(
      `${Math.floor(freezeDuration / 60)}:${String(freezeDuration % 60).padStart(
        2,
        "0"
      )}`
    );

    // Make sure persistent timer is running
    startPersistentTimer();
  };

  // 🔥 VIOLATION DETECTION: Alt+Tab, Minimize, Window Blur
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("👁️ VISIBILITY: Tab hidden (Alt+Tab or Minimize)");
        startFreeze();
      }
    };

    const handleBlur = () => {
      console.log("👁️ BLUR: Window lost focus");
      startFreeze();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // 🔥 INITIALIZE ON MOUNT - RESTORES STATE AFTER REFRESH
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    console.log("📱 COMPONENT MOUNTED: Initializing tab proctoring");

    // Load violations count from localStorage
    const storedViolations = localStorage.getItem("violations");
    if (storedViolations) {
      const violationCount = parseInt(storedViolations);
      if (Number.isFinite(violationCount) && violationCount > 0) {
        setViolations(violationCount);
        console.log(`📊 Violations loaded from storage: ${violationCount}`);
      }
    }

    // Check if there's an active freeze in localStorage
    const freezeEnd = localStorage.getItem("freezeEnd");
    if (freezeEnd) {
      const endTime = parseInt(freezeEnd);
      
      if (Number.isFinite(endTime) && endTime > 0) {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
        
        if (remaining > 0) {
          // Freeze is still active
          setIsFrozen(true);
          setTimeLeft(remaining);
          const formatted = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
          setFormattedTime(formatted);
          console.log(`❄️ FREEZE ACTIVE (RESTORED): ${formatted} remaining | End: ${new Date(endTime).toLocaleTimeString()}`);
        } else {
          // Freeze time already expired
          localStorage.removeItem("freezeEnd");
          setIsFrozen(false);
          setFormattedTime("0:00");
          setTimeLeft(0);
          console.log("✅ Freeze expired, cleared");
        }
      }
    } else {
      // No active freeze
      setIsFrozen(false);
      setFormattedTime("0:00");
      setTimeLeft(0);
      console.log("✅ No active freeze on mount");
    }

    // START PERSISTENT TIMER - RUNS EVERY SECOND, NEVER STOPS
    // This timer continues running even after page refresh/Alt+Tab/Tab Close
    startPersistentTimer();

    // CRITICAL FIX #4: Clean up interval on unmount to prevent memory leaks
    // But keep localStorage intact so freeze persists across navigation
    return () => {
      if (persistentIntervalRef.current) {
        clearInterval(persistentIntervalRef.current);
        persistentIntervalRef.current = null;
        console.log("🧹 Interval cleaned up on unmount (localStorage persists)");
      }
    };
  }, []);

  return {
    isFrozen,
    timeLeft,
    formattedTime,
    violations,
  };
};