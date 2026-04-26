import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';

interface HintSystemProps {
  hints: string[];
  solution: {
    approach: string;
    complexity: {
      time: string;
      space: string;
    };
    explanation: string;
  };
}

const HintSystem: React.FC<HintSystemProps> = ({ hints, solution }) => {
  const [revealedHints, setRevealedHints] = useState<number[]>([]);
  const [showSolution, setShowSolution] = useState(false);

  const handleRevealHint = (index: number) => {
    if (!revealedHints.includes(index)) {
      setRevealedHints([...revealedHints, index]);
    }
  };

  return (
    <div className="max-h-[28vh] overflow-y-auto rounded-lg border border-gray-700 bg-gradient-to-b from-[#27282f] to-[#242633] p-6 shadow-xl">
      <div className="mb-4 flex items-center">
        <Lightbulb className="mr-2 h-5 w-5 text-yellow-400" />
        <h2 className="text-lg font-semibold text-white">Hints & Solution</h2>
      </div>

      <div className="space-y-4">
        {hints.map((hint, index) => (
          <div
            key={index}
            className="rounded-lg border border-gray-700 p-4 transition-colors hover:border-gray-600"
          >
            <button
              onClick={() => handleRevealHint(index)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="font-medium text-white">Hint #{index + 1}</span>
              {revealedHints.includes(index) ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>
            {revealedHints.includes(index) && <p className="mt-2 text-gray-300">{hint}</p>}
          </div>
        ))}

        <div className="mt-4 border-t border-gray-700 pt-4">
          <button
            onClick={() => setShowSolution(!showSolution)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="font-medium text-white">Solution</span>
            {showSolution ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {showSolution && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="font-medium text-gray-300">Approach:</h3>
                <p className="mt-1 text-gray-400">{solution.approach}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-300">
                  Reference Time Complexity
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    (for guidance only, not part of the evaluation criteria)
                  </span>
                </h3>
                <p className="mt-1 text-gray-400">{solution.complexity.time}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-300">
                  Reference Space Complexity
                  <span className="ml-1 text-xs font-normal text-gray-500">
                    (for guidance only, not part of the evaluation criteria)
                  </span>
                </h3>
                <p className="mt-1 text-gray-400">{solution.complexity.space}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-300">Detailed Explanation:</h3>
                <p className="mt-1 text-gray-400">{solution.explanation}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HintSystem;
