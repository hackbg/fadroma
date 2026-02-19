import Icon from './Icon.ts';
export default function Command (icon: string|null, ...content: unknown[]) {
  return [ 'div.command', icon && Icon(icon), ...content ]
}
