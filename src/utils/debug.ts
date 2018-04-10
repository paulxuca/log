const createDebugger = ({ debug } = { debug: true }) => {
	return (...args) => {
		if (!debug) {
			return
		}

		console.log(
			`[debug]`,
			args.map(
				arg => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg)
			)
		)
	}
}

export default createDebugger()
