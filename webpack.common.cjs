const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {

  entry: {
    index: './src/index.js',
    'ui/index': ['./src/ui/index.js'],
    // fingerprint inject — disabled, pending Gecko-layer integration
    // 'inject/index': './src/inject/index.js',
  },

  output: {
    filename: '[name].js',
    chunkFilename: '[name].js',
    path: path.resolve(process.cwd(), 'build'),
    publicPath: '/static/',
  },

  module: {
    rules: [
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        // package.json has "type": "module" → ESM strict mode requires extensions.
        // This tells webpack to still resolve extensionless imports like './RulesSection'.
        resolve: { fullySpecified: false },
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /manifest\.(json)$/,
        type: 'javascript/auto',
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
            },
          },
        ],
      },
      {
        test: /icons\/.*$/,
        type: 'javascript/auto',
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'icons/[name].[ext]',
            },
          },
        ],
      },
      {
        test: /\.(html)$/,
        type: 'javascript/auto',
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[folder]/[name].[ext]',
            },
          },
        ],
      },
      {
        test: /docs\/.+\.(md)$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[path]/[name].html',
            },
          }, {
            loader: 'markdown-it-vanilla-loader',
            options: {
              plugins: [
                'markdown-it-anchor',
                'markdown-it-table-of-contents',
              ],
            },
          },
        ],
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
          },
          {
            loader: 'sass-loader',
            options: { api: 'modern' },
          },
        ],
      },
    ],
  },

  optimization: {
    chunkIds: 'total-size',
    moduleIds: 'size',
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],

};
