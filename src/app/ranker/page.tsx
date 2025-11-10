'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ImportantPerson {
  username: string;
  user_id: string;
  name: string;
  last_synced: string | null;
  following_count: number;
  is_active: boolean;
}

interface SyncStatus {
  username: string;
  user_id: string;
  name: string;
  last_synced: string | null;
  following_count: number;
  sync_status: 'never_synced' | 'synced';
}

export default function RankerAdmin() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [syncingUsername, setSyncingUsername] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [importantPeople, setImportantPeople] = useState<ImportantPerson[]>([]);
  const [syncStatus, setSyncStatus] = useState<{
    summary: {
      total_people: number;
      synced_people: number;
      unsynced_people: number;
      oldest_sync: string | null;
      newest_sync: string | null;
    };
    people: SyncStatus[];
  } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPeople, setTotalPeople] = useState(0);
  const [limit] = useState(20);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [allPeople, setAllPeople] = useState<ImportantPerson[]>([]); // Store all people for search
  const [isSearching, setIsSearching] = useState(false);

  // Fetch important people on mount
  useEffect(() => {
    fetchImportantPeople();
    fetchSyncStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all people for search functionality
  const fetchAllPeople = async () => {
    setIsSearching(true);
    try {
      // Fetch with a high limit to get all people
      const response = await fetch(`/api/ranker/admin/important-people?page=1&limit=1000`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAllPeople(data.data.people);
      }
    } catch (error) {
      console.error('Error fetching all people:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger search when query changes (with debounce)
  useEffect(() => {
    if (searchQuery.trim()) {
      // Only fetch if we don't have all people cached yet
      if (allPeople.length === 0) {
        const timeoutId = setTimeout(() => {
          fetchAllPeople();
        }, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
      }
    } else {
      // Clear cached data when search is cleared
      setAllPeople([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Filter people based on search query
  const filteredPeople = searchQuery.trim()
    ? allPeople.filter((person) => {
        const query = searchQuery.toLowerCase();
        return (
          person.username.toLowerCase().includes(query) ||
          person.name?.toLowerCase().includes(query)
        );
      })
    : importantPeople;

  const fetchImportantPeople = async (page: number = currentPage) => {
    setIsFetching(true);
    try {
      const response = await fetch(`/api/ranker/admin/important-people?page=${page}&limit=${limit}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setImportantPeople(data.data.people);
        setTotalPages(data.data.pagination.total_pages);
        setTotalPeople(data.data.pagination.total);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching important people:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/ranker/admin/sync-status');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSyncStatus(data.data);
      }
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter a username',
      });
      return;
    }

    // Client-side duplicate check
    const usernameToAdd = username.trim().toLowerCase();
    const existingPerson = importantPeople.find(
      (person) => person.username.toLowerCase() === usernameToAdd
    );
    
    if (existingPerson) {
      setMessage({
        type: 'error',
        text: `@${username.trim()} is already in your important people list!`,
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/ranker/admin/important-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Handle multiple username additions
        const summary = data.summary;
        if (summary && summary.total > 1) {
          setMessage({
            type: 'success',
            text: `${summary.added} of ${summary.total} people added successfully${summary.failed > 0 ? ` (${summary.failed} duplicates found)` : ''}`,
          });
        } else {
          setMessage({
            type: 'success',
            text: data.message || 'Important person added successfully! You can now sync their following data.',
          });
        }
        setUsername('');
        setAllPeople([]); // Clear search cache to include new person
        fetchImportantPeople(1); // Reset to page 1 after adding
        fetchSyncStatus();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to add important person',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePerson = async (username: string) => {
    if (!confirm(`Are you sure you want to remove @${username}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ranker/admin/important-person?username=${username}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({
          type: 'success',
          text: `@${username} removed successfully`,
        });
        setAllPeople([]); // Clear search cache after removal
        fetchImportantPeople();
        fetchSyncStatus();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to remove person',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.',
      });
    }
  };

  const handleSyncPerson = async (username: string) => {
    // Prevent multiple syncs at once
    if (syncingUsername) {
      setMessage({
        type: 'error',
        text: `Please wait for @${syncingUsername} to finish syncing first.`,
      });
      return;
    }

    setSyncingUsername(username);
    setMessage({
      type: 'success',
      text: `Syncing @${username}... This may take a minute.`,
    });

    try {
      // Create an AbortController with a longer timeout (5 minutes for sync operations)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutes

      const response = await fetch('/api/ranker/admin/sync-person', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (response.ok && data.success) {
        // Handle multiple usernames response
        const summary = data.summary;
        if (summary && summary.total > 1) {
          setMessage({
            type: 'success',
            text: `${summary.succeeded} of ${summary.total} synced successfully!`,
          });
        } else {
          setMessage({
            type: 'success',
            text: `@${username} synced successfully! Following: ${data.results?.[0]?.following_count || 0}`,
          });
        }
        setAllPeople([]); // Clear search cache after sync (data might have changed)
        fetchImportantPeople();
        fetchSyncStatus();
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to sync person',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      if ((error as Error).name === 'AbortError') {
        setMessage({
          type: 'error',
          text: 'Sync operation timed out. The person may have too many followers. Please try again.',
        });
      } else {
        setMessage({
          type: 'error',
          text: 'Network error. Please try again.',
        });
      }
    } finally {
      setSyncingUsername(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Never synced';
    return new Date(date).toLocaleString();
  };

  const getTimeSince = (date: string | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>

      {/* Navigation Button */}
      <div className="absolute top-6 right-6 z-20">
        <Link href="/">
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/80 backdrop-blur-sm border border-zinc-700 text-white font-medium rounded-lg hover:bg-zinc-800 hover:border-zinc-600 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
        </Link>
      </div>

      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-20 pb-16">
          <div className="max-w-6xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-400 text-sm font-medium">Twitter Ranker Admin</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Engager Ranking</span>
              <br />
              <span className="text-white">System.</span>
            </h1>

            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Manage important people and track their following relationships. 
              Rank tweet engagers by importance with inverse index lookup.
            </p>

            {/* Stats Overview */}
            {syncStatus && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12">
                <div className="glass rounded-xl p-6">
                  <div className="text-3xl font-bold text-white mb-2">
                    {syncStatus.summary.total_people}
                  </div>
                  <div className="text-sm text-zinc-400">Total Important People</div>
                </div>
                <div className="glass rounded-xl p-6">
                  <div className="text-3xl font-bold text-emerald-400 mb-2">
                    {syncStatus.summary.synced_people}
                  </div>
                  <div className="text-sm text-zinc-400">Synced</div>
                </div>
                <div className="glass rounded-xl p-6">
                  <div className="text-3xl font-bold text-yellow-400 mb-2">
                    {syncStatus.summary.unsynced_people}
                  </div>
                  <div className="text-sm text-zinc-400">Pending Sync</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-6 pb-20">
          {/* Add Important Person Form */}
          <div className="glass rounded-2xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Add Important Person</h2>
            
            <form onSubmit={handleAddPerson} className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-white mb-3">
                  Twitter Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">@</span>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="elonmusk"
                    className="w-full pl-10 pr-4 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all text-lg"
                    disabled={isLoading}
                  />
                </div>
                <p className="mt-3 text-sm text-zinc-500">
                  Enter just the username. N8N will fetch user ID and name during the first sync.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="w-full gradient-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-indigo-500/25"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Important Person
                  </>
                )}
              </button>
            </form>

            {/* Message Display */}
            {message && (
              <div
                className={`mt-6 p-4 rounded-xl border ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  {message.type === 'success' ? (
                    <div className="flex-shrink-0 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                  <span className="font-medium">{message.text}</span>
                </div>
              </div>
            )}
          </div>

          {/* Important People Table */}
          <div className="glass rounded-2xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Important People</h2>
              <button
                onClick={() => {
                  setAllPeople([]); // Clear search cache on refresh
                  fetchImportantPeople();
                  fetchSyncStatus();
                }}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium rounded-lg transition-all disabled:opacity-50"
              >
                <svg
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <svg
                  className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 ${isSearching ? 'animate-pulse' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search across all important people..."
                  className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all"
                  disabled={isSearching}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
              {searchQuery && !isSearching && (
                <p className="mt-2 text-sm text-zinc-400">
                  Found {filteredPeople.length} result{filteredPeople.length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot; across all {totalPeople} people
                </p>
              )}
              {isSearching && (
                <p className="mt-2 text-sm text-zinc-400">
                  <span className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-400 border-t-transparent"></div>
                    Searching across all people...
                  </span>
                </p>
              )}
            </div>

            {importantPeople.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </div>
                <p className="text-zinc-400">No important people added yet</p>
                <p className="text-sm text-zinc-500 mt-2">Add someone using the form above to get started</p>
              </div>
            ) : filteredPeople.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <p className="text-zinc-400">No results found for &quot;{searchQuery}&quot;</p>
                <p className="text-sm text-zinc-500 mt-2">Try a different search term</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Username</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Name</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Following</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Last Synced</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Status</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-zinc-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => (
                      <tr key={person.username} className="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-500/20 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                              </svg>
                            </div>
                            <span className="text-white font-medium">@{person.username}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-zinc-300">{person.name || <span className="text-zinc-500 italic">Not synced yet</span>}</td>
                        <td className="py-4 px-4">
                          <span className="text-zinc-300">{person.following_count.toLocaleString()}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="text-sm">
                            <div className="text-zinc-300">{getTimeSince(person.last_synced)}</div>
                            {person.last_synced && (
                              <div className="text-zinc-500 text-xs">{formatDate(person.last_synced)}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {person.last_synced ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full border border-emerald-500/30">
                              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></div>
                              Synced
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                              <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                              Not Synced
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleSyncPerson(person.username)}
                              disabled={syncingUsername !== null}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              title={syncingUsername ? `Wait for @${syncingUsername} to finish syncing` : 'Sync following data from Twitter'}
                            >
                              <svg className={`w-4 h-4 ${syncingUsername === person.username ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                              {syncingUsername === person.username ? 'Syncing...' : 'Sync'}
                            </button>
                            <button
                              onClick={() => handleRemovePerson(person.username)}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!searchQuery && totalPages > 1 && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-800">
                <div className="text-sm text-zinc-400">
                  Showing page {currentPage} of {totalPages} ({totalPeople} total people)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchImportantPeople(currentPage - 1)}
                    disabled={currentPage === 1 || isFetching}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => fetchImportantPeople(pageNum)}
                          disabled={isFetching}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-indigo-500 text-white'
                              : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => fetchImportantPeople(currentPage + 1)}
                    disabled={currentPage === totalPages || isFetching}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* How it Works */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-white mb-8">How it works:</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Add Important People</h3>
                <p className="text-zinc-400 text-sm">Define who matters in your network</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Sync Following Data</h3>
                <p className="text-zinc-400 text-sm">N8N fetches and syncs their following lists</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Build Inverse Index</h3>
                <p className="text-zinc-400 text-sm">System creates importance score for everyone</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Rank Engagers</h3>
                <p className="text-zinc-400 text-sm">Instantly rank any list by importance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 py-8 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-zinc-500 text-sm">
              Powered by Identity Labs • Twitter Engager Ranking System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

