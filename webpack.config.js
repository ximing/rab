'use strict';
const { resolve } = require('path');
const webpack = require('webpack');
const path = require('path');
const c9 = !!process.env.PORT;
module.exports = {
    mode: 'production', // "production" | "development" | "none"
    entry: {
        demo: ['react-hot-loader/patch', './demo/index.js'],
        simple: ['react-hot-loader/patch', './demo/simple.js']
    },
    output: {
        filename: '[name].js',
        sourceMapFilename: '[file].map',
        path: resolve(__dirname, 'dist'),
        publicPath: '/dist'
    },
    devtool: 'cheap-eval-source-map',
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    devServer: {
        contentBase: [path.join(__dirname, 'html'), path.join(__dirname, 'dist')],
        compress: true,
        port: parseInt(process.env.PORT) || 8765,
        host: '0.0.0.0',
        hot: true,
        inline: true,
        publicPath: '/dist/',
        disableHostCheck: true,
        headers: {
            'XM-Component-Server': 'webpack-dev-server@2.0.0'
        },
        historyApiFallback: {
            rewrites: [
                {
                    from: /^\/simple.*$/,
                    to: '/simple.html'
                },
                {
                    from: /^\/.*$/,
                    to: '/index.html'
                }
            ],
            verbose: true
        },
        watchContentBase: true
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            plugins: ['react-hot-loader/babel']
                        }
                    }
                ],
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader', 'postcss-loader']
            },
            {
                test: /\.(png|jpg|jpeg|gif|woff|svg|eot|ttf|woff2)$/i,
                use: ['url-loader']
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    externals: {
        jquery: 'jQuery'
    },
    plugins: [new webpack.NamedModulesPlugin()]
};
