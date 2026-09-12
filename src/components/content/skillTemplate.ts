/**
 * Starting point shown in the Skill editor for a new skill. Every section is
 * a suggestion: creators edit, reorder or delete freely. Kept in plain
 * Markdown because that is what the instructions are stored and sent as.
 */
export const SKILL_LIMITS = {
  name: 80,
  summary: 280,
  instructions: 20_000,
} as const;

export const SKILL_TEMPLATE = `# <Skill name>

## Purpose
What this Skill helps with, in one or two sentences.

## When to use
Describe the situations or questions this Skill is for.

## Steps
1. First thing the AI should do.
2. Next step.
3. Final step before answering.

## Rules
- Things the AI must always do.
- Things it must never do.

## How to use the memory
What is in this bucket's memory (kinds of files, notes, cases), when to search it, and how to cite it.
If the memory does not cover something, say so instead of guessing.

## Output format
How answers should look (for example: a short verdict first, then the key reasons in plain sentences, then next steps).
`;
