import { create } from "./create";
export * from "./create";
const def = create(window);
export const { idbOpen, idbDelete } = def;
export default idbOpen;
