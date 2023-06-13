import typescript from '@rollup/plugin-typescript';
import nodeResolve from '@rollup/plugin-node-resolve';
import pkg from './package.json';

let banner = `/*!
 * ${pkg.name}  v${pkg.version}
 * Homepage ${pkg.homepage || ''}
 * License ${pkg.license}
 */
`;
let external = Object.keys(pkg.dependencies || {});
let plugins_typeES2015 = typescript({
    // target: 'ES2015',
    // module: 'ES2015',
    // removeComments: true
});

let out_index = [
    {
        input: './src/index.ts',
        plugins: [plugins_typeES2015],
        output: [
            // {
            //     file: pkg.module,
            //     format: 'es',
            //     banner: banner,
            // },
            {
                file: pkg.main,
                format: 'cjs',
                exports: 'named',
            },
        ],
        external,
    },
    {
        input: pkg.module,
        plugins: [nodeResolve()],
        output: [
            {
                file: pkg.browser,
                format: 'umd',
                name: 'index',
                exports: 'named',
            },
        ],
    },
];

export default [...out_index];
