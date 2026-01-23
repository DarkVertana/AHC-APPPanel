'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

type ApiKey = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  const [activeTab, setActiveTab] = useState('general');
  const [secretTokens, setSecretTokens] = useState<{ id: string; name: string; token: string; isLoginToken: boolean; createdAt: string; lastUsed: string | null }[]>([]);
  const [isSecretTokenModalOpen, setIsSecretTokenModalOpen] = useState(false);
  const [newSecretTokenName, setNewSecretTokenName] = useState('');
  const [newSecretToken, setNewSecretToken] = useState<string | null>(null);
  const [isLoginToken, setIsLoginToken] = useState(true); // Default to login token
  const [showSecretToken, setShowSecretToken] = useState<{ [key: string]: boolean }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      alert('Please enter a name for the API key');
      return;
    }

    try {
      const response = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newApiKeyName }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewApiKey(data.apiKey.key);
    setNewApiKeyName('');
    setIsApiKeyModalOpen(true);
        // Refresh API keys list
        const keysResponse = await fetch('/api/settings/api-keys');
        if (keysResponse.ok) {
          const keysData = await keysResponse.json();
          setApiKeys(keysData.map((key: any) => ({
            id: key.id,
            name: key.name,
            key: key.keyPrefix + '••••••••••••••••••••••••••••••••',
            createdAt: new Date(key.createdAt).toISOString().split('T')[0],
            lastUsed: key.lastUsed ? new Date(key.lastUsed).toISOString().split('T')[0] : null,
          })));
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('An error occurred while creating the API key');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/settings/api-keys?id=${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
      setApiKeys(apiKeys.filter(key => key.id !== id));
          alert('API key deleted successfully');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete API key');
        }
      } catch (error) {
        console.error('Error deleting API key:', error);
        alert('An error occurred while deleting the API key');
      }
    }
  };

  const handleCopyApiKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard!');
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKey(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateSecretToken = async () => {
    if (!newSecretTokenName.trim()) {
      alert('Please enter a name for the secret token');
      return;
    }

    try {
      const response = await fetch('/api/settings/secret-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
      name: newSecretTokenName,
          isLoginToken: isLoginToken,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewSecretToken(data.secretToken.token);
    setNewSecretTokenName('');
        setIsLoginToken(true); // Reset to default
    setIsSecretTokenModalOpen(true);
        // Refresh secret tokens list
        const tokensResponse = await fetch('/api/settings/secret-tokens');
        if (tokensResponse.ok) {
          const tokensData = await tokensResponse.json();
          setSecretTokens(tokensData.map((token: any) => ({
            id: token.id,
            name: token.name,
            token: token.tokenPrefix + '••••••••••••••••••••••••••••••••',
            isLoginToken: token.isLoginToken || false,
            createdAt: new Date(token.createdAt).toISOString().split('T')[0],
            lastUsed: token.lastUsed ? new Date(token.lastUsed).toISOString().split('T')[0] : null,
          })));
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create secret token');
      }
    } catch (error) {
      console.error('Error creating secret token:', error);
      alert('An error occurred while creating the secret token');
    }
  };

  const handleDeleteSecretToken = async (id: string) => {
    if (confirm('Are you sure you want to delete this secret token? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/settings/secret-tokens?id=${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
      setSecretTokens(secretTokens.filter(token => token.id !== id));
          alert('Secret token deleted successfully');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to delete secret token');
        }
      } catch (error) {
        console.error('Error deleting secret token:', error);
        alert('An error occurred while deleting the secret token');
      }
    }
  };

  const handleCopySecretToken = (token: string) => {
    navigator.clipboard.writeText(token);
    alert('Secret token copied to clipboard!');
  };

  const toggleShowSecretToken = (id: string) => {
    setShowSecretToken(prev => ({ ...prev, [id]: !prev[id] }));
  };


  const [settings, setSettings] = useState({
    // General Settings
    adminEmail: session?.user?.email || '',
    timezone: 'America/New_York',

    // Security Settings
    sessionTimeout: 30,
    requireStrongPassword: true,
    enableTwoFactor: false,
    
    // WooCommerce API Settings
    woocommerceApiUrl: '',
    woocommerceApiKey: '',
    woocommerceApiSecret: '',
    
    // FCM Settings for Push Notifications
    fcmServerKey: '',
    fcmProjectId: '',
  });

  // Fetch settings on mount and update email when session is available
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(prev => ({
            adminEmail: session?.user?.email || prev.adminEmail,
            timezone: data.timezone || 'America/New_York',
            sessionTimeout: data.sessionTimeout || 30,
            requireStrongPassword: data.requireStrongPassword ?? true,
            enableTwoFactor: data.enableTwoFactor ?? false,
            woocommerceApiUrl: data.woocommerceApiUrl || '',
            woocommerceApiKey: data.woocommerceApiKey || '',
            woocommerceApiSecret: data.woocommerceApiSecret || '',
            fcmServerKey: data.fcmServerKey || '',
            fcmProjectId: data.fcmProjectId || '',
          }));
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [session?.user?.email]);

  // Fetch API keys on mount and when tab changes
  useEffect(() => {
    if (activeTab === 'api-keys') {
      const fetchApiKeys = async () => {
        try {
          const response = await fetch('/api/settings/api-keys');
          if (response.ok) {
            const data = await response.json();
            setApiKeys(data.map((key: any) => ({
              id: key.id,
              name: key.name,
              key: key.keyPrefix + '••••••••••••••••••••••••••••••••',
              createdAt: new Date(key.createdAt).toISOString().split('T')[0],
              lastUsed: key.lastUsed ? new Date(key.lastUsed).toISOString().split('T')[0] : null,
            })));
          }
        } catch (error) {
          console.error('Error fetching API keys:', error);
        }
      };
      fetchApiKeys();
    }
  }, [activeTab]);

  // Fetch secret tokens on mount and when tab changes
  useEffect(() => {
    if (activeTab === 'security') {
      const fetchSecretTokens = async () => {
        try {
          const response = await fetch('/api/settings/secret-tokens');
          if (response.ok) {
            const data = await response.json();
            setSecretTokens(data.map((token: any) => ({
              id: token.id,
              name: token.name,
              token: token.tokenPrefix + '••••••••••••••••••••••••••••••••',
              createdAt: new Date(token.createdAt).toISOString().split('T')[0],
              lastUsed: token.lastUsed ? new Date(token.lastUsed).toISOString().split('T')[0] : null,
            })));
          }
        } catch (error) {
          console.error('Error fetching secret tokens:', error);
        }
      };
      fetchSecretTokens();
    }
  }, [activeTab]);

  const handleInputChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      alert('New password must be at least 8 characters long');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New password and confirm password do not match');
      return;
    }

    setIsChangingPassword(true);
    
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        alert('Password changed successfully!');
        // Reset password fields
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        setShowPasswordFields(false);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('An error occurred while changing password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      // Update user email if it has changed
      const currentEmail = session?.user?.email;
      if (settings.adminEmail && settings.adminEmail !== currentEmail) {
        const emailResponse = await fetch('/api/user/update-email', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: settings.adminEmail }),
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.json();
          alert(error.error || 'Failed to update email');
          setIsSaving(false);
          return;
        }
      }

      // Update settings (excluding adminEmail as it's now user-specific)
      const { adminEmail, ...settingsToSave } = settings;
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsToSave),
      });

      if (response.ok) {
    alert('Settings saved successfully!');
        // Refresh the page to update session with new email
        if (settings.adminEmail && settings.adminEmail !== currentEmail) {
          window.location.reload();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('An error occurred while saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      // Reset to default values
      setSettings({
        adminEmail: 'admin@alternatehealthclub.com',
        timezone: 'America/New_York',
        sessionTimeout: 30,
        requireStrongPassword: true,
        enableTwoFactor: false,
        woocommerceApiUrl: '',
        woocommerceApiKey: '',
        woocommerceApiSecret: '',
        fcmServerKey: '',
        fcmProjectId: '',
      });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const entitiesParam = selectedEntities.join(',');
      const response = await fetch(`/api/backup/export?entities=${entitiesParam}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('Backup exported successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to export backup');
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('An error occurred while exporting backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert('Please select a backup file to import');
      return;
    }

    if (confirm(`Are you sure you want to import backup data? This will ${importMode === 'replace' ? 'replace all existing data' : importMode === 'merge' ? 'merge with existing data' : 'skip existing records'}.`)) {
      setIsImporting(true);
      setImportResult(null);
      
      try {
        const fileContent = await importFile.text();
        const backupData = JSON.parse(fileContent);
        
        const response = await fetch('/api/backup/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entities: backupData.entities,
            options: {
              mode: importMode,
              importEntities: selectedEntities,
            },
          }),
        });

        const result = await response.json();
        setImportResult(result);
        
        if (result.success) {
          alert('Backup imported successfully!');
          // Optionally refresh the page or show a success message
        } else {
          alert('Import completed with some errors. Check the results below.');
        }
      } catch (error: any) {
        console.error('Import error:', error);
        alert(`Failed to import backup: ${error.message || 'Invalid backup file'}`);
      } finally {
        setIsImporting(false);
      }
    }
  };

  const toggleEntity = (entity: string) => {
    setSelectedEntities(prev =>
      prev.includes(entity)
        ? prev.filter(e => e !== entity)
        : [...prev, entity]
    );
  };

  const handleDataReset = async () => {
    if (!confirm('WARNING: This will permanently delete ALL data including users, medicines, blogs, FAQs, and notifications. This action cannot be undone. Are you sure?')) {
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch('/api/backup/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully deleted ${result.totalDeleted} records`);
      } else {
        alert(result.error || 'Failed to reset data');
      }
    } catch (error: any) {
      console.error('Reset error:', error);
      alert(`Failed to reset data: ${error.message || 'Unknown error'}`);
    } finally {
      setIsResetting(false);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace' | 'skip-existing'>('merge');
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['medicines', 'medicine-categories', 'blogs', 'faqs', 'notifications']);
  const [importResult, setImportResult] = useState<any>(null);

  // Data Reset States
  const [isResetting, setIsResetting] = useState(false);

  const tabs = [
    { id: 'general', name: 'General', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
    { id: 'security', name: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { id: 'api-keys', name: 'API Keys', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
    { id: 'woocommerce', name: 'WooCommerce', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { id: 'backup', name: 'Backup & Restore', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-[#435970] mb-1">Settings</h3>
          <p className="text-[#7895b3]">Manage system settings, security, and integrations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-[#dfedfb] overflow-hidden">
        <div className="border-b border-[#dfedfb]">
          <nav className="flex overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#435970] text-[#435970] bg-[#dfedfb]/30'
                    : 'border-transparent text-[#7895b3] hover:text-[#435970] hover:border-[#7895b3]'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Settings Tab */}
        {activeTab === 'general' && (
          <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
            <h4 className="text-lg font-semibold text-[#435970] mb-4">General Settings</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="adminEmail" className="block text-sm font-medium text-[#435970] mb-2">
                Your Email
              </label>
              <input
                type="email"
                id="adminEmail"
                value={settings.adminEmail}
                onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                placeholder="your@email.com"
              />
              <p className="text-xs text-[#7895b3] mt-1">Update your account email address</p>
            </div>

            {/* Password Change Section */}
            <div className="pt-6 border-t border-[#dfedfb]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h5 className="text-base font-semibold text-[#435970]">Change Password</h5>
                  <p className="text-xs text-[#7895b3] mt-1">Update your account password</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordFields(!showPasswordFields);
                    if (showPasswordFields) {
                      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    }
                  }}
                  className="px-4 py-2 text-sm text-[#435970] border border-[#dfedfb] rounded-lg hover:bg-[#dfedfb] transition-colors"
                >
                  {showPasswordFields ? 'Cancel' : 'Change Password'}
                </button>
              </div>

              {showPasswordFields && (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-[#435970] mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                      placeholder="Enter current password"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-[#435970] mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                      placeholder="Enter new password (min. 8 characters)"
                      minLength={8}
                      required
                    />
                    <p className="text-xs text-[#7895b3] mt-1">Password must be at least 8 characters long</p>
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#435970] mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isChangingPassword ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div>
              <label htmlFor="timezone" className="block text-sm font-medium text-[#435970] mb-2">
                Timezone
              </label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] bg-white"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>

          </div>
          </div>
        )}

        {/* Security Settings Tab */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
            <h4 className="text-lg font-semibold text-[#435970] mb-4">Security Settings</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="sessionTimeout" className="block text-sm font-medium text-[#435970] mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                id="sessionTimeout"
                min="5"
                max="1440"
                value={settings.sessionTimeout}
                onChange={(e) => handleInputChange('sessionTimeout', parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970]"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="requireStrongPassword" className="text-sm font-medium text-[#435970]">
                  Require Strong Password
                </label>
                <p className="text-xs text-[#7895b3]">Enforce password complexity requirements</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="requireStrongPassword"
                  checked={settings.requireStrongPassword}
                  onChange={(e) => handleInputChange('requireStrongPassword', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#7895b3] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#435970]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="enableTwoFactor" className="text-sm font-medium text-[#435970]">
                  Enable Two-Factor Authentication
                </label>
                <p className="text-xs text-[#7895b3]">Require 2FA for admin accounts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="enableTwoFactor"
                  checked={settings.enableTwoFactor}
                  onChange={(e) => handleInputChange('enableTwoFactor', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#7895b3] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#435970]"></div>
              </label>
            </div>

            {/* Secret Token Management */}
            <div className="mt-8 pt-6 border-t border-[#dfedfb]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h5 className="text-base font-semibold text-[#435970]">Secret Tokens for Login</h5>
                  <p className="text-xs text-[#7895b3] mt-1">Generate secure tokens that will be required for login authentication</p>
                </div>
              </div>

              {/* Create Secret Token Form */}
              <div className="mb-6 p-4 bg-[#dfedfb]/30 rounded-lg border border-[#dfedfb]">
                <label htmlFor="secretTokenName" className="block text-sm font-medium text-[#435970] mb-2">
                  Token Name
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    id="secretTokenName"
                    value={newSecretTokenName}
                    onChange={(e) => setNewSecretTokenName(e.target.value)}
                    placeholder="e.g., Login Token, Backup Token"
                    className="flex-1 px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateSecretToken}
                    disabled={!newSecretTokenName.trim()}
                    className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isLoginToken"
                    checked={isLoginToken}
                    onChange={(e) => setIsLoginToken(e.target.checked)}
                    className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                  />
                  <label htmlFor="isLoginToken" className="text-sm text-[#435970]">
                    Use this token for login authentication
                  </label>
                </div>
                <p className="text-xs text-[#7895b3] mt-2">If enabled, this token will be required during login. Only one login token can be active at a time.</p>
              </div>

              {/* Secret Tokens List */}
              <div className="space-y-3">
                {secretTokens.length === 0 ? (
                  <div className="text-center py-8 text-[#7895b3]">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <p>No secret tokens generated yet</p>
                    <p className="text-xs mt-1">Generate your first secret token to get started</p>
                  </div>
                ) : (
                  secretTokens.map((token) => (
                    <div key={token.id} className="border border-[#dfedfb] rounded-lg p-4 hover:bg-[#dfedfb]/20 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h6 className="font-semibold text-[#435970]">{token.name}</h6>
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">Active</span>
                            {token.isLoginToken && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">Login Token</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <code className="text-sm font-mono bg-[#dfedfb] px-3 py-1.5 rounded text-[#435970] flex-1">
                              {showSecretToken[token.id] ? token.token : token.token.replace(/[^_]/g, '•')}
                            </code>
                            <button
                              type="button"
                              onClick={() => toggleShowSecretToken(token.id)}
                              className="px-3 py-1.5 text-sm text-[#7895b3] hover:text-[#435970] transition-colors"
                              title={showSecretToken[token.id] ? 'Hide token' : 'Show token'}
                            >
                              {showSecretToken[token.id] ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m3.29 3.29L3 3m0 0l18 18m0 0l-3.29-3.29m-3.29-3.29l3.29 3.29M12 12l-3.29-3.29m3.29 3.29l3.29 3.29" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopySecretToken(token.token)}
                              className="px-3 py-1.5 text-sm text-[#7895b3] hover:text-[#435970] transition-colors"
                              title="Copy token"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-[#7895b3]">
                            <span>Created: {token.createdAt}</span>
                            {token.lastUsed && <span>Last used: {token.lastUsed}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteSecretToken(token.id)}
                          className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                          title="Delete token"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Info Box */}
              <div className="mt-6 bg-[#dfedfb]/50 rounded-lg p-4">
                <p className="text-sm text-[#435970] font-medium mb-2">Secret Token Usage:</p>
                <ul className="text-xs text-[#7895b3] list-disc list-inside space-y-1">
                  <li>Tokens are generated using 256-bit (AES-256) encryption standards</li>
                  <li>Login tokens are required during login authentication</li>
                  <li>Only one login token can be active at a time - creating a new login token will deactivate the previous one</li>
                  <li>Keep your secret tokens secure and never share them publicly</li>
                  <li>Each token can be revoked independently</li>
                  <li>Tokens are shown only once when generated - save them securely</li>
                </ul>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* API Key Management Tab */}
        {activeTab === 'api-keys' && (
          <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-[#435970]">API Key Management</h4>
            <button
              type="button"
              onClick={handleCreateApiKey}
              className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Generate New Key
            </button>
          </div>

          {/* Create API Key Form */}
          <div className="mb-6 p-4 bg-[#dfedfb]/30 rounded-lg border border-[#dfedfb]">
            <label htmlFor="apiKeyName" className="block text-sm font-medium text-[#435970] mb-2">
              Key Name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="apiKeyName"
                value={newApiKeyName}
                onChange={(e) => setNewApiKeyName(e.target.value)}
                placeholder="e.g., Production API, Development API"
                className="flex-1 px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
              />
              <button
                type="button"
                onClick={handleCreateApiKey}
                disabled={!newApiKeyName.trim()}
                className="px-4 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate
              </button>
            </div>
            <p className="text-xs text-[#7895b3] mt-2">Give your API key a descriptive name to identify its purpose</p>
          </div>

          {/* API Keys List */}
          <div className="space-y-3">
            {apiKeys.length === 0 ? (
              <div className="text-center py-8 text-[#7895b3]">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <p>No API keys generated yet</p>
                <p className="text-xs mt-1">Generate your first API key to get started</p>
              </div>
            ) : (
              apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="border border-[#dfedfb] rounded-lg p-4 hover:bg-[#dfedfb]/20 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-semibold text-[#435970]">{apiKey.name}</h5>
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">Active</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-mono bg-[#dfedfb] px-3 py-1.5 rounded text-[#435970] flex-1">
                          {showApiKey[apiKey.id] ? apiKey.key : apiKey.key.replace(/[^_]/g, '•')}
                        </code>
                        <button
                          type="button"
                          onClick={() => toggleShowApiKey(apiKey.id)}
                          className="px-3 py-1.5 text-sm text-[#7895b3] hover:text-[#435970] transition-colors"
                          title={showApiKey[apiKey.id] ? 'Hide key' : 'Show key'}
                        >
                          {showApiKey[apiKey.id] ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m3.29 3.29L3 3m0 0l18 18m0 0l-3.29-3.29m-3.29-3.29l3.29 3.29M12 12l-3.29-3.29m3.29 3.29l3.29 3.29" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyApiKey(apiKey.key)}
                          className="px-3 py-1.5 text-sm text-[#7895b3] hover:text-[#435970] transition-colors"
                          title="Copy key"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#7895b3]">
                        <span>Created: {apiKey.createdAt}</span>
                        {apiKey.lastUsed && <span>Last used: {apiKey.lastUsed}</span>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteApiKey(apiKey.id)}
                      className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                      title="Delete key"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-[#dfedfb]/50 rounded-lg p-4">
            <p className="text-sm text-[#435970] font-medium mb-2">API Key Usage:</p>
            <ul className="text-xs text-[#7895b3] list-disc list-inside space-y-1">
              <li>Use API keys to authenticate requests to the API</li>
              <li>Keep your API keys secure and never share them publicly</li>
              <li>Each key can be revoked independently</li>
              <li>Keys are shown only once when generated - save them securely</li>
            </ul>
          </div>
        </div>
        )}

        {/* New API Key Modal */}
        {isApiKeyModalOpen && newApiKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setIsApiKeyModalOpen(false); setNewApiKey(null); }}>
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-[#435970]">API Key Generated</h3>
                <button
                  onClick={() => { setIsApiKeyModalOpen(false); setNewApiKey(null); }}
                  className="text-[#7895b3] hover:text-[#435970] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ Important: Save this key now</p>
                  <p className="text-xs text-yellow-700">You won&apos;t be able to see this key again. Make sure to copy and store it in a secure location.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#435970] mb-2">Your API Key:</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-[#dfedfb] px-4 py-3 rounded-lg text-[#435970] break-all">
                      {newApiKey}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopyApiKey(newApiKey)}
                      className="px-4 py-3 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors"
                      title="Copy key"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => { setIsApiKeyModalOpen(false); setNewApiKey(null); }}
                    className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors"
                  >
                    I&apos;ve Saved This Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Secret Token Modal */}
        {isSecretTokenModalOpen && newSecretToken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setIsSecretTokenModalOpen(false); setNewSecretToken(null); }}>
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-[#435970]">Secret Token Generated</h3>
                <button
                  onClick={() => { setIsSecretTokenModalOpen(false); setNewSecretToken(null); }}
                  className="text-[#7895b3] hover:text-[#435970] transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ Important: Save this token now</p>
                  <p className="text-xs text-yellow-700">You won&apos;t be able to see this token again. Make sure to copy and store it in a secure location.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#435970] mb-2">Your Secret Token:</label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-[#dfedfb] px-4 py-3 rounded-lg text-[#435970] break-all">
                      {newSecretToken}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopySecretToken(newSecretToken)}
                      className="px-4 py-3 bg-[#435970] text-white rounded-lg hover:bg-[#7895b3] transition-colors"
                      title="Copy token"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => { setIsSecretTokenModalOpen(false); setNewSecretToken(null); }}
                    className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors"
                  >
                    I&apos;ve Saved This Token
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backup & Restore Tab */}
        {activeTab === 'backup' && (
          <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
            <h4 className="text-lg font-semibold text-[#435970] mb-4">Backup & Restore</h4>
            <p className="text-sm text-[#7895b3] mb-6">
              Export and import data for medicines, medicine categories, blogs, FAQs, and notifications.
            </p>

            {/* Export Section */}
            <div className="mb-8 pb-8 border-b border-[#dfedfb]">
              <h5 className="text-base font-semibold text-[#435970] mb-4">Export Backup</h5>
              <p className="text-xs text-[#7895b3] mb-4">Select which entities to export:</p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {['medicines', 'medicine-categories', 'blogs', 'faqs', 'notifications'].map((entity) => (
                  <label key={entity} className="flex items-center gap-2 p-3 border border-[#dfedfb] rounded-lg cursor-pointer hover:bg-[#dfedfb]/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedEntities.includes(entity)}
                      onChange={() => toggleEntity(entity)}
                      className="w-4 h-4 text-[#435970] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                    />
                    <span className="text-sm text-[#435970] capitalize">{entity.replace('-', ' ')}</span>
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || selectedEntities.length === 0}
                className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Backup
                  </>
                )}
              </button>
            </div>

            {/* Import Section */}
            <div>
              <h5 className="text-base font-semibold text-[#435970] mb-4">Import Backup</h5>
              
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#435970] mb-2">
                    Import Mode
                  </label>
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace' | 'skip-existing')}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] bg-white"
                  >
                    <option value="merge">Merge - Update existing, add new</option>
                    <option value="replace">Replace - Delete all existing, import new</option>
                    <option value="skip-existing">Skip Existing - Only import new records</option>
                  </select>
                  <p className="text-xs text-[#7895b3] mt-1">
                    {importMode === 'merge' && 'Updates existing records and adds new ones'}
                    {importMode === 'replace' && '⚠️ WARNING: This will delete all existing data before importing'}
                    {importMode === 'skip-existing' && 'Only imports records that don\'t already exist'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#435970] mb-2">
                    Backup File (JSON)
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#dfedfb] file:text-[#435970] hover:file:bg-[#7895b3] hover:file:text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !importFile}
                className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Import Backup
                  </>
                )}
              </button>

              {/* Import Results */}
              {importResult && (
                <div className={`mt-6 p-4 rounded-lg border ${importResult.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <h6 className="font-semibold text-[#435970] mb-2">
                    {importResult.success ? '✓ Import Successful' : '⚠ Import Completed with Errors'}
                  </h6>
                  <div className="space-y-2 text-sm">
                    {Object.entries(importResult.summary || {}).map(([entity, count]: [string, any]) => (
                      <div key={entity} className="text-[#435970]">
                        <span className="capitalize font-medium">{entity.replace('-', ' ')}:</span> {count} imported
                      </div>
                    ))}
                    {importResult.imported && Object.entries(importResult.imported).map(([entity, details]: [string, any]) => (
                      <div key={entity} className="text-xs text-[#7895b3] ml-4">
                        • {details.imported || 0} new, {details.updated || 0} updated, {details.skipped || 0} skipped
                        {details.errors && details.errors.length > 0 && (
                          <div className="text-red-600 mt-1">
                            {details.errors.length} error(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Data Reset Section */}
            <div className="mt-8 pt-8 border-t border-[#dfedfb]">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="text-base font-semibold text-red-600">Reset All Data</h5>
                  <p className="text-xs text-[#7895b3] mt-1">Delete all users, medicines, blogs, FAQs, and notifications</p>
                </div>
                <button
                  type="button"
                  onClick={handleDataReset}
                  disabled={isResetting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Reset Data'}
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-[#dfedfb]/50 rounded-lg p-4">
              <p className="text-sm text-[#435970] font-medium mb-2">Backup & Restore Information:</p>
              <ul className="text-xs text-[#7895b3] list-disc list-inside space-y-1">
                <li>Backups include all data for selected entities (medicines, categories, blogs, FAQs, notifications)</li>
                <li>Export creates a JSON file that can be imported later</li>
                <li>Import modes: Merge (update/add), Replace (delete all first), Skip Existing (only new)</li>
                <li>Regular backups are recommended to prevent data loss</li>
              </ul>
            </div>
          </div>
        )}

        {/* WooCommerce API Settings Tab */}
        {activeTab === 'woocommerce' && (
          <div className="bg-white rounded-lg border border-[#dfedfb] p-6">
            <h4 className="text-lg font-semibold text-[#435970] mb-4">WooCommerce API Settings</h4>
          <div className="space-y-4">
            <div>
              <label htmlFor="woocommerceApiUrl" className="block text-sm font-medium text-[#435970] mb-2">
                API URL *
              </label>
              <input
                type="url"
                id="woocommerceApiUrl"
                value={settings.woocommerceApiUrl}
                onChange={(e) => handleInputChange('woocommerceApiUrl', e.target.value)}
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                placeholder="https://yourstore.com/wp-json/wc/v3"
              />
              <p className="text-xs text-[#7895b3] mt-1">Enter your WooCommerce store API URL</p>
            </div>
            <div>
              <label htmlFor="woocommerceApiKey" className="block text-sm font-medium text-[#435970] mb-2">
                API Key *
              </label>
              <input
                type="text"
                id="woocommerceApiKey"
                value={settings.woocommerceApiKey}
                onChange={(e) => handleInputChange('woocommerceApiKey', e.target.value)}
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-[#7895b3] mt-1">Enter your WooCommerce API Consumer Key</p>
            </div>
            <div>
              <label htmlFor="woocommerceApiSecret" className="block text-sm font-medium text-[#435970] mb-2">
                API Secret *
              </label>
              <input
                type="password"
                id="woocommerceApiSecret"
                value={settings.woocommerceApiSecret}
                onChange={(e) => handleInputChange('woocommerceApiSecret', e.target.value)}
                className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-[#7895b3] mt-1">Enter your WooCommerce API Consumer Secret</p>
            </div>
            <div className="bg-[#dfedfb]/50 rounded-lg p-4">
              <p className="text-sm text-[#435970] font-medium mb-2">How to get your API credentials:</p>
              <ol className="text-xs text-[#7895b3] list-decimal list-inside space-y-1">
                <li>Go to WooCommerce → Settings → Advanced → REST API</li>
                <li>Click &quot;Add Key&quot; to create a new API key</li>
                <li>Set permissions to &quot;Read/Write&quot;</li>
                <li>Copy the Consumer Key and Consumer Secret</li>
              </ol>
            </div>
          </div>

          {/* FCM Settings for Push Notifications */}
          <div className="mt-8 pt-6 border-t border-[#dfedfb]">
            <h5 className="text-base font-semibold text-[#435970] mb-4">Firebase Cloud Messaging (FCM) Settings</h5>
            <p className="text-xs text-[#7895b3] mb-4">Configure FCM to send push notifications to Android app users.</p>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="fcmProjectId" className="block text-sm font-medium text-[#435970] mb-2">
                  Firebase Project ID
                </label>
                <input
                  type="text"
                  id="fcmProjectId"
                  value={settings.fcmProjectId}
                  onChange={(e) => handleInputChange('fcmProjectId', e.target.value)}
                  className="w-full px-4 py-2 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent text-[#435970] placeholder:text-[#7895b3]"
                  placeholder="your-firebase-project-id"
                />
                <p className="text-xs text-[#7895b3] mt-1">Your Firebase project ID from Firebase Console</p>
              </div>
              <div>
                <label htmlFor="fcmServerKey" className="block text-sm font-medium text-[#435970] mb-2">
                  FCM Server Key <span className="text-xs text-orange-600">(Deprecated - Use Service Account)</span>
                </label>
                <input
                  type="password"
                  id="fcmServerKey"
                  value={settings.fcmServerKey}
                  onChange={(e) => handleInputChange('fcmServerKey', e.target.value)}
                  className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-[#435970] placeholder:text-[#7895b3] bg-orange-50"
                  placeholder="AAAAxxxxxxx:APA91bH..."
                  disabled
                />
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ This field is deprecated. The server now uses FCM API v1 which requires service account credentials via environment variables.
                  See instructions above for proper setup.
                </p>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800 font-medium mb-2">FCM API v1 Setup (Required):</p>
              <p className="text-xs text-blue-700 mb-2">
                The server now uses <strong>Firebase Cloud Messaging API v1</strong> (not the legacy API). 
                You must configure service account credentials via environment variables.
              </p>
              <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1 mb-3">
                <li>Go to Firebase Console → Your Project → Project Settings → Service Accounts tab</li>
                <li>Click &quot;Generate New Private Key&quot; to download the service account JSON file</li>
                <li>Set environment variable <code className="bg-blue-100 px-1 rounded">FIREBASE_SERVICE_ACCOUNT</code> to the JSON content, OR</li>
                <li>Set <code className="bg-blue-100 px-1 rounded">GOOGLE_APPLICATION_CREDENTIALS</code> to the file path</li>
                <li>Enter your Firebase Project ID below (from Project Settings → General tab)</li>
              </ol>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-blue-600 font-medium mb-1">⚠️ Important:</p>
                <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li>The FCM Server Key field below is deprecated and may not work with the new API</li>
                  <li>Service account credentials are required for FCM API v1</li>
                  <li>Never commit service account JSON files to version control</li>
                  <li>For production, always use environment variables for security</li>
                </ul>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-[#dfedfb] p-6">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2 border border-[#dfedfb] text-[#435970] rounded-lg font-medium hover:bg-[#dfedfb] transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="px-6 py-2 bg-[#435970] text-white rounded-lg font-medium hover:bg-[#7895b3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

