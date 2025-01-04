const path = require('path');

module.exports = {
    mode: 'production', // Use 'development' for easier debugging
    entry: './utils/api.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'api.bundle.js',
        library: {
            type: 'module',
        },
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
        ],
    },
    experiments: {
        outputModule: true,
    },
};
