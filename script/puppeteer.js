const path = require("path");
const puppeteer = require("puppeteer");
const { createServer } = require("vite");
let args = process.argv.slice(2) || [];
let root = process.cwd();
let argPath = args.find(str=>{
    return !/^\-\-/.test(str);
})
if(argPath){
    root = path.join(process.cwd(),argPath)
}
console.log(root);

const startServer = async () => {
    const server = await createServer({
        configFile: false,
        root: root,
        // server: {
        //     port: port,
        // },
    });
    await server.listen();
    server.printUrls();
    return server;
};

let outLog = Promise.resolve();
const onConsole = async (e) => {
    const args = Promise.all(e.args().map((a) => a.jsonValue()));
    outLog = outLog.then(() => args);
    runConsole(args);
};
const runConsole = async (args) => {
    await outLog;
    console.log(...(await args));
};

async function main() {
    const server = await startServer();
    const serverPort = server.config.server.port || port;
    const browser = await puppeteer.launch({
        args: ["--no-sandbox"],
        headless: "new",
    });
    const page = await browser.newPage();
    page.on("error", (error) => console.error(error));
    page.on("pageerror", (error) => console.error(error));
    page.on("console", onConsole);
    await page.exposeFunction("__testEnd__", async (errors) => {
        browser.close();
        server.close();
    });
    await page.goto(`http://localhost:${serverPort}`, { waitUntil: "load" });
}

main();
