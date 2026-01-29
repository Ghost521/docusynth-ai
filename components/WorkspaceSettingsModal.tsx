import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Icons } from "./Icon";
import type { Id } from "../convex/_generated/dataModel";

interface WorkspaceSettingsModalProps {
  workspaceId: Id<"workspaces">;
  onClose: () => void;
  onDeleted?: () => void;
}

type Tab = "general" | "members" | "invitations" | "activity";

export default function WorkspaceSettingsModal({
  workspaceId,
  onClose,
  onDeleted,
}: WorkspaceSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [isSaving, setIsSaving] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const workspace = useQuery(api.workspaces.get, { workspaceId });
  const members = useQuery(api.workspaces.getMembers, { workspaceId });
  const activity = useQuery(api.workspaces.getActivity, { workspaceId, limit: 50 });

  const updateWorkspace = useMutation(api.workspaces.update);
  const inviteMember = useMutation(api.workspaces.inviteMember);
  const cancelInvitation = useMutation(api.workspaces.cancelInvitation);
  const updateMemberRole = useMutation(api.workspaces.updateMemberRole);
  const removeMember = useMutation(api.workspaces.removeMember);
  const transferOwnership = useMutation(api.workspaces.transferOwnership);
  const deleteWorkspace = useMutation(api.workspaces.remove);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || "");
    }
  }, [workspace]);

  if (!workspace) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-background rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  const isOwner = workspace.role === "owner";
  const isAdmin = workspace.role === "admin" || isOwner;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateWorkspace({
        workspaceId,
        name,
        description,
      });
    } catch (error) {
      console.error("Failed to save:", error);
    }
    setIsSaving(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await inviteMember({
        workspaceId,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail("");
    } catch (error: any) {
      alert(error.message || "Failed to send invitation");
    }
    setIsInviting(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await removeMember({ workspaceId, targetUserId: userId });
    } catch (error: any) {
      alert(error.message || "Failed to remove member");
    }
  };

  const handleChangeRole = async (userId: string, newRole: "admin" | "member" | "viewer") => {
    try {
      await updateMemberRole({ workspaceId, targetUserId: userId, newRole });
    } catch (error: any) {
      alert(error.message || "Failed to update role");
    }
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    if (!confirm("Are you sure you want to transfer ownership? This cannot be undone.")) return;
    try {
      await transferOwnership({ workspaceId, newOwnerId });
    } catch (error: any) {
      alert(error.message || "Failed to transfer ownership");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteWorkspace({ workspaceId });
      onDeleted?.();
      onClose();
    } catch (error: any) {
      alert(error.message || "Failed to delete workspace");
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "admin": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "member": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "viewer": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const tabs: { id: Tab; label: string; icon: keyof typeof Icons }[] = [
    { id: "general", label: "General", icon: "Settings" },
    { id: "members", label: "Members", icon: "Users" },
    { id: "invitations", label: "Invitations", icon: "Mail" },
    { id: "activity", label: "Activity", icon: "History" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
              {workspace.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{workspace.name}</h2>
              <p className="text-sm text-gray-400">Workspace Settings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <Icons.X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {tabs.map((tab) => {
            const Icon = Icons[tab.icon];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? "border-purple-500 text-purple-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* General Tab */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin}
                  className="w-full px-4 py-2 bg-gray-800 border border-border rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!isAdmin}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-border rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 resize-none"
                  placeholder="Describe your workspace..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  URL Slug
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">docusynth.ai/</span>
                  <span className="text-white">{workspace.slug}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Plan
                </label>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm capitalize ${
                    workspace.plan === "enterprise" ? "bg-purple-500/20 text-purple-400" :
                    workspace.plan === "pro" ? "bg-blue-500/20 text-blue-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {workspace.plan}
                  </span>
                  <span className="text-sm text-gray-500">
                    {workspace.memberCount}/{workspace.memberLimit} members
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg font-medium transition-colors"
                    >
                      Delete Workspace
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Members Tab */}
          {activeTab === "members" && (
            <div className="space-y-4">
              {members?.map((member) => (
                <div
                  key={member._id}
                  className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-border/50"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden">
                    {member.userImage ? (
                      <img src={member.userImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icons.User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{member.userName}</span>
                      {member.role === "owner" && (
                        <span title="Owner">
                          <Icons.Crown className="w-4 h-4 text-yellow-400" />
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 truncate">{member.userEmail}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.userId, e.target.value as any)}
                        className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs border ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                    )}
                    {isOwner && member.role !== "owner" && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleTransferOwnership(member.userId)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-yellow-400 transition-colors"
                          title="Transfer ownership"
                        >
                          <Icons.Crown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                          title="Remove member"
                        >
                          <Icons.UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invitations Tab */}
          {activeTab === "invitations" && (
            <div className="space-y-6">
              {/* Invite Form */}
              {isAdmin && (
                <form onSubmit={handleInvite} className="flex gap-3 p-4 bg-gray-800/50 rounded-lg border border-border/50">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={isInviting || !inviteEmail.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Icons.UserPlus className="w-4 h-4" />
                    {isInviting ? "Sending..." : "Invite"}
                  </button>
                </form>
              )}

              {/* Pending Invitations */}
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3">Pending Invitations</h3>
                {workspace.invitations && workspace.invitations.length > 0 ? (
                  <div className="space-y-2">
                    {workspace.invitations.map((invitation) => (
                      <div
                        key={invitation._id}
                        className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg border border-border/50"
                      >
                        <Icons.Mail className="w-5 h-5 text-gray-400" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">{invitation.email}</div>
                          <div className="text-sm text-gray-400">
                            Invited as {invitation.role} - expires {formatTimestamp(invitation.expiresAt)}
                          </div>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => cancelInvitation({ invitationId: invitation._id })}
                            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-red-400 transition-colors"
                            title="Cancel invitation"
                          >
                            <Icons.X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No pending invitations</p>
                )}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="space-y-2">
              {activity && activity.length > 0 ? (
                activity.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                      <Icons.History className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-300">
                        <span className="font-medium text-white">{item.userName}</span>
                        {" "}
                        {item.action.replace(/_/g, " ")}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(item.timestamp)}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No activity recorded</p>
              )}
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center rounded-xl">
            <div className="bg-gray-800 p-6 rounded-xl border border-border max-w-md">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Workspace?</h3>
              <p className="text-gray-400 text-sm mb-4">
                This will permanently delete the workspace and remove all members.
                Projects and documents will be moved to your personal workspace.
                This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  Delete Workspace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
