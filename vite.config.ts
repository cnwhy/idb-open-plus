import { defineConfig, LibraryOptions } from "vite";
import pkg from "./package.json";

const name = pkg.name.replace(/\-(.)/g, (s, s1) => s1.toUpperCase());
console.log(name);
export default defineConfig({
    build: {
        lib: {
            entry: "./src/index.ts",
            name: name,
            // fileName: 'index',
            formats: ["umd", "cjs"],
            fileName: (format, entryName) => `${pkg.name}.${format}.js`,
        },
        sourcemap: true,
        target: "es2015",
        // minify: false,
        rollupOptions: {
            output: {
                exports: "named",
            },
        }
    },
});
