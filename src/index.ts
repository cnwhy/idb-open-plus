import create from './create';
export { default as create, type InitOptions } from './create';
const def = create(window);
export const { idbOpen, idbDelete } = def;
