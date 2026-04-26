import React, { useEffect, useState } from 'react';
import {
  Clock3,
  Lock,
  Minus,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';

import ProblemDisplay from '../components/ProblemDisplay/ProblemDisplay';
import CodeEditor from '../components/CodeEditor/CodeEditor';
import TestResults from '../components/TestResults/TestResults';
import HintSystem from '../components/HintSystem/HintSystem';
import CustomTestCase from '../components/CustomTestCase/CustomTestCase';
import { prepareTestCases } from '../utils/testCaseManager';
import { evaluateCode } from '../services/evaluationService';
import { storeSubmission } from '../services/submissionService';
import { Problem as ProblemType, Feedback, TestResult } from '../types/types';
import { sampleProblems } from '../data/sampleProblems';
import { useTabProctoring } from '../hooks/useTabProctoring';

const TIMER_SELECTION_KEY = 'codingTimerSelectedMinutes';
const TIMER_END_KEY = 'codingTimerEnd';
const TIMER_DURATION_KEY = 'codingTimerDuration';
const TIMER_PENALTY_END_KEY = 'codingTimerPenaltyEnd';
const SESSION_PENALTY_SECONDS = 300;

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const Problem: React.FC = () => {
  const [problem, setProblem] = useState<ProblemType | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [results, setResults] = useState<TestResult[]>([]);
  const [feedback, setFeedback] = useState<Feedback | undefined>(undefined);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [status, setStatus] = useState<
    'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' | 'Evaluating' | null
  >(null);
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [sessionDuration, setSessionDuration] = useState(30 * 60);
  const [sessionTimeLeft, setSessionTimeLeft] = useState(0);
  const [isSessionTimerRunning, setIsSessionTimerRunning] = useState(false);
  const [penaltyTimeLeft, setPenaltyTimeLeft] = useState(0);

  const { isFrozen, formattedTime } = useTabProctoring();

  const isTimedFreezeActive = penaltyTimeLeft > 0;
  const isPageFrozen = isFrozen || isTimedFreezeActive;
  const activeFreezeTime = isTimedFreezeActive
    ? formatDuration(penaltyTimeLeft)
    : formattedTime;
  const freezeTitle = isTimedFreezeActive ? 'Time Limit Reached' : 'Editor Frozen';
  const freezeMessage = isTimedFreezeActive
    ? 'Your coding timer finished, so the workspace is locked for 5 minutes.'
    : 'You left the test window.';
  const canAdjustTimer = !isSessionTimerRunning && !isTimedFreezeActive;
  const timerProgress = sessionDuration > 0
    ? Math.max((sessionTimeLeft / sessionDuration) * 100, 0)
    : 0;

  useEffect(() => {
    setProblem(sampleProblems[0]);
  }, []);

  useEffect(() => {
    const storedMinutes = Number(localStorage.getItem(TIMER_SELECTION_KEY));
    if (Number.isFinite(storedMinutes) && storedMinutes >= 1 && storedMinutes <= 180) {
      setSelectedMinutes(storedMinutes);
    }

    const storedDuration = Number(localStorage.getItem(TIMER_DURATION_KEY));
    if (Number.isFinite(storedDuration) && storedDuration > 0) {
      setSessionDuration(storedDuration);
    }

    const timerEnd = Number(localStorage.getItem(TIMER_END_KEY));
    if (Number.isFinite(timerEnd) && timerEnd > 0) {
      const remaining = Math.floor((timerEnd - Date.now()) / 1000);
      if (remaining > 0) {
        setSessionTimeLeft(remaining);
        setIsSessionTimerRunning(true);
      } else {
        localStorage.removeItem(TIMER_END_KEY);
      }
    }

    const penaltyEnd = Number(localStorage.getItem(TIMER_PENALTY_END_KEY));
    if (Number.isFinite(penaltyEnd) && penaltyEnd > 0) {
      const remainingPenalty = Math.floor((penaltyEnd - Date.now()) / 1000);
      if (remainingPenalty > 0) {
        setPenaltyTimeLeft(remainingPenalty);
      } else {
        localStorage.removeItem(TIMER_PENALTY_END_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TIMER_SELECTION_KEY, String(selectedMinutes));
    if (!isSessionTimerRunning) {
      setSessionDuration(selectedMinutes * 60);
      localStorage.setItem(TIMER_DURATION_KEY, String(selectedMinutes * 60));
    }
  }, [selectedMinutes, isSessionTimerRunning]);

  useEffect(() => {
    if (!isSessionTimerRunning) return;

    const interval = window.setInterval(() => {
      setSessionTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          setIsSessionTimerRunning(false);
          setPenaltyTimeLeft(SESSION_PENALTY_SECONDS);
          localStorage.removeItem(TIMER_END_KEY);
          localStorage.setItem(
            TIMER_PENALTY_END_KEY,
            String(Date.now() + SESSION_PENALTY_SECONDS * 1000)
          );
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isSessionTimerRunning]);

  useEffect(() => {
    if (!penaltyTimeLeft) return;

    const interval = window.setInterval(() => {
      setPenaltyTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          localStorage.removeItem(TIMER_PENALTY_END_KEY);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [penaltyTimeLeft]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
  };

  const updateSelectedMinutes = (nextMinutes: number) => {
    setSelectedMinutes(Math.min(180, Math.max(1, nextMinutes)));
  };

  const startSessionTimer = () => {
    if (isSessionTimerRunning || isTimedFreezeActive) return;

    const durationInSeconds = selectedMinutes * 60;
    setSessionDuration(durationInSeconds);
    setSessionTimeLeft(durationInSeconds);
    setIsSessionTimerRunning(true);
    localStorage.setItem(TIMER_DURATION_KEY, String(durationInSeconds));
    localStorage.setItem(TIMER_END_KEY, String(Date.now() + durationInSeconds * 1000));
  };

  const resetSessionTimer = () => {
    setIsSessionTimerRunning(false);
    setSessionTimeLeft(0);
    setSessionDuration(selectedMinutes * 60);
    localStorage.removeItem(TIMER_END_KEY);
    localStorage.setItem(TIMER_DURATION_KEY, String(selectedMinutes * 60));
  };

  const handleCustomTest = async (input: string) => {
    if (isPageFrozen) return;

    setIsEvaluating(true);
    try {
      const testCase = {
        input,
        expectedOutput: 'Custom test case',
        isHidden: false,
      };
      const { results: customResults } = await evaluateCode(code, language, [testCase]);
      setResults(customResults);
    } catch (error) {
      console.error('[Problem] Custom test failed:', error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleRunCode = async () => {
    if (!problem || isPageFrozen) return;

    setIsEvaluating(true);
    setStatus('Evaluating');
    setResults([]);
    setFeedback(undefined);

    try {
      const testCases = prepareTestCases(problem);
      const visibleTestCases = testCases.filter((testCase) => !testCase.isHidden);

      const { results: runResults, feedback: runFeedback } = await evaluateCode(
        code,
        language,
        visibleTestCases
      );

      setResults(runResults);
      setFeedback(runFeedback);

      if (runResults.every((result) => result.passed)) {
        setStatus('Accepted');
      } else if (
        runResults.some((result) => result.actualOutput.includes('Runtime Error'))
      ) {
        setStatus('Runtime Error');
      } else {
        setStatus('Wrong Answer');
      }
    } catch (error) {
      console.error('[Problem] Run code failed:', error);
      setStatus('Runtime Error');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSubmitSolution = async () => {
    if (!problem || isPageFrozen) return;

    setIsEvaluating(true);
    setStatus('Evaluating');
    setResults([]);
    setFeedback(undefined);

    try {
      const testCases = prepareTestCases(problem);

      const { results: submitResults, feedback: submitFeedback } = await evaluateCode(
        code,
        language,
        testCases
      );

      setResults(submitResults);
      setFeedback(submitFeedback);

      let finalStatus: 'Accepted' | 'Wrong Answer' | 'Time Limit Exceeded' | 'Runtime Error' = 'Wrong Answer';

      if (submitResults.every((result) => result.passed)) {
        finalStatus = 'Accepted';
      } else if (submitResults.some((result) => result.executionTime > 1000)) {
        finalStatus = 'Time Limit Exceeded';
      } else if (
        submitResults.some((result) => result.actualOutput.includes('Runtime Error'))
      ) {
        finalStatus = 'Runtime Error';
      } else {
        finalStatus = 'Wrong Answer';
      }

      setStatus(finalStatus);

      // 🔥 Store the submission in localStorage
      const avgTime = submitResults.reduce((sum, r) => sum + r.executionTime, 0) / submitResults.length;
      const avgMemory = submitResults.reduce((sum, r) => sum + r.memoryUsed, 0) / submitResults.length;

      storeSubmission({
        problemId: problem.id,
        problemTitle: problem.title,
        code,
        language,
        status: finalStatus,
        executionTime: Math.round(avgTime),
        memoryUsed: Math.round(avgMemory),
        tags: problem.tags,
        results: submitResults,
      });

      console.log('📝 Submission stored:', finalStatus);
    } catch (error) {
      console.error('[Problem] Submit solution failed:', error);
      setStatus('Runtime Error');
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!problem) {
    return (
      <div className="flex w-full h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="w-full hide-scrollbar">
      <div className="flex w-full flex-col">
        <div className="shrink-0 border-b border-gray-700 bg-gradient-to-r from-[#242633] via-[#1A1C20] to-[#12141b] p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-300">
                <Clock3 className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-[0.2em]">
                  Coding Session Timer
                </span>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-white">
                {isSessionTimerRunning ? formatDuration(sessionTimeLeft) : 'Not started'}
              </h2>
              <p className="mt-2 text-sm text-gray-400">
                Set your minutes with the plus and minus controls, start the timer,
                and the workspace will freeze for 5 minutes when the countdown ends.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center rounded-2xl border border-gray-600 bg-gray-900/70 p-1">
                <button
                  type="button"
                  onClick={() => updateSelectedMinutes(selectedMinutes - 1)}
                  disabled={!canAdjustTimer}
                  className="rounded-xl p-3 text-gray-200 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Decrease timer minutes"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="min-w-28 px-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedMinutes}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-gray-400">
                    minutes
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateSelectedMinutes(selectedMinutes + 1)}
                  disabled={!canAdjustTimer}
                  className="rounded-xl p-3 text-gray-200 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Increase timer minutes"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={startSessionTimer}
                disabled={isSessionTimerRunning || isTimedFreezeActive}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
              >
                <Play className="h-4 w-4" />
                Start Timer
              </button>

              <button
                type="button"
                onClick={resetSessionTimer}
                disabled={isTimedFreezeActive}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-600 bg-gray-900/70 px-5 py-3 font-medium text-gray-200 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-gray-400">
              <span>{isSessionTimerRunning ? 'Session in progress' : 'Waiting to start'}</span>
              <span>{isSessionTimerRunning ? `${Math.round(timerProgress)}% left` : 'Ready'}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-1000"
                style={{ width: `${isSessionTimerRunning ? timerProgress : 0}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden px-4 py-4 lg:gap-6 lg:grid-cols-2 lg:px-6 lg:py-5">
          <div className="flex flex-col gap-6 overflow-y-auto hide-scrollbar">
            <ProblemDisplay problem={problem} />
            <HintSystem hints={problem.hints} solution={problem.solution} />
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto hide-scrollbar">
            <CodeEditor
              initialCode={code}
              language={language}
              onCodeChange={handleCodeChange}
              onLanguageChange={handleLanguageChange}
              isFrozen={isPageFrozen}
            />

            <CustomTestCase
              onRunTest={handleCustomTest}
              language={language}
              disabled={isPageFrozen}
            />

            <div className="flex-1 overflow-hidden rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="mb-4 flex space-x-4">
                <button
                  onClick={handleRunCode}
                  disabled={isEvaluating || isPageFrozen}
                  className={`flex-1 rounded-lg px-4 py-3 text-center font-medium transition-all duration-200 ${
                    isEvaluating || isPageFrozen
                      ? 'cursor-not-allowed bg-gray-700/50 text-gray-400'
                      : 'bg-blue-600 text-white shadow-lg hover:bg-blue-500 hover:shadow-xl active:bg-blue-700'
                  }`}
                >
                  {isEvaluating ? 'Running...' : 'Run Code'}
                </button>

                <button
                  onClick={handleSubmitSolution}
                  disabled={isEvaluating || isPageFrozen}
                  className={`flex-1 rounded-lg px-4 py-3 text-center font-medium transition-all duration-200 ${
                    isEvaluating || isPageFrozen
                      ? 'cursor-not-allowed bg-gray-700/50 text-gray-400'
                      : 'bg-green-600 text-white shadow-lg hover:bg-green-500 hover:shadow-xl active:bg-green-700'
                  }`}
                >
                  {isEvaluating ? 'Submitting...' : 'Submit Solution'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar">
                <TestResults
                  results={results}
                  isLoading={isEvaluating}
                  feedback={feedback}
                  overallStatus={status}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isPageFrozen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-gradient-to-b from-[#1f2430] to-[#090c12] p-8 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-white">{freezeTitle}</h2>
            <p className="mt-3 text-gray-300">{freezeMessage}</p>
            <div className="mt-5 text-4xl font-mono font-bold text-red-300">
              {activeFreezeTime}
            </div>
            <p className="mt-3 text-sm text-gray-500">
              You can continue after the timer ends.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Problem;
