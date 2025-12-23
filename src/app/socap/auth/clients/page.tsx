'use client';

import { useState, useEffect } from 'react';

/**
 * Admin Page: Manage OAuth Clients
 * 
 * Features:
 * 1. View all clients who have authorized their X account
 * 2. Generate auth links for new clients
 * 3. Copy links to clipboard
 * 
 * URL: /socap/auth/clients
 */

interface AuthorizedClient {
  client_id: string;
  x_username: string;
  x_name: string;
  status: 'active' | 'expired' | 'revoked';
  authorized_at: string;
  last_used_at: string | null;
}

export default function AuthClientsPage() {
  const [clients, setClients] = useState<AuthorizedClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Link generator state
  const [username, setUsername] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch clients on mount
  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/socap/auth/clients');
      const data = await response.json();
      
      if (data.success) {
        setClients(data.clients);
      } else {
        setError(data.error || 'Failed to fetch clients');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const generateLink = () => {
    if (!username.trim()) return;
    
    // Clean the username (remove @ if present)
    const cleanUsername = username.trim().replace(/^@/, '');
    
    // Generate the link
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/socap/auth/connect?client=${encodeURIComponent(cleanUsername)}`;
    
    setGeneratedLink(link);
    setCopied(false);
  };

  const copyToClipboard = async () => {
    if (!generatedLink) return;
    
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'expired':
        return 'bg-amber-100 text-amber-700';
      case 'revoked':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-800 mb-1">
            Client Authorization
          </h1>
          <p className="text-stone-600 text-sm">
            Generate auth links and manage clients who have connected their X account.
          </p>
        </div>

        {/* Link Generator Card */}
        <div className="bg-white rounded-xl shadow-lg border border-stone-200 p-5 mb-6">
          <h2 className="text-base font-semibold text-stone-800 mb-3">
            Generate Auth Link
          </h2>
          
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generateLink()}
                  placeholder="Enter client's Twitter username"
                  className="w-full pl-8 pr-4 py-2 text-sm border border-stone-200 rounded-lg 
                           focus:outline-none focus:ring-2 focus:ring-stone-900 focus:border-transparent
                           text-stone-800 placeholder:text-stone-400"
                />
              </div>
            </div>
            <button
              onClick={generateLink}
              disabled={!username.trim()}
              className="px-4 py-2 text-sm bg-stone-900 text-white rounded-lg font-medium
                       hover:bg-stone-800 transition-all duration-200
                       disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed"
            >
              Generate Link
            </button>
          </div>

          {/* Generated Link Display */}
          {generatedLink && (
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <div className="flex items-center gap-3">
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] text-stone-500 mb-0.5">Auth Link:</p>
                  <p className="text-xs text-stone-700 font-mono truncate">
                    {generatedLink}
                  </p>
                </div>
                <button
                  onClick={copyToClipboard}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 flex items-center gap-1.5
                            ${copied 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-stone-900 text-white hover:bg-stone-800'
                            }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Authorized Clients List */}
        <div className="bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
          <div className="p-5 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-800">
                Authorized Clients
              </h2>
              <p className="text-xs text-stone-500">
                {clients.length} client{clients.length !== 1 ? 's' : ''} connected
              </p>
            </div>
            <button
              onClick={fetchClients}
              disabled={isLoading}
              className="p-1.5 text-stone-500 hover:text-stone-700 hover:bg-stone-100 
                       rounded-md transition-colors disabled:opacity-50"
              title="Refresh list"
            >
              <svg 
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Loading State */}
          {isLoading && clients.length === 0 && (
            <div className="p-8 text-center">
              <div className="animate-spin h-6 w-6 border-2 border-stone-200 border-t-stone-800 rounded-full mx-auto mb-3"></div>
              <p className="text-stone-500 text-sm">Loading clients...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-5 bg-red-50 border-b border-red-100">
              <p className="text-red-700 text-xs">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && clients.length === 0 && !error && (
            <div className="p-8 text-center">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-stone-800 font-medium text-sm mb-1">No clients yet</h3>
              <p className="text-stone-500 text-xs">
                Generate an auth link above and send it to your first client.
              </p>
            </div>
          )}

          {/* Clients Table */}
          {clients.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-100">
                  <tr>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                      X Account
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                      Authorized
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {clients.map((client) => (
                    <tr key={client.client_id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-medium text-sm text-stone-800">
                          {client.client_id}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-stone-900 rounded-full flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-sm text-stone-800">@{client.x_username}</p>
                            <p className="text-xs text-stone-500">{client.x_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(client.status)}`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-stone-600">
                        {formatDate(client.authorized_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-stone-500">
            After a client authorizes, their tokens are stored securely and refresh automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
