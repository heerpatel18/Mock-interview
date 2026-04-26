import React, { useEffect, useState } from 'react';
import { Code2, Check, X, Clock, AlertCircle, ChevronDown, Eye } from 'lucide-react';
import {
  getAllSubmissions,
  getSubmissionStats,
  formatTimeAgo,
  SubmissionData,
} from '../services/submissionService';

const Submissions: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getSubmissionStats>>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const subs = getAllSubmissions();
    setSubmissions(subs.sort((a, b) => b.submittedAt - a.submittedAt));

    const submissionStats = getSubmissionStats();
    setStats(submissionStats);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-green-900/30 text-green-300 border-green-700';
      case 'Wrong Answer':
        return 'bg-red-900/30 text-red-300 border-red-700';
      case 'Time Limit Exceeded':
        return 'bg-yellow-900/30 text-yellow-300 border-yellow-700';
      case 'Runtime Error':
        return 'bg-red-900/50 text-red-200 border-red-600';
      default:
        return 'bg-gray-900/30 text-gray-300 border-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Accepted':
        return <Check className="h-5 w-5" />;
      case 'Wrong Answer':
        return <X className="h-5 w-5" />;
      case 'Time Limit Exceeded':
        return <Clock className="h-5 w-5" />;
      case 'Runtime Error':
        return <AlertCircle className="h-5 w-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col px-4 py-8 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl">
        {/* 📊 Stats Section */}
        {stats && (
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-[#242633] to-[#1A1C20] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Total Submissions
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {stats.totalSubmissions}
              </div>
            </div>

            <div className="rounded-lg border border-green-700/50 bg-gradient-to-br from-green-900/20 to-[#1A1C20] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-green-300">
                Accepted
              </div>
              <div className="mt-2 text-2xl font-bold text-green-300">
                {stats.submissionsByStatus.Accepted}
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-[#242633] to-[#1A1C20] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Problems Solved
              </div>
              <div className="mt-2 text-2xl font-bold text-blue-300">
                {stats.problemsSolved}
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-[#242633] to-[#1A1C20] p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Success Rate
              </div>
              <div className="mt-2 text-2xl font-bold text-purple-300">
                {stats.totalSubmissions > 0
                  ? Math.round((stats.submissionsByStatus.Accepted / stats.totalSubmissions) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
        )}

        {/* 📝 Submissions List */}
        <div className="rounded-2xl border border-gray-700 bg-gradient-to-r from-[#242633] via-[#1A1C20] to-[#12141b] shadow-xl overflow-hidden flex flex-col">
          <div className="border-b border-gray-700 bg-gradient-to-r from-[#4f557d] to-[#3d4452] px-6 py-4 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-blue-300" />
              <h2 className="text-lg font-bold text-white">
                All Submissions ({submissions.length})
              </h2>
            </div>
          </div>

          {submissions.length === 0 ? (
            <div className="flex items-center justify-center px-6 py-12">
              <div className="text-center">
                <Code2 className="mx-auto h-12 w-12 text-gray-600" />
                <p className="mt-4 text-gray-400">No submissions yet. Start solving problems!</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {submissions.map((submission) => (
                <div key={submission.id} className="bg-[#1A1C20]/50 hover:bg-[#242633]/50 transition-colors">
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === submission.id ? null : submission.id)
                    }
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-700/20 transition-colors"
                  >
                    <div className="flex-1 flex items-center gap-4">
                      {/* Status Icon */}
                      <div
                        className={`flex items-center justify-center rounded-full p-2 border ${getStatusColor(
                          submission.status
                        )}`}
                      >
                        {getStatusIcon(submission.status)}
                      </div>

                      {/* Problem Info */}
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{submission.problemTitle}</h3>
                        <div className="mt-1 flex items-center gap-3 text-sm text-gray-400">
                          <span>{submission.language}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(submission.submittedAt)}</span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="hidden sm:flex items-center gap-2">
                        {submission.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="inline-block text-xs px-2 py-1 bg-gray-700/50 text-gray-300 rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Status Badge */}
                      <div
                        className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${getStatusColor(
                          submission.status
                        )} flex-shrink-0`}
                      >
                        {submission.status === 'Accepted' && (
                          <>
                            <Check className="h-4 w-4" />
                            Accepted
                          </>
                        )}
                        {submission.status === 'Wrong Answer' && (
                          <>
                            <X className="h-4 w-4" />
                            Wrong Answer
                          </>
                        )}
                        {submission.status === 'Time Limit Exceeded' && (
                          <>
                            <Clock className="h-4 w-4" />
                            TLE
                          </>
                        )}
                        {submission.status === 'Runtime Error' && (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            Error
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 transition-transform flex-shrink-0 ${
                        expandedId === submission.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded Details */}
                  {expandedId === submission.id && (
                    <div className="border-t border-gray-700 bg-gray-900/30 px-6 py-4 space-y-4">
                      {/* Execution Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Runtime</p>
                          <p className="mt-1 text-lg font-semibold text-blue-300">
                            {submission.executionTime}ms
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Memory</p>
                          <p className="mt-1 text-lg font-semibold text-purple-300">
                            {submission.memoryUsed}MB
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Submitted</p>
                          <p className="mt-1 text-lg font-semibold text-gray-300">
                            {new Date(submission.submittedAt).toLocaleDateString()} at{' '}
                            {new Date(submission.submittedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      {/* All Tags */}
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider">Tags</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {submission.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block text-xs px-3 py-1 bg-blue-900/30 text-blue-300 border border-blue-700/50 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Code Preview */}
                      {submission.status === 'Accepted' && (
                        <div>
                          <p className="mb-2 text-xs text-gray-400 uppercase tracking-wider">
                            📝 Your Solution
                          </p>
                          <div className="relative rounded-lg border border-gray-700 bg-gray-900/50 max-h-64 overflow-auto">
                            <div className="absolute top-3 right-3 text-xs font-medium text-gray-400 bg-gray-800 px-2 py-1 rounded z-10">
                              {submission.language}
                            </div>
                            <pre className="p-4 text-sm text-gray-300 font-mono">
                              <code>{submission.code}</code>
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Test Results Summary */}
                      {submission.results.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs text-gray-400 uppercase tracking-wider">
                            Test Results ({submission.results.length})
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {submission.results.map((result, idx) => (
                              <div
                                key={idx}
                                className={`rounded border px-3 py-2 text-xs font-mono ${
                                  result.passed
                                    ? 'border-green-700/50 bg-green-900/20 text-green-300'
                                    : 'border-red-700/50 bg-red-900/20 text-red-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>
                                    Test Case {idx + 1} {result.passed ? '✓' : '✗'}
                                  </span>
                                  {!result.isHidden && <span className="text-gray-400">{result.executionTime}ms</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Submissions;
