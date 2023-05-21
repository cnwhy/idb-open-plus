import test, { ExecutionContext } from "ava";
import { idbOpen, idbDelete } from "../../src/index";
import puppeteer, { Page } from "puppeteer";

interface TestExecutionContext extends ExecutionContext {
    context: {
        page: Page;
    };
}

const url = "http://127.0.0.1:8081";

test.before(
    // async (t: TestExecutionContext, page: Page) => {},
    "初始化浏览器",
    async function withPage(t: any, run: any) {
        const browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        try {
            await run(t, page);
        } finally {
            // await page.close();
            // await browser.close();
        }
    },
    async (t: TestExecutionContext, page: Page) => {
        await page.goto(url, { waitUntil: "load" });
        // page.evaluate(() => {
        //     (window as any).idbOpen = idbOpen;
        // }, idbOpen);
        t.context.page = page;
    }
);

test("测试1", async (t: TestExecutionContext) => {
    let db = await t.context.page.evaluate((idbOpen) => {
        idbOpen('db1');
        return window.location.href;
    }, idbOpen);
    // t.notThrows(db);
    console.log(db);
    t.pass("过了");
});
