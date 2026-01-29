import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Icons } from './Icon';
import type { Id } from '../convex/_generated/dataModel';

// ===============================================================
// Types
// ===============================================================

interface SSOSessionsManagerProps {
  workspaceId: Id<'workspaces'>;
  className?: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

interface SessionDetailsModalProps {
  session: SessionData;
  onClose: () => void;
  onTerminate: () => void;
  isTerminating: boolean;
}

interface SessionData {
  _id: Id<'ssoSessions'>;
  userId: Id<'users'>;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  provider: 'saml' | 'oidc';
  configName?: string;
}

// ===============================================================
// Session Details Modal
// ===============================================================

function SessionDetailsModal({
  session,
  onClose,
  onTerminate,
  isTerminating,
}: SessionDetailsModalProps) {
  const parseUserAgent = (ua?: string) => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' };

    let browser = 'Unknown';
    let os = 'Unknown';

    // Detect browser
    if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Safari/')) browser = 'Safari';
    else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera';

    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return { browser, os };
  };

  const { browser, os } = parseUserAgent(session.userAgent);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getTimeRemaining = (expiresAt: number) => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Expired';

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const isExpired = session.expiresAt < Date.now();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-main">
            Session Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-surface-hover"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Icons.User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-main">
                {session.userName || 'Unknown User'}
              </p>
              <p className="text-sm text-secondary">
                {session.userEmail || 'No email'}
              </p>
            </div>
          </div>

