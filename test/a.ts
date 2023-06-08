import puppeteer, { type ConsoleMessage } from 'puppeteer';
import pti from 'puppeteer-to-istanbul';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const startServer = async () => {
    const server = await createServer({
        // 任何合法的用户配置选项，加上 `mode` 和 `configFile`
        configFile: false,
        root: __dirname,
        server: {
            port: 3300,
        },
    });
    await server.listen();

    server.printUrls();
}

async function main() {
    await startServer();
    // let executionQueue = Promise.resolve();
    const browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        headless: 'new',
    });
    const page = await browser.newPage();
    async function end(errors) {
        console.log('end', errors);
        // await page.close();
        const jsCoverage = await page.coverage.stopJSCoverage();
        jsCoverage.forEach((item) => {
            const { url } = item;
            console.log(url);
        });
        const out = jsCoverage.filter((item) => {
            const isLib = item.url.indexOf('/idbConnection/(lib|src)/') !== -1;
            if (isLib) {
                let url = new URL(item.url);
                url.pathname = url.pathname.replace(/\:/g, '_');
                item.url = url.toString();
                return true;
            }
            return false;
        });
        pti.write([...out], { storagePath: './.nyc_output' });

        await browser.close();
    }
    page.on('error', (error) => console.error(error));
    page.on('pageerror', (error) => console.error(error));
    page.on('console', async (e) => {
        const args = await Promise.all(e.args().map((a) => a.jsonValue()));
        console.log(...args);
    });
    await page.exposeFunction('polendinaEnd', (errors) => {
        end(errors);
    });

    // await run(t, page);
    await page.coverage.startJSCoverage({ includeRawScriptCoverage: true });
    await page.goto('http://127.0.0.1:3300', { waitUntil: 'load' });
}

main();
