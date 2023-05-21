import create from "./create";
export { default as create, InitOptions } from "./create";
const def = create(window);
export const { idbOpen, idbDelete } = def;
// export const idbOpen = def.idbOpen;
// export const idbDelete = def.idbDelete;
