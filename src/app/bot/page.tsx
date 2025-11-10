'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ExtractedTask {
  task: string;
  type: 'task' | 'idea' | 'note';
  urgency: 'low' | 'medium' | 'high' | 'urgent' | 'none';
  startDate: string | null;
  endDate: string | null;
  description: string;
  tags: string[];
  assignedTo: string[];
}

interface ApiResponse {
  success: boolean;
  message: string;
  inserted: number;
  data: ExtractedTask[];
  error?: string;
}

export default function BotPage() {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedTask[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputText.trim()) {
      setMessage({
        type: 'error',
        text: 'Please enter some text to process',
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    setExtractedData(null);

    try {
      const response = await fetch('/api/extract-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: inputText.trim() }),
      });

      const data: ApiResponse = await response.json();

      if (response.ok && data.success) {
        setExtractedData(data.data);
        setMessage({
          type: 'success',
          text: data.message,
        });
        setInputText(''); // Clear input on success
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to process text',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessage({
        type: 'error',
        text: 'Network error. Please check your connection and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'task':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
        );
      case 'idea':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
          </svg>
        );
      case 'note':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
            <path d="M3 8a2 2 0 012-2v10h8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        );
      default:
        return null;
    }
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
          <div className="max-w-4xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-zinc-400 text-sm font-medium">AI Task Extractor</span>
            </div>

            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="gradient-text">Smart Task</span>
              <br />
              <span className="text-white">Extraction.</span>
            </h1>

            <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto leading-relaxed">
              Transform unstructured text into organized, actionable tasks. 
              Powered by AI to extract tasks, ideas, and notes automatically.
            </p>

            <div className="flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>AI-powered extraction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Structured data output</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-zinc-500 rounded-full"></div>
                <span>Instant MongoDB storage</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-3xl mx-auto px-6 pb-20">
          {/* Input Card */}
          <div className="glass rounded-2xl p-8 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="inputText"
                  className="block text-sm font-semibold text-white mb-3"
                >
                  Paste or type your text
                </label>
                <textarea
                  id="inputText"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Example: Ruchir please finish the landing page redesign by next Tuesday. Husain will help with copywriting. Add this to marketing sprint."
                  rows={8}
                  className="w-full px-6 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all text-base resize-none"
                  disabled={isLoading}
                />
                <p className="mt-3 text-sm text-zinc-500">
                  Enter messages, tasks, notes, or ideas. The AI will extract structured information automatically.
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="w-full gradient-primary hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 text-lg shadow-lg shadow-indigo-500/25"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Process & Store
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

          {/* Extracted Data Display */}
          {extractedData && extractedData.length > 0 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">extracted data:</h2>
                <p className="text-zinc-400">Successfully parsed and stored in MongoDB</p>
              </div>

              {/* Task Cards */}
              <div className="space-y-4">
                {extractedData.map((item, index) => (
                  <div key={index} className="glass rounded-2xl p-6">
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center flex-shrink-0 text-white">
                        {getTypeIcon(item.type)}
                      </div>

                      <div className="flex-1 space-y-3">
                        {/* Title and Type */}
                        <div className="flex items-start justify-between gap-4">
                          <h3 className="text-white font-semibold text-lg">{item.task}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700 capitalize">
                              {item.type}
                            </span>
                            <span
                              className={`text-xs px-3 py-1 rounded-full border capitalize ${getUrgencyColor(
                                item.urgency
                              )}`}
                            >
                              {item.urgency}
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-zinc-400 leading-relaxed">{item.description}</p>

                        {/* Meta Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                          {/* Dates */}
                          {(item.startDate || item.endDate) && (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                              <p className="text-xs text-zinc-500 mb-1">Timeline</p>
                              <div className="text-sm text-white">
                                {item.startDate && (
                                  <div>
                                    Start: {new Date(item.startDate).toLocaleDateString()}
                                  </div>
                                )}
                                {item.endDate && (
                                  <div>End: {new Date(item.endDate).toLocaleDateString()}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Assigned To */}
                          {item.assignedTo.length > 0 && (
                            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                              <p className="text-xs text-zinc-500 mb-1">Assigned to</p>
                              <div className="flex flex-wrap gap-2">
                                {item.assignedTo.map((person, i) => (
                                  <span
                                    key={i}
                                    className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded border border-indigo-500/30"
                                  >
                                    {person}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Tags */}
                        {item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {item.tags.map((tag, i) => (
                              <span
                                key={i}
                                className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full border border-zinc-700"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Process Another Button */}
              <div className="text-center pt-8">
                <button
                  onClick={() => {
                    setExtractedData(null);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-semibold rounded-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Process Another
                </button>
              </div>
            </div>
          )}

          {/* How it Works */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold text-white mb-8">How it works:</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">1</span>
                </div>
                <h3 className="text-white font-semibold mb-2">Input Text</h3>
                <p className="text-zinc-400 text-sm">Paste messages, notes, or task descriptions</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">2</span>
                </div>
                <h3 className="text-white font-semibold mb-2">AI Extraction</h3>
                <p className="text-zinc-400 text-sm">LLM analyzes and extracts structured data</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">3</span>
                </div>
                <h3 className="text-white font-semibold mb-2">MongoDB Storage</h3>
                <p className="text-zinc-400 text-sm">Data automatically saved to database</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-lg">4</span>
                </div>
                <h3 className="text-white font-semibold mb-2">View Results</h3>
                <p className="text-zinc-400 text-sm">See extracted tasks with all details</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-20 py-8 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <p className="text-zinc-500 text-sm">
              Powered by Identity Labs • AI-driven task management
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

