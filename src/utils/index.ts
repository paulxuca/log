export function toIterator<T1>(iterable: T1[]): IterableIterator<T1> {
	return iterable[Symbol.iterator]()
}
