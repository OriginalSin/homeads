var prefix = 'https://www.homeads.ca/bradford-west-gwillimbury-real-estate';

function setEvent(node, arr) {
	node.addEventListener('click', function() {
		location.href = prefix + '?' + arr.join('&');
	}.bind(this));
}

function hideLinks(par) {
	par = par || {};
	for (var key in par) {
		var h = par[key],
			nodes = document.getElementsByClassName(key),
			arr = [];
		for (var key1 in h) { arr.push(key1 + '=' +  h[key1]); }
		for (var i = 0, len = nodes.length; i < len; i++) {
			setEvent(nodes[i], arr);
		}
	}
}