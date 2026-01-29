import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistorySidebar from '../../components/HistorySidebar';
import { GeneratedDoc, Project } from '../../types';

// Mock the Icon component
vi.mock('../../components/Icon', () => ({
  Icons: new Proxy({}, {
    get: () => ({ className, ...props }: any) => <span data-testid="icon" {...props} />
  })
}));

const now = Date.now();
const todayDoc: GeneratedDoc = {
  id: 'doc-1',
  topic: 'React Hooks Guide',
  content: '# React Hooks',
  visibility: 'public',
  sources: [{ title: 'React', url: 'https://react.dev' }],
  createdAt: now - 1000 // 1 second ago = today
};

const yesterdayDoc: GeneratedDoc = {
  id: 'doc-2',
  topic: 'TypeScript Patterns',
  content: '# TypeScript',
  visibility: 'private',
  sources: [],
  createdAt: now - 100000000 // ~1.1 days ago
};

const olderDoc: GeneratedDoc = {
  id: 'doc-3',
  topic: 'Node.js Best Practices',
  content: '# Node.js',
  visibility: 'private',
  sources: [],
  createdAt: now - 900000000 // ~10 days ago
};

const mockProjects: Project[] = [
  { id: 'proj-1', name: 'Frontend', visibility: 'public', createdAt: now }
];

const defaultProps = {
  history: [todayDoc, yesterdayDoc, olderDoc],
  projects: mockProjects,
  activeProjectId: null,
  onSelectProject: vi.fn(),
  onCreateProject: vi.fn(),
  onSelectDoc: vi.fn(),
  onDeleteDoc: vi.fn(),
  onMoveDoc: vi.fn(),
  onDropDoc: vi.fn(),
  onReorderProjects: vi.fn(),
  onDeleteProject: vi.fn(),
  onGenerateMCP: vi.fn(),
  onExportProject: vi.fn(),
  onClear: vi.fn(),
  onExportAll: vi.fn(),
  isOpen: true,
  onClose: vi.fn(),
  recentSearches: [],
  onReRunSearch: vi.fn(),
  onClearRecentSearches: vi.fn(),
  onGoHome: vi.fn()
};

describe('HistorySidebar', () => {
  it('renders document topics', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('React Hooks Guide')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Patterns')).toBeInTheDocument();
    expect(screen.getByText('Node.js Best Practices')).toBeInTheDocument();
  });

  it('shows "No documents yet." when history is empty', () => {
    render(<HistorySidebar {...defaultProps} history={[]} />);
    expect(screen.getByText('No documents yet.')).toBeInTheDocument();
  });

  it('calls onSelectDoc when document is clicked', () => {
    render(<HistorySidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('React Hooks Guide'));
    expect(defaultProps.onSelectDoc).toHaveBeenCalledWith(todayDoc);
  });

  it('groups documents by time period', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    // "Older" should appear for the old doc
    expect(screen.getByText('Older')).toBeInTheDocument();
  });

  it('renders project list', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('All Documents')).toBeInTheDocument();
  });

  it('shows "New Synthesis" button', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('New Synthesis')).toBeInTheDocument();
  });

  it('calls onGoHome when New Synthesis is clicked', () => {
    render(<HistorySidebar {...defaultProps} />);
    fireEvent.click(screen.getByText('New Synthesis'));
    expect(defaultProps.onGoHome).toHaveBeenCalled();
  });

  it('shows Export and Clear buttons when history exists', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('hides Export/Clear when history is empty', () => {
    render(<HistorySidebar {...defaultProps} history={[]} />);
    expect(screen.queryByText('Export')).not.toBeInTheDocument();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('renders search input when history exists', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByPlaceholderText('Filter context...')).toBeInTheDocument();
  });

  it('renders recent searches when provided', () => {
    render(<HistorySidebar {...defaultProps} recentSearches={['React', 'Vue']} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Vue')).toBeInTheDocument();
  });

  it('calls onCreateProject when create project button is clicked', () => {
    render(<HistorySidebar {...defaultProps} />);
    // The create project button has title "New Project"
    const btn = screen.getByTitle('New Project');
    fireEvent.click(btn);
    expect(defaultProps.onCreateProject).toHaveBeenCalled();
  });

  it('shows document count for All Documents', () => {
    render(<HistorySidebar {...defaultProps} />);
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 docs total
  });
});
