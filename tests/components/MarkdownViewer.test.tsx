import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownViewer from '../../components/MarkdownViewer';
import { GeneratedDoc, IntegrationSettings } from '../../types';

// Mock react-markdown to avoid heavy rendering
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>
}));

// Mock react-syntax-highlighter
vi.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre data-testid="syntax-highlighter">{children}</pre>
}));

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {}
}));

// Mock Icon component
vi.mock('../../components/Icon', () => ({
  Icons: new Proxy({}, {
    get: () => ({ className, ...props }: any) => <span data-testid="icon" {...props} />
  })
}));

// Mock VersionHistoryModal
vi.mock('../../components/VersionHistoryModal', () => ({
  default: () => null
}));

// Mock SummaryModal
vi.mock('../../components/SummaryModal', () => ({
  default: () => null
}));

// Mock services
vi.mock('../../services/localAiService', () => ({
  checkOllamaConnection: vi.fn().mockResolvedValue(false),
  pushToOllama: vi.fn(),
  getTabnineContextSnippet: vi.fn(() => 'tabnine snippet'),
  getCodeWhispererContextSnippet: vi.fn(() => 'codewhisperer snippet'),
  getClaudeContextSnippet: vi.fn(() => 'claude snippet'),
  getGeminiContextSnippet: vi.fn(() => 'gemini snippet'),
  getOpenAIContextSnippet: vi.fn(() => 'openai snippet'),
}));

vi.mock('../../services/geminiService', () => ({
  summarizeContent: vi.fn().mockResolvedValue('Summary text'),
}));

vi.mock('../../services/langextract', () => ({
  convertToFormat: vi.fn(() => '{"meta":{},"body":"converted"}'),
}));

const mockDoc: GeneratedDoc = {
  id: 'doc-1',
  topic: 'React Testing',
  content: '# React Testing\n\nTest your components with confidence.',
  visibility: 'private',
  sources: [{ title: 'React Docs', url: 'https://react.dev' }],
  createdAt: Date.now()
};

const mockSettings: IntegrationSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  ollamaBaseModel: 'llama3',
  tabnineEnabled: false,
  cursorRulesEnabled: false,
  claudeModelPreference: 'claude-3-opus',
  geminiModelPreference: 'gemini-pro',
  openAiEnabled: false,
  openAiModelPreference: 'gpt-4'
};

const defaultProps = {
  doc: mockDoc,
  integrationSettings: mockSettings,
  onUpdateSettings: vi.fn(),
  onRefresh: vi.fn(),
  onRevert: vi.fn(),
  onUpdateVisibility: vi.fn(),
  onUpdateContent: vi.fn(),
  onMove: vi.fn(),
  onPushToGitHub: vi.fn()
};

describe('MarkdownViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders document content', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByTestId('markdown-content')).toBeInTheDocument();
  });

  it('displays document topic as filename', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('React_Testing.md')).toBeInTheDocument();
  });

  it('shows copy button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('copy button calls clipboard.writeText', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDoc.content);
  });

  it('shows "Copied" after copy click', async () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Copy'));
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });

  it('shows Edit button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('clicking Edit shows textarea', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByPlaceholderText('Edit your documentation content here...')).toBeInTheDocument();
  });

  it('shows Save and Cancel buttons in edit mode', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('Cancel exits edit mode', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Edit your documentation content here...')).not.toBeInTheDocument();
  });

  it('Save calls onUpdateContent', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save Changes'));
    expect(defaultProps.onUpdateContent).toHaveBeenCalledWith('doc-1', mockDoc.content);
  });

  it('shows format dropdown button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('MARKDOWN')).toBeInTheDocument();
  });

  it('shows visibility toggle', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('private')).toBeInTheDocument();
  });

  it('clicking visibility toggle calls onUpdateVisibility', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByTitle(/Switch to Public mode/i));
    expect(defaultProps.onUpdateVisibility).toHaveBeenCalledWith('doc-1', 'public');
  });

  it('shows Share button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('shows Refresh button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('clicking Refresh calls onRefresh', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Refresh'));
    expect(defaultProps.onRefresh).toHaveBeenCalledWith(mockDoc);
  });

  it('shows Push button for GitHub', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Push')).toBeInTheDocument();
  });

  it('clicking Push calls onPushToGitHub', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByText('Push'));
    expect(defaultProps.onPushToGitHub).toHaveBeenCalled();
  });

  it('shows Integrate button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Integrate')).toBeInTheDocument();
  });

  it('shows Summarize button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Summarize')).toBeInTheDocument();
  });

  it('does not show Edit/Share for shared docs', () => {
    const sharedDoc = { ...mockDoc, id: 'shared-123' };
    render(<MarkdownViewer {...defaultProps} doc={sharedDoc} />);
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    expect(screen.queryByText('Share')).not.toBeInTheDocument();
  });

  it('shows Import button for shared docs', () => {
    const sharedDoc = { ...mockDoc, id: 'shared-123' };
    const onSave = vi.fn();
    render(<MarkdownViewer {...defaultProps} doc={sharedDoc} onSaveSharedDoc={onSave} />);
    expect(screen.getByText('Import to My Docs')).toBeInTheDocument();
  });

  it('shows Organize button', () => {
    render(<MarkdownViewer {...defaultProps} />);
    expect(screen.getByText('Organize')).toBeInTheDocument();
  });

  it('clicking Organize calls onMove', () => {
    render(<MarkdownViewer {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Organize / Move to Project'));
    expect(defaultProps.onMove).toHaveBeenCalled();
  });
});
