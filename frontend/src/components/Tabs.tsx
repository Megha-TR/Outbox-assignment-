"use client";

import { clsx } from "clsx";

interface TabsProps {
  activeTab: "scheduled" | "sent";
  onChange: (tab: "scheduled" | "sent") => void;
}

export function Tabs({ activeTab, onChange }: TabsProps) {
  const tabs = [
    { id: "scheduled" as const, label: "Scheduled Emails" },
    { id: "sent" as const, label: "Sent Emails" },
  ];

  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "rounded-lg px-4 py-2 text-sm font-medium transition",
            activeTab === tab.id
              ? "bg-white text-brand-700 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
