'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface SystemSettings {
  schedule_interval_minutes: number;
  updated_at: string;
}

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(30);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const response = await fetch('/api/socap/system-settings');
      const result = await response.json();
      
      if (result.success) {
        setSettings(result.data);
        setIntervalMinutes(result.data.schedule_interval_minutes);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      alert('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const response = await fetch('/api/socap/system-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_interval_minutes: intervalMinutes,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSettings(result.data);
        alert('Settings saved successfully! Remember to update your N8N schedule to match.');
      } else {
        alert(`Failed to save: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading settings...</div>
      </div>
    );
  }

  const recommendedAlertSpacing = Math.max(2, Math.floor(intervalMinutes * 0.8));

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/socap" className="text-blue-600 hover:underline mb-2 inline-block">
          ← Back to Campaigns
        </Link>
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure global settings for SOCAP monitoring system
        </p>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Schedule Interval */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Worker Schedule Interval (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="1440"
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 30)}
            className="w-full border rounded px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            How often the N8N workflow triggers worker jobs (must match your N8N schedule)
          </p>
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-800 font-semibold">
              ⚠️ CRITICAL: This MUST match your N8N schedule exactly!
            </p>
            <p className="text-sm text-red-700 mt-1">
              If N8N runs every 30 minutes but this is set to 15 minutes (or vice versa), jobs may not be processed correctly.
            </p>
            <p className="text-sm text-red-700 mt-1">
              After changing this value, you <strong>MUST</strong> update your N8N workflow schedule to match immediately.
            </p>
            <p className="text-sm text-blue-700 mt-2 pt-2 border-t border-red-300">
              Recommended alert spacing for campaigns: <strong>{recommendedAlertSpacing} minutes</strong>
            </p>
          </div>
        </div>

        {settings && (
          <div className="text-sm text-gray-500 pt-4 border-t">
            Last updated: {new Date(settings.updated_at).toLocaleString()}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-4">
          <button
            onClick={() => setIntervalMinutes(settings?.schedule_interval_minutes || 30)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
            disabled={saving}
          >
            Reset
          </button>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Info Section */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">About Schedule Interval</h3>
        <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
          <li>This controls how often the system checks for new engagements</li>
          <li>Must match your N8N workflow schedule exactly</li>
          <li>Shorter intervals (5 min) = faster alerts but more API calls</li>
          <li>Longer intervals (30 min) = fewer API calls but slower detection</li>
          <li>Alert spacing automatically adjusts to 80% of this interval</li>
        </ul>
      </div>
    </div>
  );
}

