const { join } = require('path')
const merge = require('webpack-merge')
const baseConfig = require('./webpack.config')

module.exports = merge(baseConfig, {
	mode: 'production',
	devServer: {
		port: 1234,
		contentBase: join(__dirname, '../dev')
	}
})
