(function ($) {
// return;
	function setEvent(node, st) {
		node.addEventListener('click', function() {
			location.href = st;
		}.bind(this));
	}
	
	function hideLinks(par, pref) {
		par = par || {};
		pref = pref || '';
		for (var key in par) {
			var st = par[key],
				nodes = document.getElementsByClassName(key);
			for (var i = 0, len = nodes.length; i < len; i++) {
				setEvent(nodes[i], pref + st);
			}
		}
	}
	function getLink(node) {
		var par = node.attr('data-params'),
			ref = node.attr('href');
		if (par) {
			var arr = par.split(',');
			ref = arr.join('/');
			// ref = arr.shift() || 'https:';
			// if (arr.length) {
				// ref += '//' + (arr.shift() || 'www.listlux.com');
				// ref += '/' + arr.join('/');
			// }
		}
		return ref;
	}

    $(document).ready(function () {
		setTimeout(function() {
			hideLinks(window.hdrLinks, 'https://www.listlux.com/listings.php?');
			hideLinks(window.hdrlLinks);
			
			var listNode = document.getElementById('locations-list'),
				len = listNode.children.length,
				state = '',
				statesHash = {};
			for(var i = 0; i < len; i++) {
				var li = listNode.children[i],
					span = li.children[0],
					state = span.getAttribute('data-location-state');
					
                                var attr = {};
				for (var i1 = 0, len1 = span.attributes.length; i1 < len1; i1++) {
				var it = span.attributes[i1];
				if (it) { attr[it.name] = it.value; }
				}
				//var attr = span.getAttributeNames().reduce(function(p, n) {
				//	p[n] = span.getAttribute(n);
				//	return p;
				//}, {});
				attr.nm = i;
				attr.text = span.text || span.innerText;
				attr.outerHTML = li.outerHTML;
				var city = attr['data-location-v'];
				if (city) {
					statesHash[state].cities.push(attr);
				} else {
					attr.cities = [];
					statesHash[state] = attr;
				}
				if (len <= 40) {
					$(li).removeClass('hidden');
				}
			}
			if (len > 40) {
				$('#location_search-input').removeClass('hidden');
			}
			listNode.addEventListener('click', function(ev) {
				var target = ev.target;
				if (target.tagName.toLowerCase() === 'span') {
					var ref = target.getAttribute('data-params').split(',').join('/');
					location.href = ref;
				}
			}.bind(this));

			$("#location_search-input").on('keyup', function () {
				$(".location_search-wrap").addClass("loading");
				debounce((function () {
					var search = $("#location_search-input").val().toLowerCase(),
						statesCnt = Object.keys(statesHash).length,
						str = '';

					for (var state in statesHash) {
						var stateData = statesHash[state];

						if (!search || statesCnt < 2) {
							str += stateData.outerHTML;
						} else {
							var сstr = '';
							for (var i = 0; i < stateData.cities.length; i++) {
								var city = stateData.cities[i];
								if (city['data-location-v'].toLowerCase().indexOf(search) >= 0) {
									сstr += city.outerHTML.replace('<li class="hidden"', '<li');
								}
							}
							if (сstr) {
								str += stateData.outerHTML + сstr;
							}
						}
					}
					listNode.innerHTML = str;
					$(".location_search-wrap").removeClass("loading");
				}).bind(this), 300);
			});               
		}, 10);
    });
})(jQuery);
