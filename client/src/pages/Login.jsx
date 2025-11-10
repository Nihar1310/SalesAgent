import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Phone, Key, AlertCircle, Loader, Sparkles, Clock } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('phone'); // 'phone', 'otp', or 'pending'
  const [pendingApproval, setPendingApproval] = useState(false);
  
  const { loginWithPhone, verifyOtp, registerUser } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate phone number format (E.164)
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Phone number must start with country code (e.g., +91 for India)');
      }

      const confirmation = await loginWithPhone(phoneNumber);
      setConfirmationResult(confirmation);
      setStep('otp');
      setError(null);
    } catch (error) {
      console.error('Error sending OTP:', error);
      setError(error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!confirmationResult) {
        throw new Error('No confirmation result. Please request OTP first.');
      }

      if (otp.length !== 6) {
        throw new Error('OTP must be 6 digits');
      }

      const firebaseUser = await verifyOtp(confirmationResult, otp);
      
      // Register user in SQLite database
      try {
        const result = await registerUser();
        
        // Check if user is pending approval
        if (result?.user?.status === 'pending_approval') {
          setPendingApproval(true);
          setStep('pending');
          return;
        }
        
        // Navigate to dashboard if approved
        navigate('/');
      } catch (regError) {
        // If registration fails, still allow navigation (user might already be registered)
        console.error('Registration error:', regError);
        if (regError.response?.data?.code === 'ACCOUNT_PENDING') {
          setPendingApproval(true);
          setStep('pending');
        } else {
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setError(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setOtp('');
    setError(null);
    setLoading(true);

    try {
      const confirmation = await loginWithPhone(phoneNumber);
      setConfirmationResult(confirmation);
      setError(null);
    } catch (error) {
      console.error('Error resending OTP:', error);
      setError(error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setConfirmationResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      
      <div className="max-w-md w-full relative z-10 animate-fade-in">
        {/* Logo/Header */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-2xl mb-4 animate-glow">
            <Sparkles className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold gradient-text mb-2 font-display">Sales Memory</h1>
          <p className="text-gray-600 text-lg">Quotation Memory System</p>
        </div>

        {/* Login Card */}
        <div className="glass-card p-8 lg:p-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 font-display">
              {step === 'phone' ? 'Sign In' : 'Verify OTP'}
            </h2>
            <p className="text-gray-600 mt-2">
              {step === 'phone' 
                ? 'Enter your registered mobile number' 
                : `OTP sent to ${phoneNumber}`}
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 glass-card border-l-4 border-red-500 p-4 animate-slide-down">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Phone Number Step */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                  disabled={loading}
                  className="input-animated pl-12"
                />
                <p className="mt-2 text-xs text-gray-500 ml-1">
                  Include country code (e.g., +91 for India)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !phoneNumber}
                className="btn-gradient w-full ripple"
              >
                {loading ? (
                  <>
                    <div className="spinner h-5 w-5 mr-2 border-2"></div>
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Send OTP
                  </>
                )}
              </button>
            </form>
          )}

          {/* OTP Verification Step */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  required
                  disabled={loading}
                  autoFocus
                  className="input-animated pl-12 text-center text-2xl tracking-widest font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-gradient w-full ripple"
              >
                {loading ? (
                  <>
                    <div className="spinner h-5 w-5 mr-2 border-2"></div>
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify & Sign In
                  </>
                )}
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
                >
                  ← Change number
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800 font-semibold transition-colors disabled:opacity-50"
                >
                  Resend OTP
                </button>
              </div>
            </form>
          )}

          {/* Pending Approval Step */}
          {step === 'pending' && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="p-4 bg-yellow-100 rounded-full">
                  <Clock className="h-12 w-12 text-yellow-600" />
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Pending Approval</h3>
                <p className="text-gray-600 mb-4">
                  Your account has been created successfully!
                </p>
                <p className="text-gray-600">
                  Please wait for an administrator to approve your access.
                  You will be able to use the system once approved.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Phone:</strong> {phoneNumber}
                </p>
                <p className="text-sm text-blue-800 mt-1">
                  Contact your administrator to expedite the approval process.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setPhoneNumber('');
                  setOtp('');
                  setConfirmationResult(null);
                  setPendingApproval(false);
                }}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                ← Back to login
              </button>
            </div>
          )}

          {/* reCAPTCHA container (invisible) */}
          <div id="recaptcha-container"></div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <p className="text-sm text-gray-600 flex items-center justify-center space-x-2">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>Secure authentication powered by Firebase</span>
          </p>
        </div>
      </div>
    </div>
  );
}

