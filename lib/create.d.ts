export type InitOptions = {
    /** 存储库名称 或者用于检测是否需要更新数据数的函数,返回 true 则不新, 否则执行 upgradeneeded */
    store?: string | ((db: IDBDatabase, ts?: IDBTransaction) => boolean);
    /**
     * 更新数据库
     * @param db IDBDatabase
     * @param event onupgradeneeded的事件对像
     */
    upgradeneeded?: (this: IDBOpenDBRequest, db: IDBDatabase, tc: IDBTransaction, event: IDBVersionChangeEvent) => void;
};
export default function create(global: Window): {
    idbOpen: (dbName: string, options?: InitOptions) => Promise<IDBDatabase>;
    idbDelete: (dbName: string) => Promise<unknown>;
};
