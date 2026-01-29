import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Icons } from './Icon';
import {
  SmartRules,
  SmartRule,
  SmartRuleField,
  SmartRuleOperator,
  SmartRuleLogic,
} from '../types';

interface SmartCollectionRulesProps {
  rules: SmartRules;
  onChange: (rules: SmartRules) => void;
}

const FIELD_OPTIONS: { value: SmartRuleField; label: string; icon: string }[] = [
  { value: 'tag', label: 'Tag', icon: 'Tag' },
  { value: 'project', label: 'Project', icon: 'Folder' },
  { value: 'date', label: 'Date', icon: 'Calendar' },
  { value: 'source', label: 'Source Type', icon: 'Globe' },
  { value: 'visibility', label: 'Visibility', icon: 'Eye' },
];

const OPERATOR_OPTIONS: Record<SmartRuleField, { value: SmartRuleOperator; label: string }[]> = {
  tag: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
  ],
  project: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  date: [
    { value: 'before', label: 'before' },
    { value: 'after', label: 'after' },
    { value: 'between', label: 'between' },
  ],
  source: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
  visibility: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
  ],
};

const SOURCE_OPTIONS = [
  { value: 'web', label: 'Web Search' },
  { value: 'crawl', label: 'Website Crawl' },
  { value: 'github', label: 'GitHub' },
  { value: 'notion', label: 'Notion Import' },
  { value: 'confluence', label: 'Confluence Import' },
  { value: 'manual', label: 'Manual Entry' },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private' },
  { value: 'workspace', label: 'Workspace' },
  { value: 'public', label: 'Public' },
];

const SmartCollectionRules: React.FC<SmartCollectionRulesProps> = ({
  rules,
  onChange,
}) => {
  const projects = useQuery(api.projects.list, {});

  const handleLogicChange = (logic: SmartRuleLogic) => {
    onChange({ ...rules, logic });
  };

  const handleAddRule = () => {
    const newRule: SmartRule = {
      field: 'tag',
      operator: 'contains',
      value: '',
    };
    onChange({ ...rules, rules: [...rules.rules, newRule] });
  };

  const handleUpdateRule = (index: number, updatedRule: SmartRule) => {
    const newRules = [...rules.rules];
    newRules[index] = updatedRule;
    onChange({ ...rules, rules: newRules });
  };

  const handleRemoveRule = (index: number) => {
    const newRules = rules.rules.filter((_, i) => i !== index);
    onChange({ ...rules, rules: newRules });
  };

  const handleFieldChange = (index: number, field: SmartRuleField) => {
    const operators = OPERATOR_OPTIONS[field];
    const defaultOperator = operators[0].value;
    handleUpdateRule(index, {
      field,
      operator: defaultOperator,
      value: '',
      secondValue: undefined,
    });
  };

  const renderValueInput = (rule: SmartRule, index: number) => {
    const { field, operator } = rule;

    // Project selector
    if (field === 'project') {
      return (
        <select
          value={rule.value}
          onChange={(e) => handleUpdateRule(index, { ...rule, value: e.target.value })}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select project...</option>
          {projects?.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      );
    }

    // Source type selector
    if (field === 'source') {
      return (
        <select
          value={rule.value}
          onChange={(e) => handleUpdateRule(index, { ...rule, value: e.target.value })}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select source...</option>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      );
    }

    // Visibility selector
    if (field === 'visibility') {
      return (
        <select
          value={rule.value}
          onChange={(e) => handleUpdateRule(index, { ...rule, value: e.target.value })}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="">Select visibility...</option>
          {VISIBILITY_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      );
    }

    // Date picker(s)
    if (field === 'date') {
      if (operator === 'between') {
        return (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="date"
              value={rule.value}
              onChange={(e) => handleUpdateRule(index, { ...rule, value: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-secondary text-sm">and</span>
            <input
              type="date"
              value={rule.secondValue || ''}
              onChange={(e) => handleUpdateRule(index, { ...rule, secondValue: e.target.value })}
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        );
      }
      return (
        <input
          type="date"
          value={rule.value}
          onChange={(e) => handleUpdateRule(index, { ...rule, value: e.target.value })}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      );
    }

    // Default text input (for tags)
    return (
      <input
        type="text"
        value={rule.value}
        onChange={(e) => handleUpdateRule(index, { ...rule, value: e.target.value })}
        placeholder="Enter value..."
        className="flex-1 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder-secondary/50"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-main flex items-center gap-2">
          <Icons.Wand className="w-4 h-4 text-purple-500" />
          Smart Rules
        </label>

        {rules.rules.length > 1 && (
          <div className="flex items-center gap-2 bg-surface-hover rounded-lg p-1">
            <button
              type="button"
              onClick={() => handleLogicChange('and')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rules.logic === 'and'
                  ? 'bg-purple-500 text-white'
                  : 'text-secondary hover:text-main'
              }`}
            >
              AND
            </button>
            <button
              type="button"
              onClick={() => handleLogicChange('or')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                rules.logic === 'or'
                  ? 'bg-purple-500 text-white'
                  : 'text-secondary hover:text-main'
              }`}
            >
              OR
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {rules.rules.map((rule, index) => (
          <div
            key={index}
            className="flex items-center gap-2 p-3 rounded-xl border border-border bg-surface-hover"
          >
            {/* Field selector */}
            <select
              value={rule.field}
              onChange={(e) => handleFieldChange(index, e.target.value as SmartRuleField)}
              className="w-32 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {FIELD_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Operator selector */}
            <select
              value={rule.operator}
              onChange={(e) =>
                handleUpdateRule(index, { ...rule, operator: e.target.value as SmartRuleOperator })
              }
              className="w-36 px-3 py-2 rounded-lg border border-border bg-surface text-main text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {OPERATOR_OPTIONS[rule.field].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Value input */}
            {renderValueInput(rule, index)}

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemoveRule(index)}
              className="p-2 text-secondary hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
            >
              <Icons.X className="w-4 h-4" />
            </button>

            {/* Logic indicator */}
            {index < rules.rules.length - 1 && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-purple-500 bg-surface px-2">
                {rules.logic.toUpperCase()}
              </div>
            )}
          </div>
        ))}

        {rules.rules.length === 0 && (
          <div className="text-center py-6 text-secondary text-sm">
            <Icons.Wand className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p>No rules defined yet</p>
            <p className="text-xs mt-1">Add rules to auto-populate this collection</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleAddRule}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border hover:border-purple-300 dark:hover:border-purple-700 text-secondary hover:text-purple-500 transition-all"
        >
          <Icons.Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {/* Preview hint */}
      {rules.rules.length > 0 && (
        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <p className="text-xs text-purple-600 dark:text-purple-400">
            <strong>Preview:</strong> Documents where{' '}
            {rules.rules.map((rule, i) => {
              const field = FIELD_OPTIONS.find((f) => f.value === rule.field)?.label || rule.field;
              const operator = OPERATOR_OPTIONS[rule.field].find((o) => o.value === rule.operator)?.label || rule.operator;
              return (
                <span key={i}>
                  {i > 0 && <span className="font-bold"> {rules.logic.toUpperCase()} </span>}
                  <span className="font-medium">{field}</span> {operator}{' '}
                  <span className="font-medium">&quot;{rule.value || '...'}&quot;</span>
                  {rule.secondValue && (
                    <span> and <span className="font-medium">&quot;{rule.secondValue}&quot;</span></span>
                  )}
                </span>
              );
            })}
          </p>
        </div>
      )}
    </div>
  );
};

export default SmartCollectionRules;
