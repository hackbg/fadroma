import { Name } from '../../lib/index.ts';
import { Icon } from '../lib.ts';
export const Command = Name('Command', (icon: string|null, ...content: unknown[]) => [
  'div.command', icon && Icon(icon), ...content
]);
