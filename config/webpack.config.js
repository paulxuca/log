const { join } = require('path')

module.exports = {
	entry: {
		dev: join(__dirname, '../dev/index.ts'),
		client: join(__dirname, '../src/index.ts')
	},
	output: {
		// The library will be accessible at window.Log
		library: 'Log',
		// Use exports.default.
		libraryExport: 'default'
	},
	resolve: {
		extensions: ['.ts', '.json', '.js']
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'awesome-typescript-loader'
					}
				]
			}
		]
	}
}
