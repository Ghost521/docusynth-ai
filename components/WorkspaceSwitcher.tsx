import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Icons } from "./Icon";
import type { Id } from "../convex/_generated/dataModel";

interface WorkspaceSwitcherProps {
  currentWorkspaceId: Id<"workspaces"> | null;
  onWorkspaceChange: (workspaceId: Id<"workspaces"> | null) => void;
  onCreateWorkspace: () => void;
  onManageWorkspace: (workspaceId: Id<"workspaces">) => void;
}

export default function WorkspaceSwitcher({
  currentWorkspaceId,
  onWorkspaceChange,
  onCreateWorkspace,
  onManageWorkspace,
}: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const workspaces = useQuery(api.workspaces.listMyWorkspaces);
  const invitations = useQuery(api.workspaces.getMyInvitations);
  const acceptInvitation = useMutation(api.workspaces.acceptInvitation);
  const declineInvitation = useMutation(api.workspaces.declineInvitation);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentWorkspace = workspaces?.find((w) => w._id === currentWorkspaceId);

  const handleAcceptInvitation = async (invitationId: Id<"workspaceInvitations">) => {
    try {
      const result = await acceptInvitation({ invitationId });
      if (result?.workspaceId) {
        onWorkspaceChange(result.workspaceId);
      }
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    }
  };

  const handleDeclineInvitation = async (invitationId: Id<"workspaceInvitations">) => {
    try {
      await declineInvitation({ invitationId });
    } catch (error) {
      console.error("Failed to decline invitation:", error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-yellow-500/20 text-yellow-400";
      case "admin":
        return "bg-purple-500/20 text-purple-400";
      case "member":
        return "bg-blue-500/20 text-blue-400";
      case "viewer":
        return "bg-gray-500/20 text-gray-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 w-full rounded-lg bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 transition-colors"
      >
        {currentWorkspace ? (
          <>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
              {currentWorkspace.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-gray-200 truncate">
                {currentWorkspace.name}
              </div>
              <div className="text-xs text-gray-500 capitalize">{currentWorkspace.role}</div>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
              <Icons.User className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-gray-200">Personal</div>
              <div className="text-xs text-gray-500">My workspace</div>
            </div>
          </>
        )}
        <Icons.ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Personal Workspace */}
          <div className="p-2 border-b border-gray-700/50">
            <button
              onClick={() => {
                onWorkspaceChange(null);
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${
                !currentWorkspaceId
                  ? "bg-purple-500/20 text-purple-300"
                  : "hover:bg-gray-800 text-gray-300"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center">
                <Icons.User className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">Personal</div>
                <div className="text-xs text-gray-500">My workspace</div>
              </div>
              {!currentWorkspaceId && (
                <Icons.Check className="w-4 h-4 text-purple-400" />
              )}
            </button>
          </div>

          {/* Team Workspaces */}
          {workspaces && workspaces.length > 0 && (
            <div className="p-2 border-b border-gray-700/50">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team Workspaces
              </div>
              {workspaces.map((workspace) => (
                <div key={workspace._id} className="group relative">
                  <button
                    onClick={() => {
                      onWorkspaceChange(workspace._id);
                      setIsOpen(false);
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${
                      currentWorkspaceId === workspace._id
                        ? "bg-purple-500/20 text-purple-300"
                        : "hover:bg-gray-800 text-gray-300"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="text-sm font-medium truncate">{workspace.name}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getRoleBadgeColor(workspace.role)}`}>
                          {workspace.role}
                        </span>
                        <span className="text-xs text-gray-500">
                          {workspace.memberCount} member{workspace.memberCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    {currentWorkspaceId === workspace._id && (
                      <Icons.Check className="w-4 h-4 text-purple-400" />
                    )}
                  </button>
                  {/* Settings button for admins */}
                  {(workspace.role === "owner" || workspace.role === "admin") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onManageWorkspace(workspace._id);
                        setIsOpen(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-700 transition-all"
                      title="Manage workspace"
                    >
                      <Icons.Settings className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pending Invitations */}
          {invitations && invitations.length > 0 && (
            <div className="p-2 border-b border-gray-700/50">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Pending Invitations
              </div>
              {invitations.map((invitation) => (
                <div
                  key={invitation._id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800/50"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                    {invitation.workspaceName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-200 truncate">
                      {invitation.workspaceName}
                    </div>
                    <div className="text-xs text-gray-500">
                      Invited as {invitation.role}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAcceptInvitation(invitation._id)}
                      className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      title="Accept invitation"
                    >
                      <Icons.Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(invitation._id)}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      title="Decline invitation"
                    >
                      <Icons.X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create New Workspace */}
          <div className="p-2">
            <button
              onClick={() => {
                onCreateWorkspace();
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
                <Icons.Plus className="w-4 h-4 text-gray-500" />
              </div>
              <div className="text-sm font-medium">Create Team Workspace</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
