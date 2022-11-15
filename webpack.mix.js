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

mix_.js('src/resources/app.js', 'dist/assets/js')
    .js('src/resources/base', 'dist/assets/js')
    .sass('src/resources/app.scss', 'dist/assets/css')
    .copy('src/*.html', 'dist')
    .copy('src/resources/judiciary-icon.png', 'dist/judiciary-icon.png')
    .copy('node_modules/govuk-frontend/govuk/assets/images', 'dist/assets/images')
    .copy('node_modules/govuk-frontend/govuk/assets/fonts', 'dist/assets/fonts');
