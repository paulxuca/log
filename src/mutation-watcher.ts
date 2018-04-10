import { Mirror, NodeMirror } from './types'
import { createNodeMirror } from './lib/node-mirror'
import debug from './utils/debug'

const nodeMirror = createNodeMirror()

const parseNode = (node: Node) => {
	const tagName = node['tagName'] && node['tagName'].toLowerCase()

	switch (node.nodeType) {
		case node.DOCUMENT_TYPE_NODE:
			return {
				documentTypeInfo: {
					name: (node as DocumentType).name || '',
					publicId: (node as DocumentType).publicId || '',
					systemId: (node as DocumentType).systemId || ''
				}
			}

		case node.COMMENT_NODE:
			return {
				commentInfo: {
					textContent: node.textContent
				}
			}

		case node.TEXT_NODE:
			// A text node is the actual string inside the node. this might be for a style tag. We have to check here.
			const parentTagName =
				node.parentNode && (node.parentNode as HTMLElement).tagName
			// If it's a script tag, we dont want to record it. we don't need any javascript.
			const textContent = parentTagName === 'SCRIPT' ? '' : node.textContent

			return {
				textInfo: {
					textContent,
					// Record in order to use for reconstruction
					isStyleNode: parentTagName === 'STYLE'
				}
			}

		case node.DOCUMENT_NODE:
			return {
				documentInfo: {
					childNodes: []
				}
			}

		case node.ELEMENT_NODE:
			// First, we get a list of attributes.
			const attributes = {}

			for (const attribute of Array.from((node as HTMLElement).attributes)) {
				attributes[attribute.name] = attributes[attribute.value]
			}

			return {
				elementInfo: {
					tagName,
					attributes,
					childNodes: []
				}
			}

		default:
			throw Error()
	}
}

const addToTree = (node: Node = document) => {
	const mirror = nodeMirror.mirrorFor(node)

	// If we already have mirror, then we can immediately return that.
	if (mirror) {
		return {
			serializedNode: {
				id: mirror.id
			},
			mirrorNode: mirror
		}
	}

	// Parse the node into a modifyable object.
	const parsedNode = parseNode(node)

	// Create a new mirror for the node.
	const newMirror = nodeMirror.createMirror(node)

	// Add the id for the parsed version of the node.
	parsedNode['id'] = newMirror.id

	// If we have children
	if (node.childNodes && node.childNodes.length) {
		const childNodes = parsedNode.documentInfo
			? parsedNode.documentInfo.childNodes
			: parsedNode.elementInfo.childNodes

		let lastNode

		// Iterate through all children.
		for (let iter = node.firstChild; iter; iter = iter.nextSibling) {
			const added = addToTree(iter)

			if (added) {
				const { serializedNode, mirrorNode } = added

				nodeMirror.removeFromTree(mirrorNode)

				// Check we are on the last child.
				if (iter === node.lastChild) {
					newMirror['mChild'] = mirrorNode
				}

				// The parent is the new mirror created.
				mirrorNode.mParent = newMirror

				// If we have a previous node, link the two.
				if (lastNode) {
					// Last node's next is this node.
					lastNode.mNext = mirrorNode
					// This node's previous is the last node.
					mirrorNode.mPrev = lastNode
				}

				// Push the serialized node into the current node's children
				childNodes.push(serializedNode)

				// Create a reference to this node as the last node.
				lastNode = mirrorNode
			}
		}
	}

	return {
		serializedNode: parsedNode,
		mirrorNode: newMirror
	}
}

const createNodeInsertChanges = (
	node: NodeMirror,
	allChanges?: { [key: string]: any[] }
) => {
	const mParent = nodeMirror.mirrorFor(node.parentNode)
	const add = addToTree(node)

	if (add) {
		const { serializedNode, mirrorNode } = add

		mirrorNode.mParent = mParent

		// If the current node is the last child of the parent
		if (node.parentNode.lastChild === node) {
			// If it is the new lastChild, we need to update that.
			if (mParent.mChild) {
				mParent.mChild.mNext = mirrorNode
			}

			mParent.mChild = mirrorNode
		}

		// Used to figure out where to insert the new node.
		let nextSiblingId

		if (node.nextSibling) {
			const mSibling = nodeMirror.mirrorFor(node.nextSibling)

			nextSiblingId = mSibling.id

			// This inserts the new mirror node in between two nodes.
			if (mSibling.mPrev && mSibling.mPrev !== mirrorNode) {
				// Sibling => prev => next = current node
				mSibling.mPrev.mNext = mirrorNode
				mirrorNode.mPrev = mSibling.mPrev
			}

			mSibling.mPrev = mirrorNode
			mirrorNode.mNext = mSibling
		}

		const change = {
			nodeData: serializedNode,
			parentNodeId: mParent.id,
			nextSiblingId
		}

		if (allChanges && allChanges.added) {
			allChanges.added.push(change)
		}

		return change
	}
}