          {/* Session Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
              <div className="flex items-center gap-2 text-secondary mb-1">
                <Icons.Shield className="w-4 h-4" />
                <span className="text-xs uppercase font-medium">Provider</span>
              </div>
              <p className="text-sm font-medium text-main">
                {session.provider.toUpperCase()}
                {session.configName && ` - ${session.configName}`}
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
              <div className="flex items-center gap-2 text-secondary mb-1">
                <Icons.Monitor className="w-4 h-4" />
                <span className="text-xs uppercase font-medium">Device</span>
              </div>
              <p className="text-sm font-medium text-main">
                {session.deviceType || 'Unknown'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
              <div className="flex items-center gap-2 text-secondary mb-1">
                <Icons.Globe className="w-4 h-4" />
                <span className="text-xs uppercase font-medium">Browser</span>
              </div>
              <p className="text-sm font-medium text-main">
                {browser}
              </p>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
              <div className="flex items-center gap-2 text-secondary mb-1">
                <Icons.Smartphone className="w-4 h-4" />
                <span className="text-xs uppercase font-medium">OS</span>
              </div>
              <p className="text-sm font-medium text-main">
                {os}
              </p>
            </div>
          </div>

          {/* IP Address */}
          <div className="p-4 bg-gray-50 dark:bg-surface-hover/50 rounded-lg">
            <div className="flex items-center gap-2 text-secondary mb-1">
              <Icons.Server className="w-4 h-4" />
              <span className="text-xs uppercase font-medium">IP Address</span>
            </div>
            <p className="text-sm font-mono text-main">
              {session.ipAddress || 'Unknown'}
            </p>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-secondary">
              Session Timeline
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm text-secondary">
                  Created: {formatDate(session.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-sm text-secondary">
                  Last Activity: {formatDate(session.lastActivityAt)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isExpired ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <span className="text-sm text-secondary">
                  Expires: {formatDate(session.expiresAt)} ({getTimeRemaining(session.expiresAt)})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary hover:bg-surface-hover rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={onTerminate}
            disabled={isTerminating || isExpired}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isTerminating ? (
              <>
                <Icons.Loader className="w-4 h-4 animate-spin" />
                Terminating...
              </>
            ) : (
              <>
                <Icons.LogOut className="w-4 h-4" />
                Terminate Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===============================================================
// Confirm Terminate All Modal
// ===============================================================

interface ConfirmTerminateAllModalProps {
  sessionCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  isTerminating: boolean;
}

function ConfirmTerminateAllModal({
  sessionCount,
  onConfirm,
  onCancel,
  isTerminating,
}: ConfirmTerminateAllModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Icons.AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-main">
                Terminate All Sessions
              </h3>
              <p className="text-sm text-secondary">
                This action cannot be undone
              </p>
            </div>
          </div>

          <p className="text-secondary mb-6">
            Are you sure you want to terminate all <strong>{sessionCount}</strong> active SSO sessions?
            All users will be signed out and will need to re-authenticate.
          </p>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isTerminating}
              className="px-4 py-2 text-secondary hover:bg-surface-hover rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isTerminating}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isTerminating ? (
                <>
                  <Icons.Loader className="w-4 h-4 animate-spin" />
                  Terminating...
                </>
              ) : (
                <>
                  <Icons.LogOut className="w-4 h-4" />
                  Terminate All
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===============================================================
// Session Row Component
// ===============================================================

interface SessionRowProps {
  session: SessionData;
  onViewDetails: () => void;
  onTerminate: () => void;
  isTerminating: boolean;
}

function SessionRow({
  session,
  onViewDetails,
  onTerminate,
  isTerminating,
}: SessionRowProps) {
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const isExpired = session.expiresAt < Date.now();
  const isActive = Date.now() - session.lastActivityAt < 5 * 60 * 1000; // Active in last 5 minutes

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-border last:border-b-0 hover:bg-surface-hover/30 transition-colors">
      <div className="flex items-center gap-4">
        {/* Status Indicator */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-surface-hover flex items-center justify-center">
            <Icons.User className="w-5 h-5 text-secondary" />
          </div>
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
              isExpired ? 'bg-red-500' : isActive ? 'bg-green-500' : 'bg-yellow-500'
            }`}
          />
        </div>

        {/* User Info */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-main">
              {session.userName || 'Unknown User'}
            </span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              {session.provider.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-secondary">
            <span>{session.userEmail || 'No email'}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <span>{session.deviceType || 'Unknown device'}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Last Activity */}
        <div className="text-right hidden sm:block">
          <p className="text-sm text-secondary">
            {isExpired ? 'Expired' : `Active ${getTimeAgo(session.lastActivityAt)}`}
          </p>
          <p className="text-xs text-tertiary">
            {session.ipAddress || 'Unknown IP'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onViewDetails}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="View details"
          >
            <Icons.Info className="w-5 h-5" />
          </button>
          <button
            onClick={onTerminate}
            disabled={isTerminating || isExpired}
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Terminate session"
          >
            {isTerminating ? (
              <Icons.Loader className="w-5 h-5 animate-spin" />
            ) : (
              <Icons.LogOut className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===============================================================
// Main Component
// ===============================================================

export function SSOSessionsManager({
  workspaceId,
  className = '',
  onError,
  onSuccess,
}: SSOSessionsManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<'all' | 'saml' | 'oidc'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [showTerminateAll, setShowTerminateAll] = useState(false);
  const [terminatingSessionId, setTerminatingSessionId] = useState<Id<'ssoSessions'> | null>(null);
  const [isTerminatingAll, setIsTerminatingAll] = useState(false);

  // Queries
  const sessionsResult = useQuery(api.ssoSessions.listWorkspaceSessions, {
    workspaceId,
    limit: 100,
  });

  const sessionStats = useQuery(api.ssoSessions.getSessionStats, {
    workspaceId,
  });

  // Mutations
  const terminateSession = useMutation(api.ssoSessions.terminateSession);
  const terminateAllSessions = useMutation(api.ssoSessions.terminateAllSessions);

  // Filter sessions
  const filteredSessions = sessionsResult?.sessions?.filter((session) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        session.userName?.toLowerCase().includes(query) ||
        session.userEmail?.toLowerCase().includes(query) ||
        session.ipAddress?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Provider filter
    if (filterProvider !== 'all' && session.provider !== filterProvider) {
      return false;
    }

    // Status filter
    const isExpired = session.expiresAt < Date.now();
    if (filterStatus === 'active' && isExpired) return false;
    if (filterStatus === 'expired' && !isExpired) return false;

    return true;
  }) || [];

  const handleTerminateSession = async (sessionId: Id<'ssoSessions'>) => {
    setTerminatingSessionId(sessionId);
    try {
      await terminateSession({ sessionId, reason: 'Admin terminated' });
      onSuccess?.('Session terminated successfully');
      setSelectedSession(null);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to terminate session');
    } finally {
      setTerminatingSessionId(null);
    }
  };

  const handleTerminateAll = async () => {
    setIsTerminatingAll(true);
    try {
      await terminateAllSessions({ workspaceId });
      onSuccess?.('All sessions terminated successfully');
      setShowTerminateAll(false);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to terminate sessions');
    } finally {
      setIsTerminatingAll(false);
    }
  };

  // Loading state
  if (!sessionsResult) {
    return (
      <div className={`bg-surface rounded-xl border border-border ${className}`}>
        <div className="p-8 text-center">
          <Icons.Loader className="w-8 h-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-3 text-secondary">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface rounded-xl border border-border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-main">
              SSO Sessions
            </h2>
            <p className="text-sm text-secondary mt-1">
              Manage active Single Sign-On sessions for your workspace
            </p>
          </div>

          {/* Stats */}
          {sessionStats && (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-main">
                  {sessionStats.total}
                </p>
                <p className="text-xs text-secondary">Total</p>
              </div>
              <div className="w-px h-10 bg-gray-200 dark:bg-surface-hover" />
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {sessionStats.active}
                </p>
                <p className="text-xs text-secondary">Active</p>
              </div>
              <div className="w-px h-10 bg-gray-200 dark:bg-surface-hover" />
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {sessionStats.expired}
                </p>
                <p className="text-xs text-secondary">Expired</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-border bg-gray-50 dark:bg-surface-hover/30">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-surface text-main placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Provider Filter */}
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value as 'all' | 'saml' | 'oidc')}
            className="px-4 py-2 border border-border rounded-lg bg-surface text-main focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Providers</option>
            <option value="saml">SAML</option>
            <option value="oidc">OIDC</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
            className="px-4 py-2 border border-border rounded-lg bg-surface text-main focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>

          {/* Terminate All Button */}
          {filteredSessions.length > 0 && (
            <button
              onClick={() => setShowTerminateAll(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Icons.LogOut className="w-4 h-4" />
              Terminate All
            </button>
          )}
        </div>
      </div>

      {/* Sessions List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 dark:bg-surface-hover flex items-center justify-center mb-4">
              <Icons.Users className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-main mb-1">
              No sessions found
            </h3>
            <p className="text-secondary">
              {searchQuery || filterProvider !== 'all' || filterStatus !== 'all'
                ? 'Try adjusting your filters'
                : 'No active SSO sessions for this workspace'}
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <SessionRow
              key={session._id}
              session={session as SessionData}
              onViewDetails={() => setSelectedSession(session as SessionData)}
              onTerminate={() => handleTerminateSession(session._id)}
              isTerminating={terminatingSessionId === session._id}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {filteredSessions.length > 0 && (
        <div className="p-4 border-t border-border bg-gray-50 dark:bg-surface-hover/30">
          <div className="flex items-center justify-between text-sm text-secondary">
            <span>
              Showing {filteredSessions.length} of {sessionsResult.sessions?.length || 0} sessions
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterProvider('all');
                setFilterStatus('all');
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onTerminate={() => handleTerminateSession(selectedSession._id)}
          isTerminating={terminatingSessionId === selectedSession._id}
        />
      )}

      {/* Terminate All Confirmation Modal */}
      {showTerminateAll && (
        <ConfirmTerminateAllModal
          sessionCount={filteredSessions.length}
          onConfirm={handleTerminateAll}
          onCancel={() => setShowTerminateAll(false)}
          isTerminating={isTerminatingAll}
        />
      )}
    </div>
  );
}

// ===============================================================
// User Sessions Component (for individual user view)
// ===============================================================

interface UserSSOSessionsProps {
  userId: Id<'users'>;
  className?: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export function UserSSOSessions({
  userId,
  className = '',
  onError,
  onSuccess,
}: UserSSOSessionsProps) {
  const [terminatingSessionId, setTerminatingSessionId] = useState<Id<'ssoSessions'> | null>(null);

  const sessions = useQuery(api.ssoSessions.getUserSessions, { userId });
  const terminateSession = useMutation(api.ssoSessions.terminateSession);

  const handleTerminate = async (sessionId: Id<'ssoSessions'>) => {
    setTerminatingSessionId(sessionId);
    try {
      await terminateSession({ sessionId, reason: 'User terminated' });
      onSuccess?.('Session terminated');
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to terminate session');
    } finally {
      setTerminatingSessionId(null);
    }
  };

  if (!sessions) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-20 bg-gray-200 dark:bg-surface-hover rounded-lg" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className={`text-center py-8 text-secondary ${className}`}>
        No active SSO sessions
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {sessions.map((session) => {
        const isCurrentSession = false; // Would need to compare with current session
        const isExpired = session.expiresAt < Date.now();

        return (
          <div
            key={session._id}
            className={`p-4 rounded-lg border ${
              isCurrentSession
                ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                : 'border-border bg-surface'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  isExpired ? 'bg-red-500' : 'bg-green-500'
                }`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-main">
                      {session.deviceType || 'Unknown Device'}
                    </span>
                    {isCurrentSession && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-secondary">
                    {session.ipAddress || 'Unknown IP'} - Last active{' '}
                    {new Date(session.lastActivityAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {!isCurrentSession && !isExpired && (
                <button
                  onClick={() => handleTerminate(session._id)}
                  disabled={terminatingSessionId === session._id}
                  className="text-red-600 dark:text-red-400 hover:underline text-sm disabled:opacity-50"
                >
                  {terminatingSessionId === session._id ? 'Terminating...' : 'Terminate'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ===============================================================
// Compact Session Badge
// ===============================================================

interface SSOSessionBadgeProps {
  sessionCount: number;
  onClick?: () => void;
  className?: string;
}

export function SSOSessionBadge({
  sessionCount,
  onClick,
  className = '',
}: SSOSessionBadgeProps) {
  if (sessionCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
        hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors
        ${className}
      `}
    >
      <Icons.Users className="w-3 h-3" />
      <span>{sessionCount} active session{sessionCount !== 1 ? 's' : ''}</span>
    </button>
  );
}

export default SSOSessionsManager;
