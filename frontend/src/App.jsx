import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/layout';
import ProtectedRoute from './components/ProtectedRoute';
import TravelLayout from './components/travel/TravelLayout';
import FeedPage from './pages/travel/FeedPage';
import MapPage from './pages/travel/MapPage';
import SavedPage from './pages/travel/SavedPage';
import ProfilePage from './pages/travel/ProfilePage';
import { Home, CreateMemory, MemoryDetail, People, EditMemory, Timeline, Login, Register, Generator, SearchMemory } from './pages';
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
                  <Layout>
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
                  <Layout>
                    <Timeline />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SearchMemory />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/generator"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Generator />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/travel"
              element={
                <ProtectedRoute>
                  <TravelLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/travel/feed" replace />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="map" element={<MapPage />} />
              <Route path="saved" element={<SavedPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

