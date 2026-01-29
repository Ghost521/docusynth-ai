import React from "react";
import { Icons } from "./Icon";

interface PresenceUser {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  userColor: string;
  isEditing: boolean;
  isCurrentUser: boolean;
}

interface PresenceAvatarsProps {
  users: PresenceUser[];
  maxDisplay?: number;
  showEditingIndicator?: boolean;
}

export default function PresenceAvatars({
  users,
  maxDisplay = 5,
  showEditingIndicator = true,
}: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const displayUsers = users.slice(0, maxDisplay);
  const remainingCount = users.length - maxDisplay;

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {displayUsers.map((user) => (
          <div
            key={user.id}
            className="relative group"
            style={{ zIndex: displayUsers.length - displayUsers.indexOf(user) }}
          >
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full border-2 bg-gray-200 dark:bg-gray-600 flex items-center justify-center overflow-hidden transition-transform hover:scale-110 hover:z-50"
              style={{ borderColor: user.userColor }}
              title={user.userName}
            >
              {user.userImage ? (
                <img
                  src={user.userImage}
                  alt={user.userName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  className="text-xs font-bold text-white"
                  style={{ backgroundColor: user.userColor }}
                >
                  {user.userName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Editing indicator */}
            {showEditingIndicator && user.isEditing && (
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
                style={{ backgroundColor: user.userColor }}
              >
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            )}

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {user.userName}
              {user.isEditing && (
                <span className="ml-1 text-green-400">(editing)</span>
              )}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-gray-900" />
            </div>
          </div>
        ))}

        {/* Overflow count */}
        {remainingCount > 0 && (
          <div
            className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 flex items-center justify-center"
            title={`${remainingCount} more`}
          >
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
              +{remainingCount}
            </span>
          </div>
        )}
      </div>

      {/* Active viewers label */}
      <span className="ml-3 text-xs text-gray-500 dark:text-gray-400">
        {users.length === 1
          ? "1 viewer"
          : `${users.length} viewers`}
      </span>
    </div>
  );
}
