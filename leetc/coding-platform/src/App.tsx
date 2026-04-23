// import React from 'react';?
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ProblemList from './pages/ProblemList';
import Problem from './pages/Problem';
import { Code } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-[#1A1C20] to-[#08090D] flex flex-col">
        <header className="bg-gradient-to-r from-[#242633] to-[#1A1C20] border-b border-gray-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link to="/" className="flex items-center">
                <Code className="h-8 w-8 text-blue-400" />
                <span className="ml-2 text-xl font-bold text-white">CodeHarborHub</span>
              </Link>
              <nav className="flex space-x-4">
                <Link to="/" className="text-gray-300 hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Problems
                </Link>
                <a href="#" className="text-gray-300 hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Submissions
                </a>
                <a href="#" className="text-gray-300 hover:text-blue-400 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Leaderboard
                </a>
              </nav>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ProblemList />} />
            <Route path="/problem/:id" element={<Problem />} />
          </Routes>
        </main>


      </div>
    </Router>
  );
}

export default App;