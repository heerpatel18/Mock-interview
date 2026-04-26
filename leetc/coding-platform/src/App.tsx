import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProblemList from './pages/ProblemList';
import Problem from './pages/Problem';
import Submissions from './pages/Submissions';
import { Code } from 'lucide-react';
import { useEffect, useState } from 'react';

function AppShell() {
  const [isEmbedded, setIsEmbedded] = useState(false);
  const location = useLocation();
  const isProblemRoute = location.pathname.startsWith('/problem/');

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-gradient-to-b from-[#1A1C20] to-[#08090D]">
      {!isEmbedded && (
        <header className="flex-shrink-0 border-b border-gray-700 bg-gradient-to-r from-[#242633] to-[#1A1C20] shadow-lg">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Code className="h-8 w-8 text-blue-400" />
                <span className="text-lg font-bold text-white">Code Hub</span>
              </Link>

              <nav className="flex items-center gap-6">
                <Link
                  to="/"
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-blue-400 transition-colors rounded hover:bg-white/5"
                >
                  📝 Problems
                </Link>

                <Link
                  to="/submissions"
                  className="px-4 py-2 text-sm font-bold bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg hover:shadow-xl"
                >
                  ✅ Submissions
                </Link>
              </nav>
            </div>
          </div>
        </header>
      )}

      <main
        className={`min-h-0 flex-1 overflow-x-hidden ${
          isProblemRoute ? 'overflow-y-auto' : 'overflow-y-auto'
        }`}
      >
        <Routes>
          <Route path="/" element={<ProblemList />} />
          <Route path="/problem/:id" element={<Problem />} />
          <Route path="/submissions" element={<Submissions />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
