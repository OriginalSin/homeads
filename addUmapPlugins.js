var plugins = "test";
//console.log('testme');

L.Control.GmxIcon = L.Control.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
    options: {
        position: 'topleft',
        id: 'defaultIcon',
        isActive: false
    },

    setActive: function (active, skipEvent) {
        var options = this.options,
			container = this._container,
            togglable = options.togglable || options.toggle;
        if (togglable) {
            var prev = options.isActive,
                prefix = this._prefix,
                className = prefix + '-' + options.id;

            options.isActive = active;

            if (this._img) {
                if (active && options.activeImageUrl) { this._img.src = options.activeImageUrl; }
                else if (!active && options.regularImageUrl) { this._img.src = options.regularImageUrl; }
            }
            if (active) {
                L.DomUtil.addClass(container, prefix + '-active');
                L.DomUtil.addClass(container, className + '-active');
                if (container.children.length) {
                    L.DomUtil.addClass(container, prefix + '-externalImage-active');
                }
                if (options.styleActive) { this.setStyle(options.styleActive); }
            } else {
                L.DomUtil.removeClass(container, prefix + '-active');
                L.DomUtil.removeClass(container, className + '-active');
                if (container.children.length) {
                    L.DomUtil.removeClass(container, prefix + '-externalImage-active');
                }
                if (options.style) { this.setStyle(options.style); }
            }
            if (!skipEvent && prev !== active) { this.fire('statechange'); }
        }
		if (L.gmxUtil && L.gmxUtil.isIEOrEdge) {
			var uses = container.getElementsByTagName('use');
			if (uses.length) {
				var use = uses[0],
					href = use.getAttribute('href') || use.getAttribute('xlink:href');
				use.setAttribute('href', href);
				//use.setAttribute('xlink:href', href);
			}
		}
    },

    onAdd: function (map) {
        var img = null,
            span = null,
            options = this.options,
			svgSprite = options.svgSprite || map.options.svgSprite,
			prefix = 'leaflet-gmx-icon' + (svgSprite && !options.regularImageUrl && !options.text ? 'Svg' : ''),
            className = prefix + '-' + options.id;

		this._prefix = prefix;
        var container = L.DomUtil.create('div', prefix + ' ' + className);
        container._id = options.id;

        this._container = container;
        if (options.title) { container.title = options.title; }
        this.setStyle = function (style) {
            for (var key in style) {
                container.style[key] = style[key];
            }
        };
        if (options.className) {
            L.DomUtil.addClass(container, options.className);
        }
        if (options.regularImageUrl) {
            img = L.DomUtil.create('img', '', container);
            img.src = options.regularImageUrl;
            this._img = img;
            L.DomUtil.addClass(container, prefix + '-img');
            L.DomUtil.addClass(container, prefix + '-externalImage');
        } else if (options.text) {
            L.DomUtil.addClass(container, prefix + '-text');
            span = L.DomUtil.create('span', '', container);
            span.innerHTML = options.text;
        } else if (svgSprite) {
          L.DomUtil.addClass(container, 'svgIcon');
          var useHref = '#' + options.id.toLowerCase();
          container.innerHTML = '<svg role="img" class="svgIcon">\
              <use xlink:href="' + useHref + '" href="' + useHref + '"></use>\
            </svg>';
        } else {
            L.DomUtil.addClass(container, prefix + '-img ' +  prefix + '-sprite');
        }
        // if (container.children.length) {
            // L.DomUtil.addClass(container, prefix + '-externalImage');
        // }
        if (options.style) {
            this.setStyle(options.style);
        }

        this._iconClick = function () {
            if (container.parentNode) {
                this.setActive(!this.options.isActive);
                this.fire('click');
                if (this.options.stateChange) { this.options.stateChange(this); }
            }
        };
        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(container, 'mousemove', stop)
            .on(container, 'touchstart', stop)
            .on(container, 'mousedown', stop)
            .on(container, 'dblclick', stop)
            .on(container, 'click', stop)
            .on(container, 'click', this._iconClick, this);
        if (options.onAdd) {
            options.onAdd(this);
        }
        this.fire('controladd');
        map.fire('controladd', this);

        if (options.notHide) {
            container._notHide = true;
        }
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        this.fire('controlremove');
        map.fire('controlremove', this);

        var container = this._container,
            stop = L.DomEvent.stopPropagation;

        L.DomEvent
            .off(container, 'mousemove', stop)
            .off(container, 'touchstart', stop)
            .off(container, 'mousedown', stop)
            .off(container, 'dblclick', stop)
            .off(container, 'click', stop)
            .off(container, 'click', this._iconClick, this);
    },

    addTo: function (map) {
        L.Control.prototype.addTo.call(this, map);
        if (this.options.addBefore) {
            this.addBefore(this.options.addBefore);
        }
        return this;
    },

    addBefore: function (id) {
        var parentNode = this._parent && this._parent._container;
        if (!parentNode) {
            parentNode = this._map && this._map._controlCorners[this.getPosition()];
        }
        if (!parentNode) {
            this.options.addBefore = id;
        } else {
            for (var i = 0, len = parentNode.childNodes.length; i < len; i++) {
                var it = parentNode.childNodes[i];
                if (id === it._id) {
                    parentNode.insertBefore(this._container, it);
                    break;
                }
            }
        }

        return this;
    }
});

