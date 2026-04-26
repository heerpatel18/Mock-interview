import React from 'react';
import { Problem } from '../../types/types';
import { Badge } from '../ui/Badge';

interface ProblemDisplayProps {
  problem: Problem;
}

const ProblemDisplay: React.FC<ProblemDisplayProps> = ({ problem }) => {
  const difficultyColor = {
    Easy: 'bg-green-900/40 text-green-300',
    Medium: 'bg-yellow-900/40 text-yellow-300',
    Hard: 'bg-red-900/40 text-red-300',
  }[problem.difficulty];

  return (
    <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gray-700 bg-gradient-to-b from-[#27282f] to-[#242633] shadow-xl">
      <div className="flex flex-col items-start justify-between gap-3 border-b border-gray-700 px-6 py-5 md:flex-row md:items-center">
        <h1 className="text-2xl font-bold text-white">{problem.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge className={difficultyColor}>{problem.difficulty}</Badge>
          {problem.tags.map((tag) => (
            <Badge key={tag} className="bg-blue-900/40 text-blue-300">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="h-full overflow-y-auto px-6 py-5">
        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-blue-300">Problem Statement</h2>
            <p className="whitespace-pre-line text-gray-300">{problem.problemStatement}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-blue-300">Input Format</h2>
            <p className="whitespace-pre-line text-gray-300">{problem.inputFormat}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-blue-300">Output Format</h2>
            <p className="whitespace-pre-line text-gray-300">{problem.outputFormat}</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-blue-300">Constraints</h2>
            <pre className="whitespace-pre-line rounded border border-gray-700 bg-gray-800/50 p-3 text-sm text-gray-300">
              {problem.constraints}
            </pre>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-blue-300">Example Cases</h2>
            {problem.sampleInputs.map((input, index) => (
              <div
                key={index}
                className="mb-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4"
              >
                <div className="mb-2">
                  <h3 className="text-sm font-medium text-gray-400">Input:</h3>
                  <pre className="rounded border border-gray-700 bg-gray-900/50 p-2 text-sm text-gray-300">
                    {input}
                  </pre>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400">Output:</h3>
                  <pre className="rounded border border-gray-700 bg-gray-900/50 p-2 text-sm text-gray-300">
                    {problem.sampleOutputs[index]}
                  </pre>
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProblemDisplay;
