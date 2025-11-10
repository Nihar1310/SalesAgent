import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import Clients from './pages/Clients';
import QuoteBuilder from './pages/QuoteBuilder';
import Import from './pages/Import';
import GmailReviewQueue from './pages/GmailReviewQueue';
import GmailCallback from './pages/GmailCallback';
import UserManagement from './pages/UserManagement';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/gmail/callback" element={<GmailCallback />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/materials" element={
            <PrivateRoute>
              <Layout>
                <Materials />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/clients" element={
            <PrivateRoute>
              <Layout>
                <Clients />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/quote-builder" element={
            <PrivateRoute>
              <Layout>
                <QuoteBuilder />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/import" element={
            <PrivateRoute>
              <Layout>
                <Import />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/gmail-review" element={
            <PrivateRoute>
              <Layout>
                <GmailReviewQueue />
              </Layout>
            </PrivateRoute>
          } />
          <Route path="/users" element={
            <PrivateRoute>
              <Layout>
                <UserManagement />
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
