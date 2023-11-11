const path = require('path');

module.exports = {
    entry: './receiver.js', // Your main JavaScript file
    output: {
        path: path.resolve(__dirname, 'dist'), // Output directory
        filename: 'bundle.js' // Output bundled file
    },
    module: {
        rules: [
            {
                test: /\.js$/, // Transpile all .js files
                exclude: /node_modules/, // Except for node_modules
                use: {
                    loader: 'babel-loader', // Use babel-loader
                    options: {
                        presets: ['@babel/preset-env'] // Preset for compiling ES6
                    }
                }
            }
        ]
    }
};
