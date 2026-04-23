import React from 'react';
import { sampleProblems } from '../data/sampleProblems';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const ProblemList: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-gradient-to-b from-[#27282f] to-[#242633] rounded-lg shadow-xl overflow-hidden border border-gray-700">
        <div className="px-6 py-4 bg-gradient-to-r from-[#4f557d] to-[#3d4452] text-white border-b border-gray-700">
          <h1 className="text-xl font-bold text-white">Coding Challenges</h1>
        </div>
        
        <div className="divide-y divide-gray-700">
          {sampleProblems.map((problem) => (
            <div key={problem.id} className="flex justify-between items-center p-4 hover:bg-gray-700/30 transition-colors border-gray-700">
              <div className="flex-1">
                <Link 
                  to={`/problem/${problem.id}`} 
                  className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
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
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProblemList;