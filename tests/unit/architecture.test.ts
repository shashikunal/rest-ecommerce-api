import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

import { describe, it, expect } from 'vitest';

function collectTs(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'node_modules' || e === 'dist') continue;
    const st = statSync(p);
    if (st.isDirectory()) collectTs(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const FORBIDDEN: Array<{ scope: string; pattern: RegExp; forbid: RegExp[] }> = [
  {
    scope: 'domain must not depend on infrastructure frameworks',
    pattern: /src[/\\]modules[/\\].+[/\\]domain[/\\].*\.ts$/,
    forbid: [
      /from ['"]express/,
      /mongoose/,
      /from ['"]redis/,
      /kafkajs/,
      /nodemailer/,
      /swagger-ui-express/,
    ],
  },
  {
    scope: 'controllers must not touch infrastructure directly',
    pattern: /src[/\\]modules[/\\].+[/\\]presentation[/\\]controllers[/\\].*\.ts$/,
    forbid: [/mongoose/, /from ['"]redis/, /kafkajs/, /nodemailer/],
  },
];

describe('Architecture boundaries', () => {
  it('forbids infrastructure leakage into domain/controllers', () => {
    const files = collectTs('src');
    const violations: string[] = [];
    for (const f of files) {
      const content = readFileSync(f, 'utf8');
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(f)) {
          for (const rx of rule.forbid) {
            if (rx.test(content)) violations.push(`${f}: violates "${rule.scope}" via ${rx}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('requires asyncHandler usage to avoid unhandled rejections in app layer', () => {
    const content = readFileSync('src/app/app.ts', 'utf8');
    expect(content).toContain('asyncHandler');
  });
});
