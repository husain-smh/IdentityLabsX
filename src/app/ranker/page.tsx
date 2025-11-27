'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import Navbar from '@/components/Navbar';

interface ImportantPerson {
  username: string;
  user_id: string;
  name: string;
  last_synced: string | null;
  following_count: number;
  is_active: boolean;
  weight?: number;
  tags?: string[];
}

interface ImportantAccountCandidate {
  followed_username: string;
  followed_user_id: string;
  follower_count: number;
  total_weight: number;
  importance_score: number;
  sample_followed_by: {
    username: string;
    user_id: string;
    name: string;
    weight?: number;
  }[];
}

interface SyncStatus {
  username: string;
  user_id: string;
  name: string;
  last_synced: string | null;
  following_count: number;
  sync_status: 'never_synced' | 'synced';
}

interface AccountImportanceResult {
  id: string; // unique ID for removal
  username: string;
  found: boolean;
  followed_username?: string;
  followed_user_id?: string;
  importance_score: number;
  followed_by: Array<{
    username: string;
    user_id: string;
    name: string;
    weight: number;
  }>;
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
  const [weightEdits, setWeightEdits] = useState<Record<string, string>>({});
  const [updatingWeight, setUpdatingWeight] = useState<string | null>(null);
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
  const [allPeople, setAllPeople] = useState<ImportantPerson[]>([]); // Store all people for search/tag filters
  const [hasLoadedAllPeople, setHasLoadedAllPeople] = useState(false);
  const [isFetchingAllPeople, setIsFetchingAllPeople] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const [candidateList, setCandidateList] = useState<ImportantAccountCandidate[]>([]);
  const [candidateAdding, setCandidateAdding] = useState<Record<string, boolean>>({});
  const [candidateMinFollowers, setCandidateMinFollowers] = useState(3);
  const [candidateMinWeight, setCandidateMinWeight] = useState(0);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isFetchingTags, setIsFetchingTags] = useState(false);
  const [tagModalPerson, setTagModalPerson] = useState<ImportantPerson | null>(null);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [tagInputValue, setTagInputValue] = useState('');
  const [isSavingTags, setIsSavingTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagFilterOpen, setIsTagFilterOpen] = useState(false);
  const [syncFilter, setSyncFilter] = useState<'all' | 'synced' | 'unsynced'>('all');
  const [isLoadingTagFilterData, setIsLoadingTagFilterData] = useState(false);
  
  // Check Important Score section state
  const [checkUsername, setCheckUsername] = useState('');
  const [isCheckLoading, setIsCheckLoading] = useState(false);
  const [isCheckSectionOpen, setIsCheckSectionOpen] = useState(false);
  const [checkResults, setCheckResults] = useState<AccountImportanceResult[]>([]);
  
  const clearAllPeopleCache = () => {
    setAllPeople([]);
    setHasLoadedAllPeople(false);
  };

  // Fetch important people on mount
  useEffect(() => {
    fetchImportantPeople();
    fetchSyncStatus();
    fetchAvailableTags();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all people for search/tag filtering
  const fetchAllPeople = async (reason: 'search' | 'filter' = 'search') => {
    if (hasLoadedAllPeople || isFetchingAllPeople) {
      return;
    }

    if (reason === 'search') {
      setIsSearching(true);
    } else {
      setIsLoadingTagFilterData(true);
    }

    setIsFetchingAllPeople(true);

    try {
      const response = await fetch(`/api/ranker/admin/important-people?page=1&limit=1000`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setAllPeople(
          data.data.people.map((person: ImportantPerson) => ({
            ...person,
            tags: person.tags ?? [],
          }))
        );
        setHasLoadedAllPeople(true);
      }
    } catch (error) {
      console.error('Error fetching all people:', error);
    } finally {
      setIsFetchingAllPeople(false);
      if (reason === 'search') {
        setIsSearching(false);
      } else {
        setIsLoadingTagFilterData(false);
      }
    }
  };

  // Trigger search when query changes (with debounce)
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (!hasLoadedAllPeople) {
        const timeoutId = setTimeout(() => {
          fetchAllPeople('search');
        }, 300); // 300ms debounce
        return () => clearTimeout(timeoutId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hasLoadedAllPeople]);

  // Ensure full dataset is available when filtering by tags
  useEffect(() => {
    if (selectedTags.length > 0 && !hasLoadedAllPeople) {
      fetchAllPeople('filter');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, hasLoadedAllPeople]);

  const requiresFullDataset = searchQuery.trim().length > 0 || selectedTags.length > 0;
  const baseList =
    requiresFullDataset && hasLoadedAllPeople ? allPeople : importantPeople;
  const isAwaitingFullDataset =
    requiresFullDataset && !hasLoadedAllPeople && (isSearching || isLoadingTagFilterData);

  // Combined filters for search, tags, and sync status
  const filteredPeople = baseList.filter((person) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      person.username.toLowerCase().includes(query) ||
      person.name?.toLowerCase().includes(query);

    const personTags = person.tags ?? [];
    const matchesTags =
      selectedTags.length === 0 ||
      selectedTags.every((tag) =>
        personTags.some((personTag) => personTag.toLowerCase() === tag.toLowerCase())
      );

    const isSynced = person.last_synced !== null;
    const matchesSync =
      syncFilter === 'all' ? true : syncFilter === 'synced' ? isSynced : !isSynced;

    return matchesSearch && matchesTags && matchesSync;
  });

  const unsyncedCount = filteredPeople.filter((person) => person.last_synced === null).length;

  const fetchImportantPeople = async (page: number = currentPage) => {
    setIsFetching(true);
    try {
      const response = await fetch(`/api/ranker/admin/important-people?page=${page}&limit=${limit}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        setImportantPeople(
          data.data.people.map((person: ImportantPerson) => ({
            ...person,
            tags: person.tags ?? [],
          }))
        );
        setTotalPages(data.data.pagination.total_pages);
        setTotalPeople(data.data.pagination.total);
        setCurrentPage(page);
        setWeightEdits({});
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

  const fetchAvailableTags = async () => {
    setIsFetchingTags(true);
    try {
      const response = await fetch('/api/ranker/admin/important-tags');
      const data = await response.json();
      if (response.ok && data.success) {
        setAvailableTags(data.data.tags);
      }
    } catch (error) {
      console.error('Error fetching available tags:', error);
    } finally {
      setIsFetchingTags(false);
    }
  };

  const handleCheckImportance = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkUsername.trim()) {
      return;
    }

    setIsCheckLoading(true);

    try {
      const usernameToCheck = checkUsername.trim().replace(/^@/, '');
      const response = await fetch(`/api/ranker/account-importance?username=${encodeURIComponent(usernameToCheck)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        const result: AccountImportanceResult = {
          id: `${usernameToCheck}-${Date.now()}`, // unique ID for removal
          username: usernameToCheck,
          found: data.data.found,
          followed_username: data.data.followed_username,
          followed_user_id: data.data.followed_user_id,
          importance_score: data.data.importance_score,
          followed_by: data.data.followed_by || [],
        };
        
        // Add result to the list (allows multiple checks)
        setCheckResults((prev) => [result, ...prev]);
        setCheckUsername(''); // Clear input after successful check
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to check importance score',
        });
      }
    } catch (error) {
      console.error('Error checking importance:', error);
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.',
      });
    } finally {
      setIsCheckLoading(false);
    }
  };

  const handleRemoveResult = (resultId: string) => {
    setCheckResults((prev) => prev.filter((result) => result.id !== resultId));
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
        clearAllPeopleCache(); // Clear search cache to include new person
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
        clearAllPeopleCache(); // Clear search cache after removal
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
        clearAllPeopleCache(); // Clear search cache after sync (data might have changed)
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

  const updatePeopleWeight = (list: ImportantPerson[], username: string, weight: number) =>
    list.map((person) =>
      person.username === username ? { ...person, weight } : person
    );

  const updatePeopleTags = (list: ImportantPerson[], username: string, tags: string[]) =>
    list.map((person) =>
      person.username === username ? { ...person, tags } : person
    );

  const handleWeightInputChange = (username: string, value: string) => {
    setWeightEdits((prev) => ({
      ...prev,
      [username]: value,
    }));
  };

  const handleWeightSave = async (person: ImportantPerson) => {
    const inputValue =
      weightEdits[person.username] ?? (person.weight ?? 1).toString();
    const parsedWeight = Number(inputValue);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setMessage({
        type: 'error',
        text: 'Weight must be a positive number',
      });
      return;
    }

    if (Math.abs(parsedWeight - (person.weight ?? 1)) < 0.0001) {
      return; // No change
    }

    setUpdatingWeight(person.username);

    try {
      const response = await fetch('/api/ranker/admin/important-person', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: person.username,
          weight: parsedWeight,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({
          type: 'success',
          text: data.message || `@${person.username} weight updated`,
        });
        setImportantPeople((prev) => updatePeopleWeight(prev, person.username, parsedWeight));
        setAllPeople((prev) => updatePeopleWeight(prev, person.username, parsedWeight));
        setWeightEdits((prev) => {
          const next = { ...prev };
          delete next[person.username];
          return next;
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to update weight',
        });
      }
    } catch (error) {
      console.error('Error updating weight:', error);
      setMessage({
        type: 'error',
        text: 'Network error. Please try again.',
      });
    } finally {
      setUpdatingWeight(null);
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

  const fetchCandidates = async () => {
    setCandidateLoading(true);
    setCandidateError(null);
    setSelectedCandidates([]);
    try {
      const params = new URLSearchParams({
        minFollowers: String(candidateMinFollowers),
        minWeight: String(candidateMinWeight),
      });
      const response = await fetch(`/api/ranker/admin/important-candidates?${params.toString()}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load candidates');
      }
      setCandidateList(data.data.candidates);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setCandidateError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setCandidateLoading(false);
    }
  };

  const openCandidateModal = () => {
    setIsCandidateModalOpen(true);
    if (candidateList.length === 0) {
      fetchCandidates();
    }
  };

  const closeCandidateModal = () => {
    setIsCandidateModalOpen(false);
  };

  const handleAddCandidate = async (candidate: ImportantAccountCandidate) => {
    await addCandidates([candidate.followed_username], candidate.followed_username);
  };

  const addCandidates = async (usernames: string[], trackingKey?: string) => {
    if (usernames.length === 0) {
      return;
    }

    if (trackingKey) {
      setCandidateAdding((prev) => ({ ...prev, [trackingKey]: true }));
    } else {
      setIsBatchAdding(true);
    }

    setMessage({
      type: 'success',
      text: usernames.length === 1
        ? `Adding @${usernames[0]}...`
        : `Adding ${usernames.length} candidates...`,
    });

    try {
      const response = await fetch('/api/ranker/admin/important-candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const firstError = data?.results?.find((r: { success: boolean }) => !r.success)?.error;
        throw new Error(data.error || firstError || 'Failed to add candidate(s)');
      }

      const addedUsernames: string[] = data.results
        ?.filter((result: { success: boolean }) => result.success)
        .map((result: { username: string }) => result.username) ?? usernames;

      setMessage({
        type: 'success',
        text: usernames.length === 1
          ? `@${usernames[0]} added to important people. Remember to sync them.`
          : `${addedUsernames.length} candidates added. Remember to sync them.`,
      });

      setCandidateList((prev) =>
        prev.filter((item) => !addedUsernames.includes(item.followed_username))
      );
      setSelectedCandidates((prev) => prev.filter((name) => !addedUsernames.includes(name)));
      clearAllPeopleCache(); // ensure future fetch reflects new person
      fetchImportantPeople(1);
      fetchSyncStatus();
    } catch (error) {
      console.error('Error adding candidate(s):', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add candidate(s)',
      });
    } finally {
      if (trackingKey) {
        setCandidateAdding((prev) => {
          const next = { ...prev };
          delete next[trackingKey];
          return next;
        });
      } else {
        setIsBatchAdding(false);
      }
    }
  };

  const handleBatchAdd = () => {
    addCandidates(selectedCandidates);
  };

  const toggleCandidateSelection = (username: string) => {
    setSelectedCandidates((prev) =>
      prev.includes(username)
        ? prev.filter((item) => item !== username)
        : [...prev, username]
    );
  };

  const toggleSelectAllCandidates = () => {
    if (selectedCandidates.length === candidateList.length) {
      setSelectedCandidates([]);
    } else {
      setSelectedCandidates(candidateList.map((candidate) => candidate.followed_username));
    }
  };

  const openTagModal = (person: ImportantPerson) => {
    setTagModalPerson(person);
    setTagDraft(person.tags ?? []);
    setTagInputValue('');
  };

  const closeTagModal = () => {
    setTagModalPerson(null);
    setTagDraft([]);
    setTagInputValue('');
  };

  const tagExists = (tag: string, list: string[] = tagDraft) =>
    list.some((item) => item.toLowerCase() === tag.toLowerCase());

  const addTagToDraft = (rawTag: string) => {
    const cleaned = rawTag.trim();
    if (!cleaned || tagExists(cleaned)) {
      return;
    }
    setTagDraft((prev) => [...prev, cleaned]);
  };

  const removeTagFromDraft = (tag: string) => {
    setTagDraft((prev) => prev.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  };

  const handleTagInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
      event.preventDefault();
      if (tagInputValue.trim()) {
        addTagToDraft(tagInputValue);
        setTagInputValue('');
      }
    } else if (event.key === 'Backspace' && !tagInputValue && tagDraft.length > 0) {
      removeTagFromDraft(tagDraft[tagDraft.length - 1]);
    }
  };

  const handleSaveTags = async () => {
    if (!tagModalPerson) return;
    setIsSavingTags(true);
    try {
      const response = await fetch('/api/ranker/admin/important-person', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: tagModalPerson.username,
          tags: tagDraft,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to update tags');
      }
      setMessage({
        type: 'success',
        text: `@${tagModalPerson.username} tags updated`,
      });
      setImportantPeople((prev) => updatePeopleTags(prev, tagModalPerson.username, tagDraft));
      setAllPeople((prev) => updatePeopleTags(prev, tagModalPerson.username, tagDraft));
      setAvailableTags((prev) => {
        const map = new Map(prev.map((tag) => [tag.toLowerCase(), tag]));
        tagDraft.forEach((tag) => {
          const key = tag.toLowerCase();
          if (!map.has(key)) {
            map.set(key, tag);
          }
        });
        return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
      });
      closeTagModal();
    } catch (error) {
      console.error('Error saving tags:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update tags',
      });
    } finally {
      setIsSavingTags(false);
    }
  };

  const tagSuggestions =
    tagModalPerson && availableTags.length > 0
      ? availableTags
          .filter((tag) => {
            const query = tagInputValue.trim().toLowerCase();
            if (!query) return true;
            return tag.toLowerCase().includes(query);
          })
          .filter((tag) => !tagExists(tag))
          .slice(0, 8)
      : [];

  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]"></div>

      <div className="relative z-10">
        {/* Header Section */}
        <div className="pt-24 pb-16">
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
          {/* Check Important Score Section */}
          <div className="glass rounded-2xl p-8 mb-8">
            <button
              onClick={() => setIsCheckSectionOpen(!isCheckSectionOpen)}
              className="w-full flex items-center justify-between text-left"
            >
              <h2 className="text-2xl font-bold text-white">Check Importance Score</h2>
              <svg
                className={`w-6 h-6 text-zinc-400 transition-transform ${isCheckSectionOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCheckSectionOpen && (
              <div className="mt-6 space-y-6">
                <form onSubmit={handleCheckImportance} className="space-y-6">
                  <div>
                    <label htmlFor="check-username" className="block text-sm font-semibold text-white mb-3">
                      Twitter Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-lg">@</span>
                      <input
                        type="text"
                        id="check-username"
                        value={checkUsername}
                        onChange={(e) => setCheckUsername(e.target.value)}
                        placeholder="elonmusk"
                        className="w-full pl-10 pr-4 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all text-lg"
                        disabled={isCheckLoading}
                      />
                    </div>
                    <p className="mt-3 text-sm text-zinc-500">
                      Enter a username to check their importance score and see which important people follow them.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isCheckLoading || !checkUsername.trim()}
                    className="w-full gradient-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-indigo-500/25"
                  >
                    {isCheckLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Check Importance Score
                      </>
                    )}
                  </button>
                </form>

                {/* Results Display */}
                {checkResults.length > 0 && (
                  <div className="space-y-4 mt-8">
                    <h3 className="text-lg font-semibold text-white">Results</h3>
                    {checkResults.map((result) => (
                      <div
                        key={result.id}
                        className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 relative"
                      >
                        <button
                          onClick={() => handleRemoveResult(result.id)}
                          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                          title="Remove result"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>

                        <div className="flex items-start justify-between pr-8">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-4 py-2 bg-zinc-100 text-zinc-900 font-semibold rounded-lg text-base">
                                @{result.found ? result.followed_username || result.username : result.username}
                              </span>
                            </div>
                            {!result.found && (
                              <p className="text-sm text-zinc-500 mt-1">Account not found in the reverse index</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-zinc-400 mb-1">Importance Score</div>
                            <div className="text-3xl font-bold text-indigo-400">{result.importance_score.toFixed(2)}</div>
                          </div>
                        </div>

                        {result.found && result.followed_by.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-zinc-800">
                            <div className="text-sm font-semibold text-zinc-300 mb-3">
                              Followed by {result.followed_by.length} important {result.followed_by.length === 1 ? 'person' : 'people'}:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {result.followed_by.map((follower) => (
                                <div
                                  key={`${result.id}-${follower.user_id}`}
                                  className="px-3 py-2 bg-zinc-100 border border-zinc-200 rounded-lg"
                                >
                                  <div className="text-zinc-900 font-semibold text-sm">@{follower.username}</div>
                                  {follower.name && (
                                    <div className="text-zinc-700 text-xs mt-0.5">{follower.name}</div>
                                  )}
                                  {follower.weight !== undefined && follower.weight !== 1 && (
                                    <div className="text-zinc-600 text-xs mt-1">Weight: {follower.weight}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.found && result.followed_by.length === 0 && (
                          <div className="mt-4 pt-4 border-t border-zinc-800">
                            <p className="text-sm text-zinc-500">No important people follow this account</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Important People</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={openCandidateModal}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Extract important accounts
                </button>
                <button
                  onClick={() => {
                    clearAllPeopleCache(); // Clear search cache on refresh
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
            </div>

            {/* Filters + Search */}
            <div className="mb-6 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {(['all', 'synced', 'unsynced'] as const).map((filterKey) => {
                    const isActive = syncFilter === filterKey;
                    const label =
                      filterKey === 'all'
                        ? 'All'
                        : filterKey === 'synced'
                        ? 'Synced'
                        : 'Not synced';
                    return (
                      <button
                        key={filterKey}
                        onClick={() => setSyncFilter(filterKey)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                          isActive
                            ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                            : 'border-zinc-700 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="relative">
                  <button
                    onClick={() => setIsTagFilterOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white hover:border-indigo-500/50 transition"
                  >
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    Tag filter
                    {selectedTags.length > 0 && (
                      <span className="inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-500/40">
                        {selectedTags.length}
                      </span>
                    )}
                    {isLoadingTagFilterData && (
                      <svg
                        className="w-3.5 h-3.5 text-indigo-300 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 12a8 8 0 018-8m8 8a8 8 0 01-8 8"
                        />
                      </svg>
                    )}
                  </button>
                  {isTagFilterOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl z-20">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                        <p className="text-sm font-medium text-white">Filter by tags</p>
                        <button
                          onClick={() => {
                            setSelectedTags([]);
                            setIsTagFilterOpen(false);
                          }}
                          className="text-xs text-zinc-500 hover:text-white transition"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {availableTags.length === 0 ? (
                          <div className="px-4 py-6 text-sm text-zinc-500 text-center">
                            Tags will appear after you start tagging people.
                          </div>
                        ) : (
                          <div className="p-2 flex flex-wrap gap-2">
                            {availableTags.map((tag) => {
                              const isSelected = selectedTags.some(
                                (selected) => selected.toLowerCase() === tag.toLowerCase()
                              );
                              return (
                                <button
                                  key={`dropdown-tag-${tag}`}
                                  onClick={() =>
                                    setSelectedTags((prev) =>
                                      isSelected
                                        ? prev.filter(
                                            (item) => item.toLowerCase() !== tag.toLowerCase()
                                          )
                                        : [...prev, tag]
                                    )
                                  }
                                  className={`px-3 py-1 rounded-full border text-xs transition ${
                                    isSelected
                                      ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                                      : 'border-zinc-700 text-zinc-300 hover:border-indigo-500/40'
                                  }`}
                                >
                                  #{tag}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 border-t border-zinc-800">
                        <button
                          onClick={() => setIsTagFilterOpen(false)}
                          className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedTags.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {selectedTags.slice(0, 5).map((tag) => (
                    <span
                      key={`active-tag-${tag}`}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/40 text-sm text-indigo-100"
                    >
                      #{tag}
                      <button
                        onClick={() =>
                          setSelectedTags((prev) =>
                            prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
                          )
                        }
                        className="text-xs text-indigo-200 hover:text-white transition"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {selectedTags.length > 5 && (
                    <span className="text-xs text-zinc-500">
                      +{selectedTags.length - 5} more
                    </span>
                  )}
                </div>
              )}

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
              <div className="text-sm text-zinc-400">
                {isSearching ? (
                  <span className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-400 border-t-transparent"></div>
                    Searching across all people...
                  </span>
                ) : isLoadingTagFilterData ? (
                  <span className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-400 border-t-transparent"></div>
                    Fetching all accounts for tag filtering...
                  </span>
                ) : (
                  <>
                    Showing {filteredPeople.length} of {baseList.length || totalPeople} account
                    {filteredPeople.length === 1 ? '' : 's'}
                    {syncFilter !== 'all' && ` • ${syncFilter === 'synced' ? 'Synced' : 'Not synced'} only`}
                    {selectedTags.length > 0 && (
                      <>
                        {' '}
                        • Tags: {selectedTags.slice(0, 3).join(', ')}
                        {selectedTags.length > 3 && ` +${selectedTags.length - 3}`}
                      </>
                    )}
                    {syncFilter !== 'synced' && ` • ${unsyncedCount} unsynced`}
                    {isAwaitingFullDataset && ' • Completing full dataset...'}
                  </>
                )}
              </div>
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
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Weight</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Tags</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Following</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Last Synced</th>
                      <th className="text-left py-4 px-4 text-sm font-semibold text-zinc-400">Status</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-zinc-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPeople.map((person) => {
                      const weightValue = weightEdits[person.username] ?? (person.weight ?? 1).toString();
                      const parsedWeight = Number(weightValue);
                      const isWeightValid = Number.isFinite(parsedWeight) && parsedWeight > 0;
                      const hasWeightChanged = isWeightValid && Math.abs(parsedWeight - (person.weight ?? 1)) >= 0.0001;
                      const isUpdatingThisWeight = updatingWeight === person.username;
                      const personTags = person.tags ?? [];

                      return (
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
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={weightValue}
                              disabled={isUpdatingThisWeight}
                              onChange={(e) => handleWeightInputChange(person.username, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (hasWeightChanged && isWeightValid && !isUpdatingThisWeight) {
                                    handleWeightSave(person);
                                  }
                                }
                              }}
                              className="w-20 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                            />
                            <button
                              onClick={() => handleWeightSave(person)}
                              disabled={!hasWeightChanged || !isWeightValid || isUpdatingThisWeight}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isUpdatingThisWeight ? (
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              <span>Save</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {personTags.length > 0 ? (
                              personTags.map((tag) => (
                                <span
                                  key={`${person.username}-${tag}`}
                                  className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-200"
                                >
                                  #{tag}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-zinc-500">No tags</span>
                            )}
                          </div>
                          <button
                            onClick={() => openTagModal(person)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded-lg hover:bg-zinc-800 transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Edit tags
                          </button>
                        </td>
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
                              className="inline-flex items-center justify-center w-10 h-10 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                              <span className="sr-only">Sync @{person.username}</span>
                            </button>
                            <button
                              onClick={() => handleRemovePerson(person.username)}
                              className="inline-flex items-center justify-center w-10 h-10 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-all"
                              title={`Remove @${person.username}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              <span className="sr-only">Remove @{person.username}</span>
                            </button>
                          </div>
                        </td>
                        </tr>
                      );
                    })}
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

        {isCandidateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur">
            <div className="glass max-w-4xl w-full mx-4 rounded-2xl border border-zinc-800 p-6 relative">
              <button
                onClick={closeCandidateModal}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center justify-between mb-4 pr-8">
                <div>
                  <h3 className="text-2xl font-bold text-white">Candidate Important Accounts</h3>
                  <p className="text-sm text-zinc-400">
                    Accounts followed by multiple important people but not yet in your list.
                  </p>
                </div>
                <button
                  onClick={fetchCandidates}
                  disabled={candidateLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white disabled:opacity-50"
                >
                  <svg
                    className={`w-4 h-4 ${candidateLoading ? 'animate-spin' : ''}`}
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                <label className="flex flex-col gap-2 text-sm text-white">
                  Minimum important followers
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 3 followers"
                    value={candidateMinFollowers}
                    onChange={(e) => setCandidateMinFollowers(Math.max(1, Number(e.target.value)))}
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <span className="text-xs text-zinc-400">
                    Only show accounts followed by at least this many important people.
                  </span>
                </label>
                <label className="flex flex-col gap-2 text-sm text-white">
                  Minimum total weight
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="e.g. 5 weight"
                    value={candidateMinWeight}
                    onChange={(e) =>
                      setCandidateMinWeight(Math.max(0, Number(e.target.value)))
                    }
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <span className="text-xs text-zinc-400">
                    Weighted by follower importance. Raise to prioritize higher-signal overlaps.
                  </span>
                </label>
                <div className="flex flex-col justify-end gap-2">
                  <button
                    onClick={fetchCandidates}
                    disabled={candidateLoading}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    Apply filters
                  </button>
                  <span className="text-xs text-zinc-500">
                    Use filters when the list feels too broad or too sparse.
                  </span>
                </div>
              </div>
              {candidateError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {candidateError}
                </div>
              )}
              {candidateLoading ? (
                <div className="flex items-center justify-center py-12 text-zinc-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-zinc-600 border-t-transparent mr-3"></div>
                  Extracting potential accounts...
                </div>
              ) : candidateList.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-zinc-300 font-medium mb-2">No candidates found</p>
                  <p className="text-sm text-zinc-500">
                    Try syncing more important people or lowering the threshold.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-end">
                    <button
                      onClick={handleBatchAdd}
                      disabled={selectedCandidates.length === 0 || isBatchAdding}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {isBatchAdding ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                      Add selected ({selectedCandidates.length})
                    </button>
                  </div>
                  <div className="overflow-x-auto max-h-[500px] pr-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800/80 text-left text-zinc-400">
                          <th className="py-3 px-2">
                            <input
                              type="checkbox"
                              checked={
                                candidateList.length > 0 &&
                                selectedCandidates.length === candidateList.length
                              }
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate =
                                    selectedCandidates.length > 0 &&
                                    selectedCandidates.length < candidateList.length;
                                }
                              }}
                              onChange={toggleSelectAllCandidates}
                            />
                          </th>
                          <th className="py-3 px-2">Username</th>
                          <th className="py-3 px-2">Followers</th>
                          <th className="py-3 px-2">Weight Sum</th>
                          <th className="py-3 px-2">Score</th>
                          <th className="py-3 px-2">Followed By</th>
                          <th className="py-3 px-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidateList.map((candidate) => {
                          const isSelected = selectedCandidates.includes(candidate.followed_username);
                          return (
                            <tr
                              key={candidate.followed_user_id || candidate.followed_username}
                              className="border-b border-zinc-800/40"
                            >
                              <td className="py-3 px-2">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCandidateSelection(candidate.followed_username)}
                                />
                              </td>
                              <td className="py-3 px-2">
                                <span className="text-white font-medium">@{candidate.followed_username}</span>
                                <div className="text-xs text-zinc-500">{candidate.followed_user_id}</div>
                              </td>
                              <td className="py-3 px-2 text-zinc-200">{candidate.follower_count}</td>
                              <td className="py-3 px-2 text-zinc-200">{candidate.total_weight.toFixed(1)}</td>
                              <td className="py-3 px-2 text-zinc-200">{candidate.importance_score.toFixed(1)}</td>
                              <td className="py-3 px-2">
                                <div className="flex flex-wrap gap-1">
                                  {candidate.sample_followed_by.map((follower) => (
                                    <span
                                      key={`${candidate.followed_username}-${follower.user_id}`}
                                      className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-300"
                                    >
                                      @{follower.username}
                                    </span>
                                  ))}
                                  {candidate.follower_count > candidate.sample_followed_by.length && (
                                    <span className="text-xs text-zinc-500">
                                      +{candidate.follower_count - candidate.sample_followed_by.length} more
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <button
                                  onClick={() => handleAddCandidate(candidate)}
                                  disabled={!!candidateAdding[candidate.followed_username]}
                                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium disabled:opacity-50"
                                >
                                  {candidateAdding[candidate.followed_username] ? (
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  )}
                                  Add
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tagModalPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="glass max-w-lg w-full mx-4 rounded-2xl border border-zinc-800 p-6 relative">
              <button
                onClick={closeTagModal}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                aria-label="Close tag modal"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="pr-8">
                <p className="text-sm text-zinc-500 uppercase tracking-wide mb-2">Tags</p>
                <h3 className="text-2xl font-bold text-white mb-1">Manage @{tagModalPerson.username}</h3>
                <p className="text-sm text-zinc-400">
                  Add descriptive tags to group this account by niche. Tags are free-form, but you can reuse existing ones below.
                </p>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm text-zinc-300 font-medium mb-2 block">Current tags</label>
                  {tagDraft.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {tagDraft.map((tag) => (
                        <span
                          key={`${tagModalPerson.username}-draft-${tag}`}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/15 text-indigo-100 border border-indigo-500/30 rounded-full text-sm"
                        >
                          #{tag}
                          <button
                            onClick={() => removeTagFromDraft(tag)}
                            className="text-indigo-200 hover:text-white transition"
                            aria-label={`Remove ${tag}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-500">No tags yet. Add the first one below.</p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-zinc-300 font-medium mb-2 block">Add new tag</label>
                  <input
                    type="text"
                    value={tagInputValue}
                    placeholder="Type a tag and press Enter"
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  <p className="text-xs text-zinc-500 mt-2">
                    Suggestions show tags already used elsewhere. Click to reuse and avoid duplicates.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-zinc-300 font-medium">Suggestions</span>
                    {isFetchingTags && (
                      <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse"></span>
                        Loading tags...
                      </span>
                    )}
                  </div>
                  {availableTags.length === 0 ? (
                    <p className="text-sm text-zinc-500">Tags will appear here once you start adding them.</p>
                  ) : tagSuggestions.length === 0 ? (
                    <p className="text-sm text-zinc-500">No suggestions match your search.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tagSuggestions.map((tag) => (
                        <button
                          key={`suggestion-${tag}`}
                          onClick={() => {
                            addTagToDraft(tag);
                            setTagInputValue('');
                          }}
                          className="px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 hover:border-indigo-500/60 transition"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={closeTagModal}
                    className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveTags}
                    disabled={isSavingTags}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {isSavingTags && (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12a8 8 0 018-8M20 12a8 8 0 01-8 8" />
                      </svg>
                    )}
                    Save tags
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

