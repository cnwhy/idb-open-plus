import puppeteer, { Page } from "puppeteer";
import create from "../src/create";
async function main() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    try {
        // await run(t, page);
        await page.goto("http://127.0.0.1:3300", { waitUntil: "load" });
        const h = await page.evaluate((a) => {
            return window.location.href + a;
        }, "");
        console.log(h);
        await page.exposeFunction("idbLibCreate", create);
        await page.evaluate(async () => {
            Object.assign(window, (window as any).idbLibCreate(window));
        });

        const dbs = await page.evaluate(async () => {
            const { idbOpen } = (window as any);
            class OsCmd1 {
                options = null;
                open = null;
                constructor(dbName, store) {
                    this.options = {
                        dbName,
                        store,
                    };
                    this.open = () => idbOpen(dbName, { store });
                }
                getos = async (module = "readwrite") => {
                    let { store } = this.options;
                    const db = await this.open();
                    return db.transaction(store, module).objectStore(store);
                };
                get = (id) => {
                    return this.getos("readonly").then((os) => {
                        return new Promise((resolve, reject) => {
                            let request = os.get(id);
                            request.onerror = reject;
                            request.onsuccess = () => resolve(request.result);
                        });
                    });
                };
                set = (data, id) => {
                    return this.getos("readwrite").then((os) => {
                        return new Promise((resolve, reject) => {
                            let request = os.put(data, id);
                            request.onerror = reject;
                            request.onsuccess = () => resolve(null);
                        });
                    });
                };
            }
            await idbOpen("db1", { store: "os1" });
            await idbOpen("db2", { store: "os1" });
            await idbOpen("db2", { store: "os1" });
            // return window.indexedDB?.databases();
            return "";
        });
        console.log(dbs);
    } finally {
        await page.close();
        await browser.close();
    }
}

main();
