// app/search/page.tsx
'use client';

import { useState } from 'react';
import { Search, ExternalLink, Calendar, Loader2, AlertCircle, Building2, CheckCircle, Star, Globe, Zap, Eye, Layers } from 'lucide-react';

interface SearchResult {
  type?: string;
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
  metadata?: {
    description?: string;
    keywords?: string;
    author?: string;
    publishedTime?: string;
  };
}

interface SearchResponse {
  success: boolean;
  response: string;
  sources: any[];
  mode: string;
  error?: string;
}

type SearchMode = 'search' | 'scrape' | 'deep';

export default function WebSearchPage() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatResponse = (text: string) => {
    const sections = text.split(/\n\s*\n/);
    
    return sections.map((section, index) => {
      // Check if it's a title (starts with **Title:** or ###)
      if (section.match(/^\*\*[^*]+:\*\*/) || section.match(/^#{1,3}\s/)) {
        const title = section.replace(/^\*\*([^*]+):\*\*/, '$1').replace(/^#{1,3}\s/, '');
        return (
          <div key={index} className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              {title}
            </h3>
          </div>
        );
      }
      
      // Check if it's a numbered list or bullet points
      if (section.match(/^\d+\.\s/) || section.match(/^[-*]\s/)) {
        const items = section.split(/\n(?=\d+\.\s|[-*]\s)/);
        return (
          <div key={index} className="mb-4">
            <ul className="space-y-3">
              {items.map((item, itemIndex) => {
                const cleanItem = item.replace(/^\d+\.\s|^[-*]\s/, '');
                const [title, ...content] = cleanItem.split(/:\s*/);
                
                return (
                  <li key={itemIndex} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      {content.length > 0 ? (
                        <>
                          <span className="font-medium text-gray-900">{title}:</span>
                          <span className="text-gray-700 ml-1">{content.join(': ')}</span>
                        </>
                      ) : (
                        <span className="text-gray-700">{title}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }
      
      // Check if it's sources section
      if (section.toLowerCase().includes('sources:') || section.includes('http')) {
        const lines = section.split('\n').filter(line => line.trim());
        return (
          <div key={index} className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Referenced Sources
            </h4>
            <div className="space-y-2">
              {lines.map((line, lineIndex) => {
                const urlMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
                if (urlMatch) {
                  return (
                    <a
                      key={lineIndex}
                      href={urlMatch[2]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-700 hover:text-blue-800 text-sm hover:underline"
                    >
                      • {urlMatch[1]}
                    </a>
                  );
                }
                return line.includes('http') ? (
                  <div key={lineIndex} className="text-blue-700 text-sm">• {line}</div>
                ) : null;
              })}
            </div>
          </div>
        );
      }
      
      // Regular paragraph
      if (section.trim()) {
        return (
          <p key={index} className="text-gray-700 leading-relaxed mb-4">
            {section.trim()}
          </p>
        );
      }
      
      return null;
    }).filter(Boolean);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Search Agent
          </h1>
          <p className="text-gray-600 text-lg">
            Get AI-powered answers with real-time web search powered by Perplexity
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything... (e.g., 'Tell me about Aussie Steel Direct', 'Latest AI developments')"
              className="w-full px-6 py-4 text-lg border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none pr-16"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Quick Search Examples */}
        <div className="mb-8">
          <p className="text-sm text-gray-600 mb-3">Try these example searches:</p>
          <div className="flex flex-wrap gap-2">
            {[
              'Latest developments in quantum computing',
              'Aussie Steel Direct company overview',
              'Current cryptocurrency market trends',
              'Recent climate change research',
              'AI industry news this week'
            ].map((example) => (
              <button
                key={example}
                onClick={() => setQuery(example)}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                disabled={isLoading}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-6">
            {/* AI Response */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                AI Summary
              </h2>
              <div className="prose prose-gray max-w-none">
                <div className="text-gray-700 leading-relaxed">
                  {formatResponse(results.response)}
                </div>
              </div>
            </div>

            {/* Sources */}
            {results.sources && results.sources.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  Sources & References ({results.sources.length})
                </h2>
                <div className="grid gap-4">
                  {results.sources.map((source: any, index: number) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-5 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="font-medium text-gray-900 flex-1">
                          {source.title || source.name || `Source ${index + 1}`}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Star className="w-3 h-3" />
                          Source {index + 1}
                        </div>
                      </div>
                      
                      {source.description && (
                        <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                          {source.description}
                        </p>
                      )}
                      
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Source
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Searching the web and generating response...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}