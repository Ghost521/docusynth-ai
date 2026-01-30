import React, { useState, useCallback, useMemo } from 'react';
import { Icons, MaterialIcon } from '../Icon';
import { MCPGraph, MCPNode, MCPNodeType } from '../../types';
import { compileGraphToTypeScript, createDefaultGraph, createToolNode, createResourceNode, createPromptNode, generateSlug } from '../../services/mcpGraphCompiler';
import MCPCodePreview from './MCPCodePreview';
import MCPDeployPanel from './MCPDeployPanel';
import MCPTestPanel from './MCPTestPanel';
import MCPVersionHistory from './MCPVersionHistory';
import MCPTooltip from './MCPTooltip';
import MCPAIAssistant from './MCPAIAssistant';

interface MCPBuilderProps {
  initialGraph?: MCPGraph;
  initialName?: string;
  initialSlug?: string;
  serverId?: string;
  versionHistory?: Array<{ version: number; code: string; graph: any; createdAt: number; label?: string }>;
  currentVersion?: number;
  onSave?: (data: { name: string; slug: string; description: string; category: string; tags: string[]; graph: MCPGraph; generatedCode: string }) => void;
  onBack?: () => void;
}

const CATEGORIES = ['Documentation', 'Code Analysis', 'Data & APIs', 'DevOps', 'Productivity', 'Custom'];

const MIME_OPTIONS = [
  'text/plain',
  'application/json',
  'text/html',
  'text/markdown',
  'application/xml',
];

// Friendly label mapping
const NODE_TYPE_LABELS: Record<MCPNodeType, string> = {
  tool: 'Action',
  resource: 'Data Source',
  prompt: 'Instruction Template',
  transport: 'Transport',
  config: 'Config',
};

const NODE_TYPE_TOOLTIPS: Record<string, string> = {
  tool: 'An action your server performs when asked by an AI agent',
  resource: 'A file or data endpoint AI agents can read',
  prompt: 'Reusable instructions for how the AI should behave',
};

// Starter templates
interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  create: () => MCPNode[];
}

const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'doc-search',
    name: 'Documentation Search',
    description: 'A pre-built search action that queries documentation by keyword',
    icon: 'search',
    create: () => [
      createToolNode('search_docs', 'Search documentation by keyword and return relevant results', 200, 100),
    ],
  },
  {
    id: 'url-fetcher',
    name: 'URL Fetcher',
    description: 'Fetch and summarize web pages for AI consumption',
    icon: 'language',
    create: () => [
      createToolNode('fetch_url', 'Fetch a URL and return its content summarized for AI', 200, 100),
    ],
  },
  {
    id: 'project-context',
    name: 'Project Context',
    description: 'Expose project files and instructions to AI agents',
    icon: 'folder_open',
    create: () => [
      createResourceNode('project_files', 'Project source files and documentation', 'resource://project/files', 200, 100),
      createPromptNode('project_instructions', 'System instructions for working with this project', 'You are a helpful assistant with access to the project files. Use the available resources to answer questions accurately.', 200, 220),
    ],
  },
  {
    id: 'scratch',
    name: 'Start from Scratch',
    description: 'Empty canvas for advanced users',
    icon: 'edit_note',
    create: () => [],
  },
];

// Parameter row type for visual builder
interface ParamRow {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
}

function schemaToRows(schema: any): ParamRow[] {
  if (!schema?.properties) return [];
  const required = new Set(schema.required || []);
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type === 'number' || prop.type === 'integer' ? 'number' : prop.type === 'boolean' ? 'boolean' : 'string',
    required: required.has(name),
  }));
}

function rowsToSchema(rows: ParamRow[]): any {
  if (rows.length === 0) return { type: 'object', properties: {} };
  const properties: any = {};
  const required: string[] = [];
  for (const row of rows) {
    if (!row.name.trim()) continue;
    properties[row.name.trim()] = { type: row.type };
    if (row.required) required.push(row.name.trim());
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) };
}