L.Control.gmxIcon = L.Control.GmxIcon;
L.control.gmxIcon = function (options) {
  return new L.Control.GmxIcon(options);
};
(function() {
function isIE(v) {
  return RegExp('msie' + (!isNaN(v) ? ('\\s' + v) : ''), 'i').test(navigator.userAgent);
}
var ICONSIZE = 32;
L.Control.GmxIconGroup = L.Control.GmxIcon.extend({
    options: {
        position: 'topleft',
        id: 'defaultIconGroup',
        isVertical: true,
        isCollapsible: true,
        isSortable: false,
        singleSelection: false
    },
    addIcon: function (gmxIcon) {
        this.items.push(gmxIcon);
        gmxIcon._parent = this;
        if (this._map) {
            this._container.appendChild(gmxIcon.onAdd(this._map));
            if (gmxIcon.options.addBefore) {
                gmxIcon.addBefore(gmxIcon.options.addBefore);
            }
        }

        gmxIcon.on('click', function () {
            this.setActiveIcon(gmxIcon);
        }, this);

        if (this.options.isCollapsible && !gmxIcon.options.skipCollapse) {
            gmxIcon.on('click', this._minimize, this);
        }
        return this;
    },
    removeIcon: function (gmxIcon) {
        for (var i = 0, len = this.items.length; i < len; i++) {
            if (gmxIcon === this.items[i]) {
                var cont = gmxIcon._container;
                if (cont.parentNode) {
                    cont.parentNode.removeChild(cont);
                }
                this.items.splice(i, 1);
                break;
            }
        }
        return this;
    },
    getIconById: function (id) {
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it.options.id === id) { return it; }
        }
        return null;
    },
    setActiveIcon: function (gmxIcon, isActive) {
        this.activeIcon = '';
        var len = this.items.length;
        if (len) {
            if (this.options.singleSelection) {
                for (var i = 0; i < len; i++) {
                    var it = this.items[i],
                        flag = gmxIcon === it && (isActive || it.options.isActive);
                    it.setActive(flag);
                    if (flag) { this.activeIcon = it.options.id; }
                }
            }
            var cont = this._container;
            if (this.options.isSortable && gmxIcon && cont.firstChild) {
                cont.insertBefore(gmxIcon._container, cont.firstChild);
                if (gmxIcon.options.text) {
                    this._chkTriangleStyle(gmxIcon._container);
                }
            }
            if (this.triangle) {
                var icon = this.options.isSortable ? gmxIcon : this.items[0];
                if (icon && icon.options.isActive) {
                    L.DomUtil.addClass(this.triangle, 'triangle-active');
                } else {
                    L.DomUtil.removeClass(this.triangle, 'triangle-active');
                }
            }
            this.fire('activechange', this);
        }
        return this;
    },

    _chkTriangleStyle: function (first) {
        var cont = this._container;
        for (var i = 0, len = this.items.length; i < len; i++) {
            var it = this.items[i];
            if (it._container === first) {
                if (it.options.text) {
                    this.triangle.style.right = (cont.clientWidth - first.clientWidth - 5) + 'px';
                    this.triangle.style.left = 'inherit';
                }
                break;
            }
        }
    },

    _minimize: function () {
        var style = this._container.style;

        style.height = ICONSIZE + 'px';
        if (this.options.width !== 'auto') { style.width = (ICONSIZE + 4) + 'px'; }
        style.overflow = 'hidden';
        if (this.bg) { this.bg.height = ICONSIZE + 2; }

		L.DomUtil.removeClass(this._container, 'leaflet-gmx-icon-group-maximum');
        this.fire('collapse', this);
    },

    _maximize: function () {
        var style = this._container.style,
            options = this.options;

        var size = this.items.length === 1 ? ICONSIZE : (ICONSIZE + 4) * this.items.length;
        if (options.isVertical) {
            if (this.bg) { this.bg.height = size; }
            style.height = size + 'px';
            if (options.width !== 'auto') { style.width = (ICONSIZE + 4) + 'px'; }
        } else {
            style.height = ICONSIZE + 'px';
            style.width = size + 'px';
        }
        style.overflow = 'unset';
		L.DomUtil.addClass(this._container, 'leaflet-gmx-icon-group-maximum');
        this.fire('expand', this);
    },

    onAdd: function (map) {
        var options = this.options,
			svgSprite = options.svgSprite || map.options.svgSprite,
			prefix = 'leaflet-gmx-icon-group',
            className = prefix + '-' + options.id + (svgSprite ? ' ' + prefix + 'Svg' : '') + ' ' + prefix + (options.isVertical ? '-vertical' : '-horizontal'),
            container = L.DomUtil.create('div', prefix + ' ' + className);

		if (options.isVertical) {
            if (isIE(10) || isIE(9)) {
                var vertical = L.DomUtil.create('span', 'icons-vertical',  container);
                var bg = L.DomUtil.create('img', '',  vertical);
                bg.width = bg.height = ICONSIZE;
                bg.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABBJREFUeNpi+P//PwNAgAEACPwC/tuiTRYAAAAASUVORK5CYII=';
                this.bg = bg;
                setTimeout(function() { bg.width = container.clientWidth; }, 0);
            }
            if (options.isCollapsible) {
				if (svgSprite) {
					this.triangle = L.DomUtil.create('div', 'triangleSvg',  container);
					this.triangle.innerHTML = '<svg role="img" class="svgIcon">\
						<use xlink:href="#arrow-down"></use>\
						</svg>';
				} else {
					this.triangle = L.DomUtil.create('div', 'triangle leaflet-gmx-icon-sprite',  container);
					this.triangle.width = this.triangle.height = ICONSIZE;
				}
            }
        }

        this._map = map;
        this._container = container;
        container._id = options.id;
        if (options.isCollapsible) {
            L.DomEvent
                .on(container, 'mousemove', L.DomEvent.stopPropagation)
                .on(container, 'mouseout', function(event) {
                    var parent = event.toElement;
                    while (parent) {
                        if (parent === container) { return; }
                        parent = parent.parentNode;
                    }
                    this._minimize();
                }, this)
                .on(container, 'mouseover', function(event) {
                    var parent = event.fromElement;
                    while (parent) {
                        if (parent === container) { return; }
                        parent = parent.parentNode;
                    }
                    this._maximize();
                }, this);

            this._minimize();
        }

        this.items = [];
        options.items.map(this.addIcon, this);
        if (options.onAdd) { options.onAdd(this); }
        this.fire('controladd');
        map.fire('controladd', this);

        if (options.isVertical) { container.style.marginLeft = 0; }
        if (options.notHide) {
            container._notHide = true;
        }
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        if (this.items.length) {
            var first = this.items[0],
                _this = this;
            if (first.options.text) {
                setTimeout(function() { _this._chkTriangleStyle(first._container); }, 0);
            }
        }
        return container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        this.fire('controlremove');
        map.fire('controlremove', this);
    }
});
L.Control.gmxIconGroup = L.Control.GmxIconGroup;
L.control.gmxIconGroup = function (options) {
  return new L.Control.GmxIconGroup(options);
};

})();
(function () {
var drawingIcons = ['Point', 'Polygon', 'Polyline', 'Rectangle'];
L.Control.GmxDrawing = L.Control.GmxIconGroup.extend({
    options: {
        position: 'topleft',
        singleSelection: true,
        isSortable: true,
        id: 'drawing',
        items: null
    },

    onAdd: function (map) {
        var _this = this;
        this.setActive = function (key) {
            if (map.gmxDrawing) {
                map.gmxDrawing.bringToFront();
                map.gmxDrawing.create(key, _this.options.drawOptions);
            }
        };
        this.on('activechange', function (ev) {
            var activeIcon = ev.activeIcon;
            for (var i = 0, len = drawingIcons.length; i < len; i++) {
                if (activeIcon === drawingIcons[i]) {
                    return;
                }
            }
            _this.setActive();
        });

        if (map.gmxDrawing) {
            map.gmxDrawing.on('drawstop', function (ev) {
                var opt = ev.object._obj.options || {};
                if (!opt.ctrlKey && !opt.shiftKey) {
                    _this.setActiveIcon();
                } else {
                    _this.setActive(ev.object.options.type);
                }
            }, this);
        }
        var addIcon = function (key) {
            return L.control.gmxIcon({
                id: key,
                //className: 'leaflet-gmx-icon-sprite',
                title: _this._locale && 'getText' in _this._locale ? _this._locale.getText(key) : key,
                togglable: true
              })
              .on('statechange', function (ev) {
                var opt = ev.target.options,
                    id = opt.id;

                if (id === _this.activeIcon) {
                    _this.setActive();
                } else if (opt.isActive) {
                    _this.setActive(id);
                }
            });
        };
        var defaultIcons = this.options.items || drawingIcons;
        this.options.items = [];
        defaultIcons.forEach(function (it) {
            _this.options.items.push(it instanceof L.Control.GmxIcon ? it : addIcon(it));
        });
        return L.Control.GmxIconGroup.prototype.onAdd.call(this, map);
    }
});

L.Control.gmxDrawing = L.Control.GmxDrawing;
L.control.gmxDrawing = function (options) {
  return new L.Control.GmxDrawing(options);
};

L.Control.GmxDrawing.locale = {};
L.Control.GmxDrawing.addInitHook(function () {
    this._locale = L.Control.GmxDrawing.locale;
    L.extend(this._locale, L.gmxLocaleMixin);
});
})();

