/**
 * Smart Document Suggestions Components (Feature #22)
 *
 * This module exports all components related to the intelligent
 * document suggestion system.
 */

export { default as SuggestionsPanel } from '../SuggestionsPanel';
export { default as TopicMap } from '../TopicMap';
export { default as SmartPrompt, StalenessAlert } from '../SmartPrompt';
export { default as QuickSuggestions, OthersAlsoViewed } from '../QuickSuggestions';

// Re-export hooks
export {
  useSuggestions,
  useDocumentViewTracking,
  useTopicClusters,
  useDocumentTags,
  useCoViewedDocuments,
  useStalenessScore,
} from '../../hooks/useSuggestions';

// Re-export types
export type {
  DocumentSuggestion,
  SuggestionType,
  SuggestionContext,
  UseSuggestionsOptions,
  UseSuggestionsReturn,
} from '../../hooks/useSuggestions';
