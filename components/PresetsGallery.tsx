
import React, { useState, useMemo } from 'react';
import { Icons } from './Icon';
import { PRESETS, Preset } from '../data/presets';
import { GeneratedDoc } from '../types';

interface PresetsGalleryProps {
  onSelect: (preset: Pick<Preset, 'mode' | 'value'>) => void;
  history: GeneratedDoc[];
}

const TABS = [
  { id: 'popular', label: 'Popular', icon: Icons.Sparkles },
  { id: 'trending', label: 'Trending', icon: Icons.Zap },
  { id: 'recent', label: 'Recent', icon: Icons.History },
  { id: 'skills', label: 'Skills', icon: Icons.Cpu, badge: 'NEW' },
];

const PresetsGallery: React.FC<PresetsGalleryProps> = ({ onSelect, history }) => {
  const [activeTab, setActiveTab] = useState<string>('popular');

  const recentPresets = useMemo(() => {
    return history.slice(0, 10).map((doc, idx) => ({
      id: `recent-${doc.id}`,
      title: doc.topic,
      description: `Synthesized on ${new Date(doc.createdAt).toLocaleDateString()}`,
      mode: (doc.topic.includes('http') ? (doc.topic.includes('github.com') ? 'github' : 'crawl') : 'search') as 'search' | 'crawl' | 'github',
      value: doc.topic,
      icon: (doc.topic.includes('github.com') ? 'GitHub' : 'Globe') as keyof typeof Icons,
      category: 'recent' as const,
      sourceDisplay: doc.topic.replace('https://', '').replace('http://', '').split('/')[0] + (doc.topic.includes('/') ? '/...' : ''),
      tokens: 'N/A',
      snippets: 'N/A',
      updateTime: 'Recent'
    }));
  }, [history]);

  const displayPresets = useMemo(() => {
    if (activeTab === 'recent') return recentPresets;
    return PRESETS.filter(p => p.category === activeTab);
  }, [activeTab, recentPresets]);

  return (
    <div className="w-full mt-16 animate-fadeIn">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-t-xl border-x border-t
              ${activeTab === tab.id 
                ? 'bg-background border-border text-main' 
                : 'bg-surface border-transparent text-secondary hover:text-main hover:bg-surface-hover'}
            `}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-primary' : 'text-secondary/60'}`} />
            {tab.label}
            {tab.badge && (
              <span className="ml-1 text-[8px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full leading-none uppercase">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Table View */}
      <div className="w-full border border-border rounded-xl rounded-tl-none overflow-hidden bg-background">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface/30">
                <th className="pl-6 pr-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest w-1/4">Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest w-1/4">Source</th>
                <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest text-right">Tokens</th>
                <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest text-right">Snippets</th>
                <th className="px-4 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest text-right">Update</th>
                <th className="pl-4 pr-6 py-3 text-[10px] font-bold text-secondary uppercase tracking-widest w-12 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayPresets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-secondary text-sm italic opacity-50">
                    No items found in this category.
                  </td>
                </tr>
              ) : (
                displayPresets.map((preset) => {
                  const Icon = Icons[preset.icon] || Icons.Globe;
                  return (
                    <tr 
                      key={preset.id}
                      onClick={() => onSelect({ mode: preset.mode, value: preset.value })}
                      className="group border-b border-border/40 last:border-0 hover:bg-surface/50 cursor-pointer transition-all"
                    >
                      <td className="pl-6 pr-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-primary group-hover:text-emerald-500 transition-colors">
                          {preset.title}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-secondary group-hover:text-main transition-colors">
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[180px] font-mono text-[11px] opacity-70">
                            {preset.sourceDisplay}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-[11px] font-mono text-secondary">
                          {preset.tokens}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-[11px] font-mono text-secondary">
                          {preset.snippets}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <span className="text-[11px] text-secondary/70">
                          {preset.updateTime}
                        </span>
                      </td>
                      <td className="pl-4 pr-6 py-4 whitespace-nowrap">
                        <div className="flex justify-center">
                           <div className="w-5 h-5 rounded-full border border-primary/20 flex items-center justify-center bg-primary/5 group-hover:bg-primary/20 group-hover:border-primary/40 transition-all">
                              <Icons.Check className="w-2.5 h-2.5 text-primary" />
                           </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-4 bg-surface/10 border-t border-border flex items-center justify-between">
          <div className="text-[10px] font-bold text-secondary/60 uppercase tracking-widest">
            {activeTab === 'recent' ? `${recentPresets.length} DOCUMENTS` : `64,224 LIBRARIES INDEXED`}
          </div>
          <button className="flex items-center gap-2 text-[10px] font-bold text-primary hover:text-emerald-500 transition-colors uppercase tracking-widest">
            See active tasks
            <Icons.ArrowUpToLine className="w-3.5 h-3.5 rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresetsGallery;
