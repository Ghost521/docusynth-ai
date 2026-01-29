import React from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Icons } from "./Icon";

interface AlertButtonProps {
  onClick: () => void;
}

export default function AlertButton({ onClick }: AlertButtonProps) {
  const pendingCount = useQuery(api.alerts.getPendingCount);

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-secondary hover:text-orange-500 dark:hover:text-orange-400 hover:bg-surface-hover rounded-lg transition-colors"
      title={
        pendingCount && pendingCount > 0
          ? `${pendingCount} pending alerts`
          : "No pending alerts"
      }
    >
      <Icons.Bell className="w-5 h-5" />

      {/* Badge with count */}
      {pendingCount !== undefined && pendingCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-orange-500 rounded-full animate-pulse">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}

      {/* Active indicator dot when no pending but has alerts */}
      {pendingCount === 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
      )}
    </button>
  );
}