const MCPBuilder: React.FC<MCPBuilderProps> = ({
  initialGraph, initialName = '', initialSlug = '', serverId,
  versionHistory = [], currentVersion = 1, onSave, onBack,
}) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Custom');
  const [tagsInput, setTagsInput] = useState('');
  const [graph, setGraph] = useState<MCPGraph>(initialGraph || createDefaultGraph(initialName || 'My Server'));
  const [rightPanel, setRightPanel] = useState<'deploy' | 'test' | 'history'>('deploy');
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'simple' | 'advanced'>('simple');
  const [showAdvancedFields, setShowAdvancedFields] = useState<Record<string, boolean>>({});
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [paramMode, setParamMode] = useState<Record<string, 'visual' | 'json'>>({});
  const [templatePicked, setTemplatePicked] = useState(!!initialGraph);
  const [customMime, setCustomMime] = useState<Record<string, boolean>>({});

  const generatedCode = useMemo(() => compileGraphToTypeScript(graph), [graph]);

  const slug = useMemo(() => generateSlug(name || 'my-server'), [name]);

  const tools = graph.nodes.filter((n) => n.type === 'tool');
  const resources = graph.nodes.filter((n) => n.type === 'resource');
  const prompts = graph.nodes.filter((n) => n.type === 'prompt');

  const addNode = useCallback((type: MCPNodeType) => {
    const y = graph.nodes.length * 120 + 100;
    let node: MCPNode;
    switch (type) {
      case 'tool':
        node = createToolNode(`action_${tools.length + 1}`, 'A new action', 200, y);
        break;
      case 'resource':
        node = createResourceNode(`data_source_${resources.length + 1}`, 'A new data source', `resource://data_source_${resources.length + 1}`, 200, y);
        break;
      case 'prompt':
        node = createPromptNode(`instruction_${prompts.length + 1}`, 'A new instruction template', 'You are a helpful assistant.', 200, y);
        break;
      default:
        return;
    }
    setGraph((prev) => ({ ...prev, nodes: [...prev.nodes, node] }));
  }, [graph.nodes.length, tools.length, resources.length, prompts.length]);

  const removeNode = useCallback((nodeId: string) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
    }));
    if (editingNode === nodeId) setEditingNode(null);
  }, [editingNode]);

  const updateNode = useCallback((nodeId: string, updates: Partial<MCPNode>) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => n.id === nodeId ? { ...n, ...updates } : n),
    }));
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave?.({
      name: name.trim(),
      slug,
      description: description.trim(),
      category,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      graph,
      generatedCode,
    });
  };

  const handlePickTemplate = (template: StarterTemplate) => {
    const nodes = template.create();
    if (nodes.length > 0) {
      setGraph((prev) => ({ ...prev, nodes: [...prev.nodes, ...nodes] }));
    }
    setTemplatePicked(true);
  };

  const handleAddAINodes = useCallback((nodes: MCPNode[]) => {
    setGraph((prev) => ({ ...prev, nodes: [...prev.nodes, ...nodes] }));
  }, []);

  const nodeTypeColors: Record<MCPNodeType, { bg: string; text: string; border: string; icon: string }> = {
    tool: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', icon: 'build' },
    resource: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', icon: 'folder_open' },
    prompt: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20', icon: 'chat' },
    transport: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20', icon: 'swap_horiz' },
    config: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20', icon: 'settings' },
  };

  const renderParamBuilder = (node: MCPNode) => {
    const mode = paramMode[node.id] || 'visual';
    const rows = schemaToRows(node.config?.inputSchema);

    const updateRows = (newRows: ParamRow[]) => {
      updateNode(node.id, { config: { ...node.config, inputSchema: rowsToSchema(newRows) } });
    };

    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-secondary uppercase tracking-wider">
            <MCPTooltip text="Define what inputs this action accepts">Parameters</MCPTooltip>
          </label>
          <button
            onClick={() => setParamMode((prev) => ({ ...prev, [node.id]: mode === 'visual' ? 'json' : 'visual' }))}
            className="text-[9px] text-primary hover:underline font-bold"
          >
            {mode === 'visual' ? 'Switch to JSON' : 'Switch to Visual'}
          </button>
        </div>
        {mode === 'visual' ? (
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={row.name}
                  onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], name: e.target.value }; updateRows(r); }}
                  placeholder="name"
                  className="flex-1 bg-background border border-border rounded-lg px-2 py-1 text-xs text-main focus:outline-none focus:border-primary"
                />
                <select
                  value={row.type}
                  onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], type: e.target.value as any }; updateRows(r); }}
                  className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-main focus:outline-none focus:border-primary"
                >
                  <option value="string">String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] text-secondary">
                  <input
                    type="checkbox"
                    checked={row.required}
                    onChange={(e) => { const r = [...rows]; r[i] = { ...r[i], required: e.target.checked }; updateRows(r); }}
                    className="rounded border-border"
                  />
                  Req
                </label>
                <button onClick={() => { const r = rows.filter((_, j) => j !== i); updateRows(r); }} className="p-1 text-secondary hover:text-red-500">
                  <Icons.X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => updateRows([...rows, { name: '', type: 'string', required: false }])}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
            >
              <Icons.Plus className="w-3 h-3" /> Add parameter
            </button>
          </div>
        ) : (
          <textarea
            value={JSON.stringify(node.config?.inputSchema || {}, null, 2)}
            onChange={(e) => {
              try {
                const schema = JSON.parse(e.target.value);
                updateNode(node.id, { config: { ...node.config, inputSchema: schema } });
              } catch { /* ignore invalid JSON while typing */ }
            }}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main font-mono resize-none h-20 focus:outline-none focus:border-primary"
            spellCheck={false}
          />
        )}
      </div>
    );
  };

  const renderMimeDropdown = (node: MCPNode) => {
    const current = node.config?.mimeType || 'text/plain';
    const isCustom = !MIME_OPTIONS.includes(current);
    const showCustom = customMime[node.id] ?? isCustom;

    return (
      <div>
        <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">
          <MCPTooltip text="The format of the data">Content Type</MCPTooltip>
        </label>
        <select
          value={showCustom ? '__other__' : current}
          onChange={(e) => {
            if (e.target.value === '__other__') {
              setCustomMime(prev => ({ ...prev, [node.id]: true }));
            } else {
              setCustomMime(prev => ({ ...prev, [node.id]: false }));
              updateNode(node.id, { config: { ...node.config, mimeType: e.target.value } });
            }
          }}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary"
        >
          {MIME_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          <option value="__other__">Other...</option>
        </select>
        {showCustom && (
          <input
            value={current}
            onChange={(e) => updateNode(node.id, { config: { ...node.config, mimeType: e.target.value } })}
            placeholder="e.g. application/pdf"
            className="w-full mt-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main font-mono focus:outline-none focus:border-primary"
          />
        )}
      </div>
    );
  };

  const renderNodeCard = (node: MCPNode) => {
    const colors = nodeTypeColors[node.type];
    const isEditing = editingNode === node.id;
    const advancedOpen = showAdvancedFields[node.id] || false;
    const label = NODE_TYPE_LABELS[node.type] || node.type;

    return (
      <div key={node.id} className={`border rounded-xl p-4 transition-all ${isEditing ? 'border-primary bg-primary/5' : 'border-border bg-surface hover:border-primary/30'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors.bg}`}>
              <MaterialIcon name={colors.icon} size={14} className={colors.text} />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>{label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setEditingNode(isEditing ? null : node.id)} className="p-1 text-secondary hover:text-primary rounded transition-all">
              <MaterialIcon name={isEditing ? 'close' : 'edit'} size={14} />
            </button>
            <button onClick={() => removeNode(node.id)} className="p-1 text-secondary hover:text-red-500 rounded transition-all">
              <Icons.Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Name</label>
              <input
                value={node.name}
                onChange={(e) => updateNode(node.id, { name: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Description</label>
              <input
                value={node.description}
                onChange={(e) => updateNode(node.id, { description: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary"
              />
            </div>

            {/* Advanced fields toggle */}
            {(node.type === 'tool' || node.type === 'resource' || node.type === 'prompt') && (
              <button
                onClick={() => setShowAdvancedFields((prev) => ({ ...prev, [node.id]: !advancedOpen }))}
                className="flex items-center gap-1 text-[10px] text-primary hover:underline font-bold"
              >
                <MaterialIcon name={advancedOpen ? 'expand_less' : 'expand_more'} size={14} />
                {advancedOpen ? 'Hide advanced options' : 'Show advanced options'}
              </button>
            )}

            {advancedOpen && node.type === 'tool' && (
              <>
                {renderParamBuilder(node)}
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">
                    <MCPTooltip text="JavaScript that runs when called">Response Logic</MCPTooltip>
                  </label>
                  <textarea
                    value={node.config?.handlerCode || ''}
                    onChange={(e) => updateNode(node.id, { config: { ...node.config, handlerCode: e.target.value } })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main font-mono resize-none h-16 focus:outline-none focus:border-primary"
                    spellCheck={false}
                    placeholder='JSON.stringify({ result: "hello" })'
                  />
                </div>
              </>
            )}
            {advancedOpen && node.type === 'resource' && (
              <>
                <div>
                  <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">
                    <MCPTooltip text="A unique identifier like a URL or file path">Address</MCPTooltip>
                  </label>
                  <input
                    value={node.config?.uri || ''}
                    onChange={(e) => updateNode(node.id, { config: { ...node.config, uri: e.target.value } })}
                    className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main font-mono focus:outline-none focus:border-primary"
                  />
                </div>
                {renderMimeDropdown(node)}
              </>
            )}
            {advancedOpen && node.type === 'prompt' && (
              <div>
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Template</label>
                <textarea
                  value={node.config?.template || ''}
                  onChange={(e) => updateNode(node.id, { config: { ...node.config, template: e.target.value } })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-main resize-none h-20 focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm font-bold text-main">{node.name}</p>
            <p className="text-xs text-secondary mt-0.5 line-clamp-1">{node.description}</p>
          </div>
        )}
      </div>
    );
  };

  // Template picker (shown when empty and no template picked yet)
  if (!templatePicked && graph.nodes.length === 0) {
    return (
      <div className="flex flex-col h-full animate-fadeIn">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-all">
                <MaterialIcon name="arrow_back" size={18} />
              </button>
            )}
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Icons.Server className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-main">New AI Server</h2>
              <p className="text-[10px] text-secondary">Build a server that gives AI agents access to your tools, data, and instructions.</p>
            </div>
          </div>
        </div>

        {/* Template picker */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">
            <h3 className="text-xl font-bold text-main text-center mb-2">Choose a starting template</h3>
            <p className="text-sm text-secondary text-center mb-8">Pick a template to get started quickly, or start from scratch.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STARTER_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => handlePickTemplate(tmpl)}
                  className="flex items-start gap-4 p-5 bg-surface border border-border rounded-2xl text-left hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <MaterialIcon name={tmpl.icon} size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-main">{tmpl.name}</p>
                    <p className="text-xs text-secondary mt-1 leading-relaxed">{tmpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Simple mode: full-width form, no side panels
  const formPanel = (
    <div className={`${builderMode === 'simple' ? 'flex-1' : 'w-[380px] shrink-0'} border-r border-border flex flex-col bg-background`}>
      <div className="p-4 border-b border-border space-y-3">
        <div>
          <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Server Name</label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setGraph((prev) => ({ ...prev, metadata: { ...prev.metadata, name: e.target.value } }));
            }}
            placeholder="My AI Server"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this server do?"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-main resize-none h-14 focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary"
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">Tags</label>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="api, docs"
              className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-xs text-main focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Add Node Buttons */}
      <div className="px-4 py-3 border-b border-border flex gap-2">
        <button onClick={() => addNode('tool')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg text-[10px] font-bold transition-all">
          <MaterialIcon name="build" size={12} /> Action
        </button>
        <button onClick={() => addNode('resource')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-bold transition-all">
          <MaterialIcon name="folder_open" size={12} /> Data Source
        </button>
        <button onClick={() => addNode('prompt')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-500 border border-purple-500/20 rounded-lg text-[10px] font-bold transition-all">
          <MaterialIcon name="chat" size={12} /> Instruction
        </button>
      </div>

      {/* Node List */}
      <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar">
        {graph.nodes.length === 0 ? (
          <div className="text-center py-12">
            <MaterialIcon name="add_circle_outline" size={32} className="text-secondary/30 mx-auto mb-3" />
            <p className="text-xs text-secondary">Add actions, data sources, or instructions</p>
            <p className="text-[10px] text-secondary/60 mt-1">Click the buttons above to get started</p>
          </div>
        ) : (
          graph.nodes.map(renderNodeCard)
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-fadeIn">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-surface/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-1.5 text-secondary hover:text-main hover:bg-surface-hover rounded-lg transition-all">
              <MaterialIcon name="arrow_back" size={18} />
            </button>
          )}
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Icons.Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-main">{name || 'New AI Server'}</h2>
            <p className="text-[10px] text-secondary">Build a server that gives AI agents access to your tools, data, and instructions.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Simple / Advanced toggle */}
          <div className="flex items-center bg-surface-hover/70 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setBuilderMode('simple')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${builderMode === 'simple' ? 'bg-primary text-white' : 'text-secondary hover:text-main'}`}
            >
              Simple
            </button>
            <button
              onClick={() => setBuilderMode('advanced')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${builderMode === 'advanced' ? 'bg-primary text-white' : 'text-secondary hover:text-main'}`}
            >
              Advanced
            </button>
          </div>

          {/* AI Help button */}
          <button
            onClick={() => setShowAIAssistant(!showAIAssistant)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${showAIAssistant ? 'bg-primary/10 text-primary border-primary/20' : 'bg-surface-hover border-border text-secondary hover:text-main'}`}
          >
            <MaterialIcon name="auto_awesome" size={14} />
            AI Help
          </button>

          {/* Preview Code (simple mode) */}
          {builderMode === 'simple' && (
            <button
              onClick={() => setShowCodeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-hover border border-border text-main rounded-xl text-xs font-bold hover:bg-surface transition-all"
            >
              <MaterialIcon name="code" size={14} />
              Preview Code
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            <MaterialIcon name="save" size={14} />
            Save Server
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {formPanel}

        {builderMode === 'advanced' && (
          <>
            {/* Center Panel — Code Preview */}
            <div className="flex-1 flex flex-col min-w-0">
              <MCPCodePreview code={generatedCode} serverName={name} />
            </div>

            {/* Right Panel — Deploy/Test/History */}
            <div className="w-[300px] border-l border-border flex flex-col shrink-0 bg-background">
              <div className="flex border-b border-border">
                {(['deploy', 'test', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setRightPanel(tab)}
                    className={`flex-1 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 ${
                      rightPanel === tab ? 'border-primary text-primary' : 'border-transparent text-secondary hover:text-main'
                    }`}
                  >
                    {tab === 'deploy' ? 'Deploy' : tab === 'test' ? 'Test' : 'History'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {rightPanel === 'deploy' && (
                  <MCPDeployPanel
                    serverName={name || 'my-server'}
                    slug={slug || 'my-server'}
                    transport={graph.metadata.transport}
                    generatedCode={generatedCode}
                  />
                )}
                {rightPanel === 'test' && (
                  <MCPTestPanel
                    tools={tools.map((t) => ({
                      name: t.name,
                      description: t.description,
                      inputSchema: t.config?.inputSchema,
                    }))}
                  />
                )}
                {rightPanel === 'history' && (
                  <MCPVersionHistory
                    versions={versionHistory}
                    currentVersion={currentVersion}
                    onRevert={(v) => {
                      const entry = versionHistory.find((h) => h.version === v);
                      if (entry) setGraph(entry.graph);
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Code Preview Modal (simple mode) */}
      {showCodeModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setShowCodeModal(false)} />
          <div className="relative bg-surface border border-border rounded-2xl shadow-2xl max-w-4xl w-full h-[80vh] flex flex-col overflow-hidden">
            <div className="h-12 border-b border-border flex items-center justify-between px-4">
              <h3 className="text-sm font-bold text-main">Generated Code Preview</h3>
              <button onClick={() => setShowCodeModal(false)} className="p-1.5 text-secondary hover:text-main rounded-lg transition-all">
                <MaterialIcon name="close" size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MCPCodePreview code={generatedCode} serverName={name} />
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Panel */}
      <MCPAIAssistant
        isOpen={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        onAddNodes={handleAddAINodes}
      />
    </div>
  );
};

export default MCPBuilder;
