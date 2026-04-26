import React, { useState, useEffect } from 'react';
import { sampleProblems } from '../data/sampleProblems';
import { Link } from 'react-router-dom';
import { ChevronRight, Check } from 'lucide-react';
import {
  getSubmissionStats,
  isProblemCompleted,
} from '../services/submissionService';

const ProblemList: React.FC = () => {
  const [completedProblems, setCompletedProblems] = useState<Set<string>>(new Set());
  const [submissionStats, setSubmissionStats] = useState<ReturnType<typeof getSubmissionStats>>(null);

  useEffect(() => {
    const loadDashboardStats = () => {
      const completed = new Set<string>();
      sampleProblems.forEach((problem) => {
        if (isProblemCompleted(problem.id)) {
          completed.add(problem.id);
        }
      });

      setCompletedProblems(completed);
      setSubmissionStats(getSubmissionStats());
    };

    loadDashboardStats();

    // Refresh when localStorage changes or the user returns from a problem page.
    window.addEventListener('focus', loadDashboardStats);
    window.addEventListener('storage', loadDashboardStats);

    return () => {
      window.removeEventListener('focus', loadDashboardStats);
      window.removeEventListener('storage', loadDashboardStats);
    };
  }, []);

  return (
    <div className="w-full px-4 py-6 lg:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-gray-700 bg-gradient-to-b from-[#27282f] to-[#242633] shadow-xl">
        <div className="border-b border-gray-700 bg-gradient-to-r from-[#4f557d] to-[#3d4452] px-6 py-4 text-white flex-shrink-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Coding Challenges</h1>
              <p className="mt-1 text-sm text-blue-100/80">
                Browse problems and keep an eye on your latest submission progress.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm">
                <span className="text-blue-100/70">Submissions</span>
                <div className="font-semibold text-white">
                  {submissionStats?.totalSubmissions ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-green-400/25 bg-green-500/10 px-3 py-2 text-sm">
                <span className="text-green-100/70">Accepted</span>
                <div className="font-semibold text-green-200">
                  {submissionStats?.submissionsByStatus.Accepted ?? 0}
                </div>
              </div>
              <div className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm">
                <span className="text-blue-100/70">Solved</span>
                <div className="font-semibold text-white">
                  {submissionStats?.problemsSolved ?? 0}
                </div>
              </div>
              <Link
                to="/submissions"
                className="rounded-lg border border-white/15 bg-[#1A1C20]/70 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A1C20]"
              >
                View submissions
              </Link>
            </div>
          </div>
        </div>
        
        <div className="divide-y divide-gray-700">
          {sampleProblems.map((problem) => {
            const isCompleted = completedProblems.has(problem.id);
            return (
              <div key={problem.id} className="flex justify-between items-center p-4 hover:bg-gray-700/30 transition-colors border-gray-700">
                <div className="flex-1 flex items-center gap-4">
                  {/* ✅ Checkmark for completed problems */}
                  {isCompleted && (
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-900/40 border border-green-600">
                        <Check className="h-4 w-4 text-green-300" />
                      </div>
                    </div>
                  )}
                  {!isCompleted && (
                    <div className="flex-shrink-0 h-6 w-6" />
                  )}

                  <div className="flex-1">
                    <Link 
                      to={`/problem/${problem.id}`} 
                      className={`font-medium transition-colors ${
                        isCompleted 
                          ? 'text-green-300 hover:text-green-200' 
                          : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      {problem.title}
                    </Link>
                    <div className="flex items-center mt-1 space-x-2">
                      <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium
                        ${problem.difficulty === 'Easy' ? 'bg-green-900/40 text-green-300' : 
                          problem.difficulty === 'Medium' ? 'bg-yellow-900/40 text-yellow-300' : 
                          'bg-red-900/40 text-red-300'}`}
                      >
                        {problem.difficulty}
                      </span>
                      {problem.tags.map(tag => (
                        <span key={tag} className="text-xs text-gray-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProblemList;
