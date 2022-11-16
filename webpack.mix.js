const mix_ = require('laravel-mix');

/*
 |--------------------------------------------------------------------------
 | Mix Asset Management
 |--------------------------------------------------------------------------
 |
 | Mix provides a clean, fluent API for defining some Webpack build steps
 | for your Laravel applications. By default, we are compiling the CSS
 | file for the application as well as bundling up all the JS files.
 |
 */

mix_.webpackConfig({
    resolve: {
        fallback: {
            "zlib": require.resolve("browserify-zlib"),
            "path": require.resolve("path"),
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "http": require.resolve("stream-http"),
            "fs": false,
            "net": false,
            "async_hooks": false
        }
    },
    externals: {
        "express": "require('express')"
    }
})
    .js('src/resources/app.js', 'dist/assets/js')
    .js('src/resources/base', 'dist/assets/js')
    .copy('src/*.html', 'dist')
    .copy('src/resources/working.png', 'dist/working.png')
    .copy('src/resources/judiciary-icon.png', 'dist/judiciary-icon.png');
