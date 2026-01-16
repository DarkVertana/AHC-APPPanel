'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'developer' | 'choose' | 'reset'>('developer');
  const [developerEmail, setDeveloperEmail] = useState('');
  const [developerPassword, setDeveloperPassword] = useState('');
  const [resetType, setResetType] = useState<'password' | 'secretKey'>('password');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeveloperPassword, setShowDeveloperPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  useRouter();

  const handleDeveloperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // Verify developer credentials
      const response = await fetch('/api/auth/reset-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developerEmail,
          developerPassword,
          // newPassword is not sent for verification step
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid developer credentials');
        setIsLoading(false);
        return;
      }

      // Developer credentials verified, move to choose step
      setStep('choose');
      setIsLoading(false);
    } catch (error) {
      console.error('Developer verification error:', error);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleChooseReset = (type: 'password' | 'secretKey') => {
    setResetType(type);
    setStep('reset');
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate password if resetting password
    if (resetType === 'password') {
      // Validate passwords match
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }

      // Validate password strength
      if (newPassword.length < 8) {
        setError('Password must be at least 8 characters long');
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await fetch('/api/auth/reset-admin-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          developerEmail,
          developerPassword,
          newPassword: resetType === 'password' ? newPassword : undefined,
          resetSecretKey: resetType === 'secretKey',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset');
    setIsLoading(false);
        return;
      }

      setSuccessMessage(data.message || 'Reset successful');
    setIsSubmitted(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Reset error:', error);
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Weight Loss Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#dfedfb] items-center justify-center overflow-hidden rounded-tr-3xl rounded-br-3xl">
        <div className="w-full h-full relative">
          {/* Weight Loss Image */}
          <Image
            src="/images/ablogin.jpg"
            alt="Weight Loss"
            fill
            className="object-cover rounded-tr-3xl rounded-br-3xl"
            priority
            unoptimized
          />
          {/* Dark Overlay - Stronger at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black/70 rounded-tr-3xl rounded-br-3xl"></div>
          {/* Copyright Text */}
          <div className="absolute bottom-6 left-0 right-0 text-center px-2">
            <p className="text-white text-sm">© 2026 Alternate Health Club. All Rights Reserved.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-[#435970]">
              {step === 'developer' 
                ? 'Developer Verification' 
                : step === 'choose'
                ? 'Choose Reset Option'
                : 'Reset Admin Account'}
            </h1>
            <p className="text-[#7895b3] text-lg">
              {isSubmitted 
                ? successMessage || 'Reset completed successfully!'
                : step === 'developer'
                ? 'Enter your developer credentials to reset admin account'
                : step === 'choose'
                ? 'Select what you want to reset'
                : resetType === 'password'
                ? 'Enter the new password for the admin user'
                : 'This will reset the admin secret key'
              }
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!isSubmitted ? (
            step === 'developer' ? (
              <form onSubmit={handleDeveloperSubmit} className="space-y-6">
                {/* Developer Email Input */}
              <div className="space-y-2">
                  <label htmlFor="developerEmail" className="block text-sm font-medium text-[#435970]">
                    Developer Email
                </label>
                <input
                    id="developerEmail"
                  type="email"
                    value={developerEmail}
                    onChange={(e) => setDeveloperEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent transition-all text-[#435970] placeholder:text-[#7895b3] bg-white"
                    placeholder="developer@example.com"
                />
              </div>

                {/* Developer Password Input */}
                <div className="space-y-2">
                  <label htmlFor="developerPassword" className="block text-sm font-medium text-[#435970]">
                    Developer Password
                  </label>
                  <div className="relative">
                    <input
                      id="developerPassword"
                      type={showDeveloperPassword ? 'text' : 'password'}
                      value={developerPassword}
                      onChange={(e) => setDeveloperPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent transition-all text-[#435970] placeholder:text-[#7895b3] pr-12 bg-white"
                      placeholder="Enter developer password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeveloperPassword(!showDeveloperPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7895b3] hover:text-[#435970] transition-colors"
                    >
                      {showDeveloperPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m3.29 3.29L3 3m0 0l18 18m0 0l-3.29-3.29m-3.29-3.29l3.29 3.29M12 12l-3.29-3.29m3.29 3.29l3.29 3.29" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#435970] text-white py-3 rounded-lg font-semibold hover:bg-[#7895b3] transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                      Verifying...
                  </span>
                ) : (
                    'Verify Developer'
                  )}
                </button>
              </form>
            ) : step === 'choose' ? (
              <div className="space-y-6">
                <div className="grid gap-4">
                  <button
                    onClick={() => handleChooseReset('password')}
                    className="p-6 border-2 border-[#dfedfb] rounded-lg hover:border-[#7895b3] hover:bg-[#dfedfb] transition-all duration-300 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#435970] rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#435970]">Reset Password</h3>
                        <p className="text-sm text-[#7895b3]">Reset the admin user password</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleChooseReset('secretKey')}
                    className="p-6 border-2 border-[#dfedfb] rounded-lg hover:border-[#7895b3] hover:bg-[#dfedfb] transition-all duration-300 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#435970] rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[#435970]">Reset Secret Key</h3>
                        <p className="text-sm text-[#7895b3]">Clear and disable the admin secret key</p>
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('developer');
                    setError('');
                  }}
                  className="w-full border border-[#dfedfb] text-[#435970] py-3 rounded-lg font-semibold hover:bg-[#dfedfb] transition-all duration-300"
                >
                  Back
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetSubmit} className="space-y-6">
                {/* New Password Input - Only show if resetting password */}
                {resetType === 'password' && (
                  <>
                    <div className="space-y-2">
                      <label htmlFor="newPassword" className="block text-sm font-medium text-[#435970]">
                        New Admin Password
                      </label>
                      <div className="relative">
                        <input
                          id="newPassword"
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full px-4 py-3 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent transition-all text-[#435970] placeholder:text-[#7895b3] pr-12 bg-white"
                          placeholder="Enter new password (min 8 characters)"
                        />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7895b3] hover:text-[#435970] transition-colors"
                    >
                      {showNewPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m3.29 3.29L3 3m0 0l18 18m0 0l-3.29-3.29m-3.29-3.29l3.29 3.29M12 12l-3.29-3.29m3.29 3.29l3.29 3.29" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password Input */}
                    <div className="space-y-2">
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#435970]">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full px-4 py-3 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent transition-all text-[#435970] placeholder:text-[#7895b3] pr-12 bg-white"
                          placeholder="Confirm new password"
                        />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7895b3] hover:text-[#435970] transition-colors"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m3.29 3.29L3 3m0 0l18 18m0 0l-3.29-3.29m-3.29-3.29l3.29 3.29M12 12l-3.29-3.29m3.29 3.29l3.29 3.29" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                        </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  </>
                )}

                {/* Secret Key Reset Warning */}
                {resetType === 'secretKey' && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Warning:</strong> This will clear and disable the admin secret key. The admin will need to generate a new secret key in settings after logging in.
                    </p>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('choose');
                      setNewPassword('');
                      setConfirmPassword('');
                      setError('');
                    }}
                    className="flex-1 border border-[#dfedfb] text-[#435970] py-3 rounded-lg font-semibold hover:bg-[#dfedfb] transition-all duration-300"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-[#435970] text-white py-3 rounded-lg font-semibold hover:bg-[#7895b3] transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Resetting...
                      </span>
                    ) : (
                      resetType === 'password' ? 'Reset Password' : 'Reset Secret Key'
                )}
              </button>
                </div>
            </form>
            )
          ) : (
            <div className="space-y-6">
              {/* Success Icon */}
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-[#435970] font-medium">
                  {successMessage || 'Reset completed successfully!'}
                </p>
                <Link
                  href="/login"
                  className="inline-block w-full bg-[#435970] text-white py-3 rounded-lg font-semibold hover:bg-[#7895b3] transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Go to Login
                </Link>
              </div>
            </div>
          )}

          {/* Back to Login Link */}
          <p className="text-center text-sm text-[#7895b3]">
            Remember your password?{' '}
            <Link href="/login" className="font-semibold text-[#435970] hover:text-[#7895b3] transition-colors">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

