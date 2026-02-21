import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { Layout } from './components/layout';
import { Home, CreateMemory, MemoryDetail } from './pages';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Home page with FAB */}
          <Route 
            path="/" 
            element={
              <Layout showFAB>
                <Home />
              </Layout>
            } 
          />
          
          {/* Create memory page */}
          <Route 
            path="/create" 
            element={
              <Layout>
                <CreateMemory />
              </Layout>
            } 
          />
          
          {/* Memory detail page */}
          <Route 
            path="/memory/:id" 
            element={
              <Layout>
                <MemoryDetail />
              </Layout>
            } 
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
