import type { ReactNode } from 'react';

export type TagKind = 'actual' | 'model' | 'hypothetical' | 'evidence' | 'speculative';

const TEXT: Record<TagKind, string> = {
  actual: 'Actual choices',
  model: 'Model assumption',
  hypothetical: 'Hypothetical projection',
  evidence: 'Scientific evidence',
  speculative: 'Open question',
};

export default function Tag({ kind, children }: { kind: TagKind; children?: ReactNode }) {
  return <span className={`tag tag-${kind}`}>{children ?? TEXT[kind]}</span>;
}
