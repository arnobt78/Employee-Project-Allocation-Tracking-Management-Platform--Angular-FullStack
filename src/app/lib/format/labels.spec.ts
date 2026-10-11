import { titleCaseLabel } from './labels';

describe('titleCaseLabel', () => {
  it('title-cases snake, kebab, spaced and upper-case values', () => {
    expect(titleCaseLabel('in_review')).toBe('In Review');
    expect(titleCaseLabel('in review')).toBe('In Review');
    expect(titleCaseLabel('IN-REVIEW')).toBe('In Review');
    expect(titleCaseLabel('assignment_created')).toBe('Assignment Created');
  });

  it('keeps inner capitals of mixed-case words', () => {
    expect(titleCaseLabel('AI drafting')).toBe('AI Drafting');
  });

  it('collapses whitespace and returns empty for blank input', () => {
    expect(titleCaseLabel('  on   hold ')).toBe('On Hold');
    expect(titleCaseLabel('')).toBe('');
    expect(titleCaseLabel(null)).toBe('');
    expect(titleCaseLabel(undefined)).toBe('');
  });
});
