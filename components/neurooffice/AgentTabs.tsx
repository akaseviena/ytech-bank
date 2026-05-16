"use client";

interface Tab {
  id: string;
  label: string;
}

interface AgentTabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function AgentTabs({ tabs, active, onChange }: AgentTabsProps) {
  return (
    <>
      {/* Desktop: pill tabs */}
      <div className="hidden sm:flex gap-1 mb-5 p-1 rounded-2xl" style={{ background: "#F5F5F5" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all duration-200"
            style={
              active === tab.id
                ? { background: "#FFFFFF", color: "#F5A623", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "#6B6B6B" }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Mobile: dropdown */}
      <select
        className="sm:hidden input-field mb-5 font-semibold text-[#1A1A1A]"
        value={active}
        onChange={(e) => onChange(e.target.value)}
      >
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>{tab.label}</option>
        ))}
      </select>
    </>
  );
}
