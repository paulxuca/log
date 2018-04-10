export type Mirror = {
	id: number
	mChild: Mirror
	mParent: Mirror
	mPrev: Mirror
	mNext: Mirror
}

export interface NodeMirror extends Node {
	_id: Mirror
	firstChild: NodeMirror | Node
}
