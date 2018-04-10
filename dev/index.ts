import { createMutationWatcher } from '../src/mutation-watcher'

// This module should load the example TODO MVC/ other interactive JS app.
const mutationWatcher = createMutationWatcher()

function ready(fn) {
	if (
		document['attachEvent']
			? document.readyState === 'complete'
			: document.readyState !== 'loading'
	) {
		fn()
	} else {
		document.addEventListener('DOMContentLoaded', fn)
	}
}

ready(() => {
	let iter = 0
	let lastNode = document.body

	const id = setInterval(() => {
		if (iter > 4) {
			clearInterval(id)
		}

		const element = document.createElement('div')

		element.textContent = 'Hello World'

		lastNode.appendChild(element)

		lastNode = element
		iter++
	}, 200)

	mutationWatcher.snapshot()

	// setTimeout(() => {
	// 	console.log(mutationWatcher.getChanges())

	// 	setTimeout(() => {
	// 		console.log(mutationWatcher.getChanges())
	// 	}, 250)
	// }, 250)
	// setInterval(() => {
	// 	console.log(mutationWatcher.getChanges())
	// }, 250)
})
