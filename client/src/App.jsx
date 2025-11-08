import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Materials from './pages/Materials';
import Clients from './pages/Clients';
import QuoteBuilder from './pages/QuoteBuilder';
import Import from './pages/Import';
import GmailReviewQueue from './pages/GmailReviewQueue';
import GmailCallback from './pages/GmailCallback';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/materials" element={<Materials />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/quote-builder" element={<QuoteBuilder />} />
          <Route path="/import" element={<Import />} />
          <Route path="/gmail-review" element={<GmailReviewQueue />} />
          <Route path="/gmail/callback" element={<GmailCallback />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
