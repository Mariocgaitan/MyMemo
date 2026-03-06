import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout';
import ProtectedRoute from './components/ProtectedRoute';
import { Home, CreateMemory, MemoryDetail, People, EditMemory, Timeline, Login, Register } from './pages';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout showFAB>
                    <Home />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateMemory />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/memory/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MemoryDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/people"
              element={
                <ProtectedRoute>
                  <Layout>
                    <People />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/memory/:id/edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditMemory />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline"
              element={
                <ProtectedRoute>
                  <Timeline />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