L.Map.addInitHook(function () {
    var corners = this._controlCorners,
        parent = this._controlContainer,
        tb = 'leaflet-top leaflet-bottom',
        lr = 'leaflet-left leaflet-right',
        classNames = {
            bottom: 'leaflet-bottom ' + lr,
            gmxbottomleft: 'leaflet-bottom leaflet-left',
            gmxbottomcenter: 'leaflet-bottom ' + lr,
            gmxbottomright: 'leaflet-bottom leaflet-right',
            center: tb + ' ' + lr,
            right:  'leaflet-right ' + tb,
            left:   'leaflet-left ' + tb,
            top:    'leaflet-top ' + lr
        };

    for (var key in classNames) {
        if (!corners[key]) {
            corners[key] = L.DomUtil.create('div', classNames[key], parent);
        }
    }
	
/*
        var prefix = 'http://maps.kosmosnimki.ru/GetImage.ashx?usr=khaibrik%40scanex.ru&img=',
            onClick = function (ev) {
                console.log('click', arguments);
            },
            statechange = function (ev) {
                console.log('statechange', arguments, ev.target.options.isActive);
            };

        MAP.addControl(L.control.gmxIconGroup({
            id: 'myGroupControl',
            singleSelection: true,
            isSortable: true,
            items: [
                L.control.gmxIcon({
                    id: 'test1', title: 'Test icon', regularImageUrl: prefix + 'sled_walf.png'
                    })
                    .on('click', onClick)
                    .on('statechange', statechange)
                ,
                L.control.gmxIcon({
                    id: 'test2', title: 'Test icon2', regularImageUrl: prefix + 'logovo_walf.png'
                    })
                    .on('click', onClick)
                    .on('statechange', statechange)
            ]
        }));
*/
});
