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
  networth?: number;
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
  const [networthEdits, setNetworthEdits] = useState<Record<string, string>>({});
  const [updatingNetworth, setUpdatingNetworth] = useState<string | null>(null);
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
  const [allPeople, setAllPeople] = useState<ImportantPerson[]>([]);
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

  useEffect(() => {
    fetchImportantPeople();
    fetchSyncStatus();
    fetchAvailableTags();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed) {
      if (!hasLoadedAllPeople) {
        const timeoutId = setTimeout(() => {
          fetchAllPeople('search');
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hasLoadedAllPeople]);

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
        setNetworthEdits({});
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
          id: `${usernameToCheck}-${Date.now()}`,
          username: usernameToCheck,
          found: data.data.found,
          followed_username: data.data.followed_username,
          followed_user_id: data.data.followed_user_id,
          importance_score: data.data.importance_score,
          followed_by: data.data.followed_by || [],
        };
        
        setCheckResults((prev) => [result, ...prev]);
        setCheckUsername('');
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
        const summary = data.summary;
        if (summary && summary.total > 1) {
          setMessage({
            type: 'success',
            text: `${summary.added} of ${summary.total} people added successfully${summary.failed > 0 ? ` (${summary.failed} duplicates found)` : ''}`,
          });
        } else {
          setMessage({
            type: 'success',
            text: data.message || 'Important person added successfully!',
          });
        }
        setUsername('');
        clearAllPeopleCache();
        fetchImportantPeople(1);
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
        clearAllPeopleCache();
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
      text: `Syncing @${username}...`,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000);

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
        const summary = data.summary;
        if (summary && summary.total > 1) {
          setMessage({
            type: 'success',
            text: `${summary.succeeded} of ${summary.total} synced successfully!`,
          });
        } else {
          setMessage({
            type: 'success',
            text: `@${username} synced successfully!`,
          });
        }
        clearAllPeopleCache();
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
          text: 'Sync operation timed out.',
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

  const updatePeopleNetworth = (list: ImportantPerson[], username: string, networth: number | null) =>
    list.map((person) =>
      person.username === username ? { ...person, networth: networth ?? undefined } : person
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
      return;
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
        text: 'Network error.',
      });
    } finally {
      setUpdatingWeight(null);
    }
  };

  const handleNetworthInputChange = (username: string, value: string) => {
    setNetworthEdits((prev) => ({
      ...prev,
      [username]: value,
    }));
  };

  const handleNetworthSave = async (person: ImportantPerson) => {
    const inputValue = networthEdits[person.username] ?? (person.networth !== undefined ? person.networth.toString() : '');
    const trimmedValue = inputValue.trim();
    
    let parsedNetworth: number | null;
    if (trimmedValue === '') {
      parsedNetworth = null;
    } else {
      parsedNetworth = Number(trimmedValue);
      if (!Number.isFinite(parsedNetworth) || parsedNetworth < 0) {
        setMessage({
          type: 'error',
          text: 'Networth must be non-negative',
        });
        return;
      }
    }

    const currentNetworth = person.networth ?? null;
    if (parsedNetworth === currentNetworth) {
      return;
    }

    setUpdatingNetworth(person.username);

    try {
      const response = await fetch('/api/ranker/admin/important-person', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: person.username,
          networth: parsedNetworth,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage({
          type: 'success',
          text: data.message || `@${person.username} networth updated`,
        });
        setImportantPeople((prev) => updatePeopleNetworth(prev, person.username, parsedNetworth));
        setAllPeople((prev) => updatePeopleNetworth(prev, person.username, parsedNetworth));
        setNetworthEdits((prev) => {
          const next = { ...prev };
          delete next[person.username];
          return next;
        });
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to update networth',
        });
      }
    } catch (error) {
      console.error('Error updating networth:', error);
      setMessage({
        type: 'error',
        text: 'Network error.',
      });
    } finally {
      setUpdatingNetworth(null);
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
          ? `@${usernames[0]} added.`
          : `${addedUsernames.length} candidates added.`,
      });

      setCandidateList((prev) =>
        prev.filter((item) => !addedUsernames.includes(item.followed_username))
      );
      setSelectedCandidates((prev) => prev.filter((name) => !addedUsernames.includes(name)));
      clearAllPeopleCache();
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
    <div className="relative min-h-screen bg-white text-zinc-900">
      <Navbar />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.08),transparent_65%)]"></div>

      <div className="relative z-10 origin-top-left scale-75" style={{ width: '133.33%', height: '133.33%' }}>
        <div className="pt-20 pb-12">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 shadow-sm">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"></div>
              <span className="text-xs font-medium text-zinc-500">Importance Ranker</span>
            </div>

            <h1 className="mb-6 text-3xl font-semibold leading-tight text-zinc-900 md:text-4xl">
              Important Accounts
            </h1>

            {/* Stats Overview */}
            {syncStatus && (
              <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-white shadow-xl">
                  <div className="mb-1 text-3xl font-bold">
                    {syncStatus.summary.total_people}
                  </div>
                  <div className="text-xs text-zinc-400">Total Important People</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-white shadow-xl">
                  <div className="mb-1 text-3xl font-bold text-emerald-400">
                    {syncStatus.summary.synced_people}
                  </div>
                  <div className="text-xs text-zinc-400">Synced</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-white shadow-xl">
                  <div className="mb-1 text-3xl font-bold text-amber-400">
                    {syncStatus.summary.unsynced_people}
                  </div>
                  <div className="text-xs text-zinc-400">Pending Sync</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-6 pb-16">
          {/* Check Important Score Section */}
          <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <button
              onClick={() => setIsCheckSectionOpen(!isCheckSectionOpen)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="text-lg font-bold text-zinc-900">Check Importance Score</h2>
              <svg
                className={`h-5 w-5 text-zinc-400 transition-transform ${isCheckSectionOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCheckSectionOpen && (
              <div className="mt-6 space-y-6">
                <form onSubmit={handleCheckImportance} className="space-y-4">
                  <div>
                    <label htmlFor="check-username" className="mb-2 block text-xs font-semibold text-zinc-900">
                      Twitter Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
                      <input
                        type="text"
                        id="check-username"
                        value={checkUsername}
                        onChange={(e) => setCheckUsername(e.target.value)}
                        placeholder="elonmusk"
                        className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-8 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                        disabled={isCheckLoading}
                      />
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Enter a username to check their importance score.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isCheckLoading || !checkUsername.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {isCheckLoading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Checking...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Check Score
                      </>
                    )}
                  </button>
                </form>

                {/* Results Display */}
                {checkResults.length > 0 && (
                  <div className="mt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-900">Results</h3>
                    {checkResults.map((result) => (
                      <div
                        key={result.id}
                        className="relative space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-6"
                      >
                        <button
                          onClick={() => handleRemoveResult(result.id)}
                          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600"
                          title="Remove result"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>

                        <div className="flex items-start justify-between pr-8">
                          <div>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-zinc-900 border border-zinc-200 shadow-sm">
                                @{result.found ? result.followed_username || result.username : result.username}
                              </span>
                            </div>
                            {!result.found && (
                              <p className="mt-1 text-xs text-zinc-500">Account not found in index</p>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="mb-1 text-xs text-zinc-500">Importance Score</div>
                            <div className="text-2xl font-bold text-indigo-600">{result.importance_score.toFixed(2)}</div>
                          </div>
                        </div>

                        {result.found && result.followed_by.length > 0 && (
                          <div className="mt-4 border-t border-zinc-200 pt-4">
                            <div className="mb-3 text-xs font-semibold text-zinc-600">
                              Followed by {result.followed_by.length} important {result.followed_by.length === 1 ? 'person' : 'people'}:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {result.followed_by.map((follower) => (
                                <div
                                  key={`${result.id}-${follower.user_id}`}
                                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 shadow-sm"
                                >
                                  <div className="text-xs font-medium text-zinc-900">@{follower.username}</div>
                                  {follower.name && (
                                    <div className="mt-0.5 text-[10px] text-zinc-500">{follower.name}</div>
                                  )}
                                  {follower.weight !== undefined && follower.weight !== 1 && (
                                    <div className="mt-0.5 text-[10px] text-zinc-400">Weight: {follower.weight}</div>
                                  )}
                                </div>
                              ))}
                            </div>
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
          <div className="mb-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-bold text-zinc-900">Add Important Person</h2>
            
            <form onSubmit={handleAddPerson} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-2 block text-xs font-semibold text-zinc-900">
                  Twitter Username
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">@</span>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="elonmusk"
                    className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-8 pr-4 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition-all focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                    disabled={isLoading}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  Enter just the username.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !username.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-zinc-800 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Important Person
                  </>
                )}
              </button>
            </form>

            {message && (
              <div
                className={`mt-4 rounded-xl border p-4 ${
                  message.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                    : 'border-red-200 bg-red-50 text-red-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{message.text}</span>
                </div>
              </div>
            )}
          </div>

          {/* Important People Table */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-bold text-zinc-900">Important People</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={openCandidateModal}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Extract Candidates
                </button>
                <button
                  onClick={() => {
                    clearAllPeopleCache();
                    fetchImportantPeople();
                    fetchSyncStatus();
                  }}
                  disabled={isFetching}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <svg
                    className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                    return (
                      <button
                        key={filterKey}
                        onClick={() => setSyncFilter(filterKey)}
                        className={`rounded-full border px-3 py-1 text-[10px] font-medium transition ${
                          isActive
                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                        }`}
                      >
                        {filterKey === 'all' ? 'All' : filterKey === 'synced' ? 'Synced' : 'Not synced'}
                      </button>
                    );
                  })}
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setIsTagFilterOpen((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Tag filter
                    {selectedTags.length > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">
                        {selectedTags.length}
                      </span>
                    )}
                  </button>
                  {isTagFilterOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-zinc-200 bg-white shadow-xl">
                      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                        <p className="text-xs font-medium text-zinc-900">Filter by tags</p>
                        <button
                          onClick={() => { setSelectedTags([]); setIsTagFilterOpen(false); }}
                          className="text-[10px] text-zinc-500 hover:text-zinc-900"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        <div className="flex flex-wrap gap-2">
                          {availableTags.map((tag) => {
                            const isSelected = selectedTags.some(s => s.toLowerCase() === tag.toLowerCase());
                            return (
                              <button
                                key={`dropdown-tag-${tag}`}
                                onClick={() => setSelectedTags(prev => isSelected ? prev.filter(i => i.toLowerCase() !== tag.toLowerCase()) : [...prev, tag])}
                                className={`rounded-full border px-2 py-1 text-[10px] transition ${isSelected ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
                              >
                                #{tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-4 pr-10 text-xs text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-900"
                  disabled={isSearching}
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                    ×
                  </button>
                )}
              </div>
            </div>

            {importantPeople.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">No people added yet.</div>
            ) : filteredPeople.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">No results found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 font-semibold text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Username</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Weight</th>
                      <th className="px-4 py-3">Networth</th>
                      <th className="px-4 py-3">Tags</th>
                      <th className="px-4 py-3">Following</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {filteredPeople.map((person) => (
                      <tr key={person.username} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 font-medium text-zinc-900">@{person.username}</td>
                        <td className="px-4 py-3 text-zinc-600">{person.name || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={weightEdits[person.username] ?? (person.weight ?? 1).toString()}
                              onChange={(e) => handleWeightInputChange(person.username, e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleWeightSave(person)}
                              className="w-16 rounded border border-zinc-200 px-2 py-1 text-xs"
                            />
                            {weightEdits[person.username] && (
                              <button onClick={() => handleWeightSave(person)} className="text-[10px] text-indigo-600 hover:underline">Save</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            placeholder="Networth"
                            value={networthEdits[person.username] ?? (person.networth !== undefined ? person.networth.toString() : '')}
                            onChange={(e) => handleNetworthInputChange(person.username, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleNetworthSave(person)}
                            className="w-24 rounded border border-zinc-200 px-2 py-1 text-xs"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {person.tags?.map(tag => (
                              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600">#{tag}</span>
                            ))}
                            <button onClick={() => openTagModal(person)} className="text-[10px] text-zinc-400 hover:text-zinc-600">+</button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{person.following_count.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${person.last_synced ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {person.last_synced ? 'Synced' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleSyncPerson(person.username)} className="text-zinc-400 hover:text-indigo-600" title="Sync">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                            <button onClick={() => handleRemovePerson(person.username)} className="text-zinc-400 hover:text-red-600" title="Remove">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
              <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                <div>Page {currentPage} of {totalPages}</div>
                <div className="flex gap-2">
                  <button onClick={() => fetchImportantPeople(currentPage - 1)} disabled={currentPage === 1} className="rounded border border-zinc-200 px-3 py-1 hover:bg-zinc-50 disabled:opacity-50">Prev</button>
                  <button onClick={() => fetchImportantPeople(currentPage + 1)} disabled={currentPage === totalPages} className="rounded border border-zinc-200 px-3 py-1 hover:bg-zinc-50 disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Candidate Modal (Light) */}
        {isCandidateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900">Candidates</h3>
                <button onClick={closeCandidateModal} className="text-zinc-400 hover:text-zinc-600">×</button>
              </div>
              
              <div className="mb-4 flex flex-wrap gap-4 rounded-xl bg-zinc-50 p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-700">Min Important Followers</label>
                  <input
                    type="number"
                    value={candidateMinFollowers}
                    onChange={(e) => setCandidateMinFollowers(Math.max(1, Number(e.target.value)))}
                    className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-700">Min Weight</label>
                  <input
                    type="number"
                    value={candidateMinWeight}
                    onChange={(e) => setCandidateMinWeight(Math.max(0, Number(e.target.value)))}
                    className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={fetchCandidates}
                  disabled={candidateLoading}
                  className="self-end rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  Apply & Refresh
                </button>
              </div>

              {candidateLoading ? (
                <div className="py-12 text-center text-sm text-zinc-500">Loading candidates...</div>
              ) : candidateList.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500">No candidates found.</div>
              ) : (
                <>
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={handleBatchAdd}
                      disabled={selectedCandidates.length === 0 || isBatchAdding}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Add Selected ({selectedCandidates.length})
                    </button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-50 text-zinc-500">
                        <tr>
                          <th className="px-2 py-2"><input type="checkbox" onChange={toggleSelectAllCandidates} /></th>
                          <th className="px-2 py-2">Username</th>
                          <th className="px-2 py-2">Followers</th>
                          <th className="px-2 py-2">Weight Sum</th>
                          <th className="px-2 py-2">Score</th>
                          <th className="px-2 py-2">Followed By</th>
                          <th className="px-2 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {candidateList.map((candidate) => (
                          <tr key={candidate.followed_username}>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={selectedCandidates.includes(candidate.followed_username)}
                                onChange={() => toggleCandidateSelection(candidate.followed_username)}
                              />
                            </td>
                            <td className="px-2 py-2 font-medium text-zinc-900">@{candidate.followed_username}</td>
                            <td className="px-2 py-2 text-zinc-600">{candidate.follower_count}</td>
                            <td className="px-2 py-2 text-zinc-600">{candidate.total_weight.toFixed(1)}</td>
                            <td className="px-2 py-2 text-zinc-600">{candidate.importance_score.toFixed(1)}</td>
                            <td className="px-2 py-2">
                              <div className="flex flex-wrap gap-1">
                                {candidate.sample_followed_by.slice(0, 3).map(f => (
                                  <span key={f.username} className="rounded bg-zinc-100 px-1 text-[10px] text-zinc-600">@{f.username}</span>
                                ))}
                                {candidate.sample_followed_by.length > 3 && <span className="text-[10px] text-zinc-400">+{candidate.sample_followed_by.length - 3}</span>}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                onClick={() => handleAddCandidate(candidate)}
                                disabled={!!candidateAdding[candidate.followed_username]}
                                className="text-emerald-600 hover:underline"
                              >
                                Add
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tag Modal (Light) */}
        {tagModalPerson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900">Edit Tags: @{tagModalPerson.username}</h3>
                <button onClick={closeTagModal} className="text-zinc-400 hover:text-zinc-600">×</button>
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {tagDraft.map(tag => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                    #{tag}
                    <button onClick={() => removeTagFromDraft(tag)} className="hover:text-indigo-900">×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Add tag..."
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={closeTagModal} className="rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
                <button onClick={handleSaveTags} disabled={isSavingTags} className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-zinc-100 py-6">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <p className="text-xs text-zinc-400">
              Powered by Identity Labs • Importance Ranking System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
