import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gmailAPI } from '../services/api';

export default function GmailCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      navigate('/gmail-review');
      return;
    }

    gmailAPI
      .handleCallback(code)
      .then(() => navigate('/gmail-review'))
      .catch(() => navigate('/gmail-review?error=auth_failed'));
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="rounded-lg bg-white p-6 shadow">
        <p className="text-sm text-gray-600">Connecting your Gmail account...</p>
      </div>
    </div>
  );
}

