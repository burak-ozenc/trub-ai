import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PracticeTools from './pages/PracticeTools';
import Songs from './pages/Songs';
import PlayAlongPage from './pages/PlayAlongPage';
import ExerciseLibrary from './pages/ExerciseLibrary';
import PracticeMode from './pages/PracticeMode';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice-tools"
            element={
              <ProtectedRoute>
                <PracticeTools />
              </ProtectedRoute>
            }
          />
          <Route
            path="/songs"
            element={
              <ProtectedRoute>
                <Songs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/play-along/:songId/:difficulty"
            element={
              <ProtectedRoute>
                <PlayAlongPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/exercises"
            element={
              <ProtectedRoute>
                <ExerciseLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/practice/:exerciseId"
            element={
              <ProtectedRoute>
                <PracticeMode />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
