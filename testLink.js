var prefix = 'https://www.homeads.ca/bradford-west-gwillimbury-real-estate',
	prefix1 = 'https://www.listlux.com/yotarejaxate-';

function setEvent(node, st) {
	node.addEventListener('click', function() {
		location.href = st;
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
			setEvent(nodes[i], prefix + '?' + arr.join('&'));
		}
	}
}

function hideLinks1(par) {
	par = par || {};
	for (var key in par) {
		var st = par[key],
			nodes = document.getElementsByClassName(key);
		for (var i = 0, len = nodes.length; i < len; i++) {
			setEvent(nodes[i], prefix1 + st);
		}
	}
}
