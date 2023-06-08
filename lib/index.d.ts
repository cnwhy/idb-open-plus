export { default as create, type InitOptions } from './create';
export declare const idbOpen: (dbName: string, options?: import("./create").InitOptions) => Promise<IDBDatabase>, idbDelete: (dbName: string) => Promise<unknown>;