const createNodeRemoveChanges = (
	mirror: Mirror,
	allChanges?: { [key: string]: any[] }
) => {
	if (allChanges && allChanges.removed) {
		allChanges.removed.push({ nodeId: mirror.id })
	}

	return {
		nodeId: mirror.id
	}
}

// NOTE: mChild is the last mirrored child, so we compare each virtual child with the real child.
const createNodeChanges = (
	mChild: Mirror,
	lastChild: Node,
	allChanges?: { [key: string]: any[] }
) => {
	const intermediateChanges = []

	while (mChild && lastChild) {
		// Get the mirror for the last child (real node)
		const mirror = nodeMirror.mirrorFor(lastChild)

		// If we have an id for the last child
		if (mirror) {
			// If they are the same, then they have not changed.
			if (mChild.id === mirror.id) {
				lastChild = lastChild.previousSibling
				mChild = mChild.mPrev
			} else {
				intermediateChanges.push({
					remove: mChild
				})

				mChild = mChild.mPrev
			}
		} else {
			intermediateChanges.push({
				insert: lastChild
			})

			lastChild = lastChild.previousSibling
		}
	}

	while (mChild) {
		intermediateChanges.push({
			remove: mChild
		})

		mChild = mChild.mPrev
	}

	for (; lastChild; ) {
		intermediateChanges.push({
			insert: lastChild
		})

		lastChild = lastChild.previousSibling
	}

	return intermediateChanges.map(({ remove, insert }) => {
		if (insert) {
			return createNodeInsertChanges(insert, allChanges)
		}

		return createNodeRemoveChanges(remove, allChanges)
	})
}

const getChanges = mutationRecords => {
	const changes = {
		attributes: [],
		removed: [],
		added: [],
		text: []
	}

	// No mutations yet.
	if (mutationRecords.length === 0) {
		return changes
	}

	// for (; mutationRecords.length; ) {
	// 	const mutationRecord = mutationRecords.shift()
	// }
	const insertedNodes: { [key: number]: Node } = {}

	while (mutationRecords.length > 0) {
		const mutationRecord = mutationRecords.shift()

		const nodeTarget = mutationRecord.target
		const id = nodeMirror.id(nodeTarget)

		if (id) {
			if (mutationRecord.type === 'attributes') {
				// return
			}

			if (mutationRecord.type === 'childList') {
				insertedNodes[id] = nodeTarget
				// changedNodes[id] = nodeTarget
			}

			if (mutationRecord.type === 'characterData') {
				//
			}
			// if (mutationRecord.type === 'characterData') {
			// 	const { textContent } = nodeTarget
			// 	if (textContent !== mutationRecord.oldValue) {
			// 		changes.text.push({
			// 			nodeId: id,
			// 			textContent
			// 		})
			// 	}
			// }
			// if (mutationRecord.type === 'childList') {
			// 	// const
			// 	console.log(mutationRecord.removedNodes, mutationRecord.addedNodes)
			// }
		}

		// Find last target of changed
	}

	// console.

	// for (const changedNode)
	// Object.keys(c)
	for (const insertedNode of Object.values(insertedNodes)) {
		const mNode = nodeMirror.mirrorFor(insertedNode)

		if (mNode && mNode.id) {
			createNodeChanges(mNode.mChild, insertedNode.lastChild, changes)
		}
	}

	// for (const changedNode of Object.values(changedNodes)) {
	// 	const mirror = nodeMirror.mirrorFor(changedNode)

	// 	if (mirror && mirror.id) {
	// 		// This will also push all changes into the object above.
	// 		createNodeChanges(mirror.mChild, changedNode.lastChild, changes)
	// 	}
	// }

	return changes
}

const createMutationWatcher = ({ root = document } = {}) => {
	const mutationRecords: MutationRecord[] = []

	const mutationObserver = new MutationObserver(events => {
		mutationRecords.push(...events)
	})

	return {
		// Takes a full snapshot of the document. Used initially (?)
		snapshot() {
			const initialTree = addToTree(document)

			// We must start observing after the initial snapshot is taken.
			mutationObserver.observe(root, {
				characterData: true,
				characterDataOldValue: true,
				attributes: true,
				attributeOldValue: true,
				childList: true,
				subtree: true
			})

			return initialTree
		},

		getChanges() {
			const changes = getChanges(mutationRecords)

			return changes
		},

		disconnect() {
			mutationObserver.disconnect()
		}
	}
}

export { createMutationWatcher }
