# Some notes

* Easily iterate through all of nodes immediate children:

```javascript
for (let child = node.firstChild; child; child = iter.nextSibling) {
	// child = firstChild
	// child = firstChild.nextSibling
	// child = firstChild.nextSibling.nextSibling...
}
```
