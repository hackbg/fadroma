import { reflect } from '../call.ts';
export const flag = (name: string, bit: number) =>
  reflect(name, function testFlag (value: number|number[]) {
    value = (value[0] || value) as number;
    return (value & (1 << bit)) !== 0;
  }, {
    bit,
    value: 1 << bit
  });
