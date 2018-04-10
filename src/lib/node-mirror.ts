import { Mirror, NodeMirror } from '../types'

const ID_PROP = '_id'

const reset = (node: NodeMirror) => {
	if (node[ID_PROP]) {
		delete node[ID_PROP]
	}

	let child = node.firstChild

	if (child) {
		reset(child as NodeMirror)

		child = child.nextSibling
	}
}

const removeFromTree = (node: Mirror) => {
	// Check that we are the only node in the parent mirror.
	if (node.mParent && node.mParent.mChild === node) {
		// Make parent's child = previous node
		node.mParent.mChild = node.mPrev

		if (node.mPrev) {
			node.mPrev = node.mNext
		}

		if (node.mNext) {
			node.mNext = node.mNext.mPrev = node.mPrev
		}
	}
}

const createNodeMirror = () => {
	let nextId = 1

	return {
		id(node) {
			return node && node[ID_PROP] && node[ID_PROP].id
		},

		createMirror(node) {
			const id = nextId++
			const mirror = { id }

			node[ID_PROP] = mirror

			return mirror
		},

		mirrorFor(node) {
			return node && node[ID_PROP] ? node[ID_PROP] : null
		},

		reset(node = document) {
			nextId = 1

			reset((node as any) as NodeMirror)
		},

		removeFromTree
	}
}

export { createNodeMirror }
