var plugins = "test";
//console.log('testme');
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
});

L.Map.addInitHook(function() {
    var map = this,
        hideControl = null,
        hiddenClass = 'leaflet-control-gmx-hidden',
		// defaultSvgSprites = ['http://www.kosmosnimki.ru/lib/geomixer/img/svg-symbols.svg'],
		defaultSvgSprites = ['img/svg-symbols.svg'],
        DEFAULT = ['gmxLoaderStatus', 'gmxHide', 'gmxZoom', 'gmxDrawing', 'gmxBottom', 'gmxLocation', 'gmxCopyright', 'gmxCenter', 'gmxLogo'];

    this.gmxControlsManager = {
        _controls: {},
        _svgLoaded: {},
        add: function(control) {
            var opt = control.options,
                id = opt.id;
            this._controls[id] = control;
            if (control instanceof L.Control.GmxHide) {
                hideControl = control;
            }
            if (hideControl && !hideControl.options.isActive
                && !opt.notHide && !control._parent
                && control._container
              ) {
                L.DomUtil.addClass(control._container, hiddenClass);
            }
			map.fire('gmxcontroladd', {id: id, control: control});
            return this;
        },
        remove: function(control) {
            delete this._controls[control.options.id];
			map.fire('gmxcontrolremove', {id: control.options.id, control: control});
            return this;
        },
        get: function(id) {
            return this._controls[id];
        },
        getAll: function() {
            return this._controls;
        },
        init: function(options) {
            options = options || {};
            if (map.options.svgSprite !== false) {
				this.setSvgSprites(map.options.svgSprite);
            }
            if (map.zoomControl && !options.zoomControl) {
                map.removeControl(map.zoomControl);
            }
            if (map.attributionControl && !options.attributionControl) {
                map.removeControl(map.attributionControl);
            }
			DEFAULT.forEach(function(key) {
                if (!(key in options) || options[key] !== null) {
                    map.addControl(L.control[key](options[key]));
                }
			});
            return this;
        },
        setSvgSprites: function(arr) {
			arr = arr && arr !== true ? (L.Util.isArray(arr) ? arr : [arr]) : defaultSvgSprites;
			var _this = this;
			arr.forEach(function(url) {
				if (!_this._svgLoaded[url]) {
					_this._svgLoaded[url] = true;
					fetch(url, {mode: 'cors'}).then(function(resp) {
						return resp.text();
					}).then(function(txt) {
						var div = document.createElement('div');
						div.style.display = 'none';
						div.innerHTML = txt;
						document.body.insertBefore(div, document.body.childNodes[0]);
						map.fire('svgspriteloaded', {url: url});
					});
				}
			});
			map.options.svgSprite = arr;
            return this;
        }
    };
    this.gmxControlIconManager = this.gmxControlsManager;

	var st = '/geomixer-src.js';
	if (!map.options.svgSprite) {
		var arr = document.head.querySelectorAll('script[src*="' + st + '"]');
		if (arr.length < 1) {
			st = '/geomixer.js';
			arr = document.head.querySelectorAll('script[src*="' + st + '"]');
		}
		if (arr.length === 1) {
			var pref = arr[0].src;
			pref = pref.substring(0, pref.indexOf(st));
			map.gmxControlsManager.setSvgSprites(pref + '/img/svg-symbols.svg');
		}
	}
});

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

L.extend(L.Control.GmxDrawing.locale, {
    rus: {
        'Point': 'Маркер',
        'Polygon': 'Многоугольник',
        'Polyline': 'Линия',
        'Rectangle': 'Прямоугольник'
    }
});

L.extend(L.Control.GmxDrawing.locale, {
    eng: {
        'Point': 'Point',
        'Polygon': 'Polygon',
        'Polyline': 'Polyline',
        'Rectangle': 'Rectangle'
    }
});

L.Control.GmxCenter = L.Control.extend({
    options: {
        position: 'center',
        id: 'center',
        notHide: true,
        color: '#216b9c'
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
    },

    onAdd: function (map) {
        var className = 'leaflet-gmx-center',
			svgNS = 'http://www.w3.org/2000/svg',
            container = L.DomUtil.create('div', className),
            div = L.DomUtil.create('div', className),
            svg = document.createElementNS(svgNS, 'svg'),
            g = document.createElementNS(svgNS, 'g'),
            path = document.createElementNS(svgNS, 'path');

        this._container = container;
        container._id = this.options.id;
        if (this.options.notHide) { container._notHide = true; }

		path.setAttribute('stroke-width', 1);
		path.setAttribute('stroke-opacity', 1);
		path.setAttribute('d', 'M6 0L6 12M0 6L12 6');
        this._path = path;
		g.appendChild(path);
		svg.appendChild(g);
        svg.setAttribute('width', 12);
        svg.setAttribute('height', 12);
        div.appendChild(svg);
        container.appendChild(div);

        this.setColor(this.options.color);
        map.fire('controladd', this);
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    },

    setColor: function (color) {
        this.options.color = color;
        if (this._map) { this._path.setAttribute('stroke', color); }
        return this;
    }
});

L.Control.gmxCenter = L.Control.GmxCenter;
L.control.gmxCenter = function (options) {
  return new L.Control.GmxCenter(options);
};

L.Control.GmxHide = L.Control.GmxIcon.extend({
    options: {
        id: 'hide',
        isActive: true,
        togglable: true,
        notHide: true,
        position: 'topleft'
    },

    setActive: function (active, flagAll) {
        if (this._map) {
            var corners = this._map._controlContainer,
                hiddenClass = 'leaflet-control-gmx-hidden',
                func = active ? L.DomUtil.removeClass : L.DomUtil.addClass;

            for (var i = 0, len = corners.children.length; i < len; i++) {
                for (var j = 0, arr = corners.children[i].children, len1 = arr.length; j < len1; j++) {
                    var node = arr[j];
                    if (!node._notHide || flagAll) {
                        func(node, hiddenClass);
                    }
                }
            }
            this.options.isActive = !this.options.isActive;
			var use = this._container.getElementsByTagName('use');
			if (use && use.length) {
				var zn = (use[0].getAttribute('xlink:href') || '').replace(/-off$/, '');
				if (!this.options.isActive) { zn += '-off'; }
				use[0].setAttribute('href', zn);
			}
            this.fire('statechange');
        }
    },

    onAdd: function (map) {
        var container = L.Control.GmxIcon.prototype.onAdd.call(this, map),
            txt = 'Hide/Show';

        if (L.gmxLocale) {
            txt = L.gmxLocale.addText({
                'eng': {hide: txt},
                'rus': {hide: 'Скрыть/Показать'}
            }).getText('hide');
        }
        container._id = this.options.id;
        container.title = txt;
        container._notHide = this.options.notHide;
        //L.DomUtil.addClass(container, 'leaflet-gmx-icon-sprite');
        return container;
    }
});
L.Control.gmxHide = L.Control.GmxHide;
L.control.gmxHide = function (options) {
  return new L.Control.GmxHide(options);
};

L.Control.GmxLayers = L.Control.Layers.extend({
    options: {
        collapsed: false,
        autoZIndex: false,
        id: 'layers'
		// disabled options: sortLayers, sortFunction
    },

    initialize: function (gmxBaseLayersManager, options) {
        L.setOptions(this, options);

        this._layers = {};
        this._lastZIndex = 0;
        this._handlingClick = false;
		this._layerControlInputs = [];

        this._blm = gmxBaseLayersManager;

        L.extend(this, {
            _onBaseLayerActiveIDs: function(ev) {
                var i, len;
                for (i in this._layers) {
                    if (!this._layers[i].overlay) { delete this._layers[i]; }
                }
                for (i = 0, len = ev.activeIDs.length; i < len; i++) {
                    this._addBaseLayer(this._blm.get(ev.activeIDs[i]), true);
                }
                this._update();
                return true;
            },

            _onBaseLayerChange: function(ev) {
                if (ev.baseLayer) { this.setActiveBaseLayer(ev.baseLayer.id); }
            },

            _onBaseLayerOptionsChange: function(ev) {
                this._addBaseLayer(ev.baseLayer);
            }
        });
    },

    addBaseLayer: function () {
        console.log('Warning: Use `gmxBaseLayersManager.add` instead `addBaseLayer`!');
        return this;
    },

	_addLayer: function (layer, name, overlay) {
		var id = L.stamp(layer);

		this._layers[id] = {
			layer: layer,
			name: name,
			overlay: overlay
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	},

    _addBaseLayer: function (baseLayer, notUpdate) {
        if (baseLayer) {
			var lang = L.gmxLocale ? L.gmxLocale.getLanguage() : 'rus';
            this._addLayer(baseLayer, baseLayer.options[lang] || baseLayer.id);
            if (!notUpdate) { this._update(); }
        }
        return this;
    },

    _addItemObject: function (obj) {
        var label = this._addItem(obj);
        if (obj.layer && obj.layer._gmx && obj.layer._gmx.layerID) {
            label.className = '_' + obj.layer._gmx.layerID;
        }
    },

    _update: function () {
        if (!this._container) {
            return;
        }

		this._layerControlInputs = [];

        this._baseLayersList.innerHTML = '';
        this._overlaysList.innerHTML = '';

        var baseLayersPresent = false,
            overlaysPresent = false,
            activeIDs = this._blm.getActiveIDs(),
            activeIDsHash = {},
            i, len, obj;

        for (i in this._layers) {
            obj = this._layers[i];
            if (obj.overlay) {
                this._addItemObject(obj);
                overlaysPresent = true;
            } else {
                activeIDsHash[obj.layer.id] = obj;
                baseLayersPresent = true;
            }
        }
        for (i = 0, len = activeIDs.length; i < len; i++) {
            if (activeIDsHash[activeIDs[i]]) { this._addItemObject(activeIDsHash[activeIDs[i]]); }
        }

        if (this.options.hideBaseLayers) {
            baseLayersPresent = false;
            this._baseLayersList.style.display = 'none';
        }
        this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
        this._container.style.display = overlaysPresent || baseLayersPresent ? '' : 'none';
    },

    onAdd: function (map) {
        var cont = L.Control.Layers.prototype.onAdd.call(this, map);
        this._container = cont;
        cont.id = this.options.id;
        if (!('activeBaseLayerInput' in this)) {
            this.activeBaseLayerInput = this.getActiveBaseLayer(true);
        }
        L.DomEvent
            .on(cont, 'mousemove', L.DomEvent.stopPropagation);
        map.gmxLayersControl = this;
        map.fire('controladd', this);

        this._blm
            .on('baselayeroptionschange baselayeradd', this._onBaseLayerOptionsChange, this)
            .on('baselayeractiveids', this._onBaseLayerActiveIDs, this)
            .on('baselayerchange', this._onBaseLayerChange, this);

        var _this = this;
        this._blm.getActiveIDs().map(function(id) {
            _this._addBaseLayer(_this._blm.get(id));
        });
        var currentID = this._blm.getCurrentID();
        if (currentID) { this.setActiveBaseLayer(currentID); }

        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return cont;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        L.Control.Layers.prototype.onRemove.call(this, map);
        this._blm
            .off('baselayeroptionschange baselayeradd', this._onBaseLayerOptionsChange, this)
            .off('baselayeractiveids', this._onBaseLayerActiveIDs, this)
            .off('baselayerchange', this._onBaseLayerChange, this);

        map.fire('controlremove', this);
    },

    unSetActiveBaseLayer: function (name) {
        this._toogleActiveBaseLayer(name, false);
    },

    setActiveBaseLayer: function (name) {
        this._toogleActiveBaseLayer(name, true);
    },

    _toogleActiveBaseLayer: function (name, flag) {
        var active = null,
            inputs = this._form.getElementsByTagName('input'),
            targetInput = null,
            blayer = this._getLayerByName(name),
            tid = blayer && blayer.layer._leaflet_id,
            targetIsOverlay = blayer && blayer.overlay;

        for (var i = 0, len = inputs.length; i < len; i++) {
            var input = inputs[i],
                id = input.layerId,
                obj = this._layers[id],
                layer = obj.layer,
                isHasLayer = this._map.hasLayer(layer),
                isOverlay = obj.overlay || false;

            if (isOverlay) {
                if (tid === id) {
                    if (flag) {
                        if (!isHasLayer) { this._map.addLayer(layer); }
                    } else if (isHasLayer) {
                        this._map.removeLayer(layer);
                    }
                    return this;
                }
            } else if (!targetIsOverlay) {
                if (tid === id) {
                    if (flag) {
                        active = input;
                    } else if (isHasLayer) {
                        input.checked = false;
                        active = null;
                        this._map.removeLayer(layer);
                    }
                    targetInput = input;
                }
            }
        }
        if (active && targetInput) {
            this._map.addLayer(this._layers[targetInput.layerId].layer);
            targetInput.checked = true;
        }
        this.activeBaseLayerInput = active;
        return this;
    },

    getActiveBaseLayer: function (inputFlag) {
        var inputs = this._form.getElementsByTagName('input');
        for (var i = 0, len = inputs.length; i < len; i++) {
            var input = inputs[i];
            if (input.checked) {
                if (inputFlag) { return input; }
                var id = input.layerId,
                    obj = this._layers[id];
                if (!obj.overlay) {
                    return obj.name;
                }
            }
        }
        return null;
    },

	_getLayer: function (id) {
		return this._layers[id];
	},

    _getLayerByName: function (name) {
        for (var id in this._layers) {
            var blayer = this._layers[id];
            if (name === blayer.name || name === blayer.layer.id) { return blayer; }
        }
        return null;
    },

	_checkDisabledLayers: function () {
		var inputs = this._form.getElementsByTagName('input'),
		    input,
		    layer,
		    zoom = this._map.getZoom();

		for (var i = inputs.length - 1; i >= 0; i--) {
			input = inputs[i];
			layer = this._getLayer(input.layerId).layer;
			input.disabled = (layer.options.minZoom !== undefined && zoom < layer.options.minZoom) ||
			                 (layer.options.maxZoom !== undefined && zoom > layer.options.maxZoom);

		}
	},

    _onInputClick: function (ev) {
        if (ev) {
            var target = ev.target,
                name = this._layers[target.layerId].name,
                blayer = this._getLayerByName(name),
                flag = this.activeBaseLayerInput && target.layerId === this.activeBaseLayerInput.layerId ? false : target.checked;
            this._handlingClick = true;
            if (flag && blayer && !blayer.overlay) { this._blm.setCurrentID(blayer.layer.id); }
            else { this._toogleActiveBaseLayer(name, flag); }
            this._handlingClick = false;

            this._refocusOnMap();
        }
    }
});

L.Control.gmxLayers = L.Control.GmxLayers;
L.control.gmxLayers = function (gmxBaseLayersManager, options) {
  return new L.Control.GmxLayers(gmxBaseLayersManager, options);
};

(function () {
var _localeJson = {
    eng: {
        gmxLocation: {
            locationChange: 'Сhange the map center:',
            locationTxt: 'Current center coordinates',
            coordFormatChange: 'Toggle coordinates format',
            scaleBarChange: 'Toggle scale bar format'
        }
    },
    rus: {
        gmxLocation: {
            locationChange: 'Переместить центр карты:',
            locationTxt: 'Текущие координаты центра карты',
            coordFormatChange: 'Сменить формат координат',
            scaleBarChange: 'Сменить формат масштаба'
        }
    }
};

var _gtxt = function (key) {
    var res = '';
    if (L.gmxLocale) { res = L.gmxLocale.getText(key); }
    else {
        var arr = key.split('.');
        res = _localeJson.eng.gmxLocation[arr[arr.length - 1]]
    }
    return res || '';
};
var _mzoom = [
    'M 1:500 000 000',  //  0   156543.03392804
    'M 1:300 000 000',  //  1   78271.51696402
    'M 1:150 000 000',  //  2   39135.75848201
    'M 1:80 000 000',   //  3   19567.879241005
    'M 1:40 000 000',   //  4   9783.9396205025
    'M 1:20 000 000',   //  5   4891.96981025125
    'M 1:10 000 000',   //  6   2445.98490512563
    'M 1:5 000 000',    //  7   1222.99245256281
    'M 1:2500 000',     //  8   611.496226281406
    'M 1:1 000 000',    //  9   305.748113140703
    'M 1:500 000',      //  10  152.874056570352
    'M 1:300 000',      //  11  76.437028285176
    'M 1:150 000',      //  12  38.218514142588
    'M 1:80 000',       //  13  19.109257071294
    'M 1:40 000',       //  14  9.554628535647
    'M 1:20 000',       //  15  4.777314267823
    'M 1:10 000',       //  16  2.388657133912
    'M 1:5 000',        //  17  1.194328566956
    'M 1:2 500',        //  18  0.597164283478
    'M 1:1 250',        //  19  0.298582141739
    'M 1:625'           //  20  0.149291070869
];
var coordFormats = [
    '',
    '',
    ' (EPSG:3395)',
    ' (EPSG:3857)'
];
L.Control.GmxLocation = L.Control.extend({
    includes: L.Evented ? L.Evented.prototype : L.Mixin.Events,
    options: {
        position: 'gmxbottomright',
        id: 'location',
        gmxPopup: 'internal',
        notHide: true,
        coordinatesFormat: 0,
        scaleFormat: 'bar'  // or text
    },

    setScaleFormat: function (type) {
        this.options.scaleFormat = type === 'bar' ? 'bar' : 'text';
        this.scaleBar.style.visibility = type === 'bar' ? 'visible' : 'hidden';
        this._checkPositionChanged();
    },

    onAdd: function (map) {
        var className = 'leaflet-gmx-location',
            container = L.DomUtil.create('div', className),
            utils = L.Control.GmxLocation.Utils,
            my = this;

        this._container = container;
        container._id = this.options.id;
        if (this.options.notHide) {
            container._notHide = true;
        }
        if (L.gmxLocale) {
            L.gmxLocale.addText(_localeJson);
        }
        this.prevCoordinates = '';

		var corner = map._controlCorners[this.options.position];
		if (corner) {
			this._window = L.DomUtil.create('div', 'leaflet-gmx-location-window', container);
			this._window.style.display = 'none';
			var closeButton = L.DomUtil.create('div', 'closeButton', this._window);
			closeButton.innerHTML = '&#215;';
			L.DomEvent.disableClickPropagation(this._window);
			L.DomEvent.on(this._window, 'contextmenu', L.DomEvent.fakeStop || L.DomEvent._fakeStop);

			L.DomEvent.on(closeButton, 'click', function () {
				var style = my._window.style;
				style.display = style.display === 'none' ? 'block' : 'none';
			}, this);
			map.on('click', function () {
				my._window.style.display = 'none';
			}, this);
			this._windowContent = L.DomUtil.create('div', 'windowContent', this._window);
		}

        this.locationTxt = L.DomUtil.create('span', 'leaflet-gmx-locationTxt', container);
        this.locationTxt.title = _gtxt('gmxLocation.locationTxt');
        this.coordFormatChange = L.DomUtil.create('span', 'leaflet-gmx-coordFormatChange', container);
        this.coordFormatChange.title = _gtxt('gmxLocation.coordFormatChange');
        this.scaleBar = L.DomUtil.create('span', 'leaflet-gmx-scaleBar', container);
        this.scaleBarTxt = L.DomUtil.create('span', 'leaflet-gmx-scaleBarTxt', container);
        this.scaleBarTxt.title = this.scaleBar.title = _gtxt('gmxLocation.scaleBarChange');
        this._map = map;

        var util = {
            coordFormat: this.options.coordinatesFormat || 0,
            len: coordFormats.length,
            setCoordinatesFormat: function(num) {
                num = num || this.coordFormat || 0;
                if (num < 0) {
                    num = util.len - 1;
                } else if (num >= util.len) {
                    num = 0;
                }
                this.coordFormat = num;
                var res = utils.getCoordinatesString(my._map.getCenter(), this.coordFormat);
                if (res && my.prevCoordinates !== res) { my.locationTxt.innerHTML = res; }
                my.prevCoordinates = res;
                if (this._redrawTimer) { clearTimeout(this._redrawTimer); }
                this._redrawTimer = setTimeout(function() {
                    if (my._map) { my._map.fire('onChangeLocationSize', {locationSize: container.clientWidth}); }
                }, 100);
                my.fire('coordinatesformatchange', {coordinatesFormat: this.coordFormat});
            },
            goTo: function(value) {
				var coord = L.Control.gmxLocation.Utils.parseCoordinates(value);
				my._map.panTo(coord);
            },
            showCoordinates: function(ev) {        //окошко с координатами
                var oldText = utils.getCoordinatesString(my._map.getCenter(), this.coordFormat);
                if (my.options.onCoordinatesClick) {
                    my.options.onCoordinatesClick(oldText, ev);
                } else if (L.control.gmxPopup) {
                    var div = L.DomUtil.create('div', 'gmxLocation-popup'),
                        span = L.DomUtil.create('div', '', div),
                        input = L.DomUtil.create('input', 'gmxLocation-input', div),
                        button = L.DomUtil.create('button', '', div);

                    button.innerHTML = 'Ok';
                    L.DomEvent.on(button, 'click', function () {
                        util.goTo(input.value);
                    });
                    span.innerHTML = _gtxt('gmxLocation.locationChange');
                    input.value = oldText;
                    L.DomEvent.on(input, 'keydown', function (ev) {
                        if (ev.which === 13) { util.goTo(this.value); }
                    });
					if (my.options.gmxPopup === 'internal' && my._window) {
						my._windowContent.innerHTML = '';
						my._windowContent.appendChild(div);
						var style = my._window.style;
						style.display = style.display === 'none' ? 'block' : 'none';
                    } else {
						var opt = {};
						if (my.options.gmxPopup === 'tip') {
							var pos = my._map.mouseEventToContainerPoint(ev);
							opt = {
								tip: true,
								anchor: new L.Point(pos.x, pos.y - 5)
							};
						}
						L.control.gmxPopup(opt).setContent(div).openOn(my._map);
					}
                } else {
                    //if (this.coordFormat > 2) { return; } // только для стандартных форматов.
                    var text = window.prompt(my.locationTxt.title + ':', oldText);
                    if (text && text !== oldText) {
                        var point = utils.parseCoordinates(text);
                        if (point) { my._map.panTo(point); }
                    }
                }
            },
            nextCoordinatesFormat: function() {
                this.coordFormat += 1;
                this.setCoordinatesFormat(this.coordFormat || 0);
            }
        };
        this.getCoordinatesFormat = function() {
			return util.coordFormat;
		};

        this._checkPositionChanged = function () {
            var z = map.getZoom();

            if (z && !map._animatingZoom) {
                var attr = {txt: _mzoom[z], width: 0};
                if (this.options.scaleFormat === 'bar') {
                    attr = utils.getScaleBarDistance(z, map.getCenter());
                }

                if (!attr || (attr.txt === my._scaleBarText && attr.width === my._scaleBarWidth)) { return; }
                my._scaleBarText = attr.txt;
                my._scaleBarWidth = attr.width;
                if (my._scaleBarText) {
                    my.scaleBar.style.width = my._scaleBarWidth + 'px';//, 4);
                    my.scaleBarTxt.innerHTML = my._scaleBarText;
                }

                util.setCoordinatesFormat(util.coordFormat || 0);
            }
        };
        this._setCoordinatesFormat = function () {
            util.setCoordinatesFormat(util.coordFormat || 0);
        };

        this.setCoordinatesFormat = function (nm) {
            if (!map._animatingZoom) {
				if (nm === 0) { util.coordFormat = 0; }
				util.setCoordinatesFormat(nm);
			}
        };

        var toggleScaleFormat = function () {
            this.setScaleFormat(this.options.scaleFormat === 'bar' ? 'text' : 'bar');
        };
        this._toggleHandlers = function (flag) {
            var op = flag ? 'on' : 'off',
                func = L.DomEvent[op],
                stop = L.DomEvent.stopPropagation;

            func(container, 'mousemove', stop);
            func(this.coordFormatChange, 'click', stop);
            func(this.coordFormatChange, 'click', util.nextCoordinatesFormat, util);
            func(this.locationTxt, 'click', stop);
            func(this.locationTxt, 'click', util.showCoordinates, util);
            func(this.scaleBarTxt, 'click', stop);
            func(this.scaleBarTxt, 'click', toggleScaleFormat, this);
            func(this.scaleBar, 'click', stop);
            func(this.scaleBar, 'click', toggleScaleFormat, this);
            if (!L.Browser.mobile && !L.Browser.ie) {
                func(this.coordFormatChange, 'dblclick', stop);
                func(this.scaleBarTxt, 'dblclick', stop);
                func(this.scaleBar, 'dblclick', stop);
            }

            map[op]('moveend', this._checkPositionChanged, this);
            map[op]('move', this._setCoordinatesFormat, this);
        };
        this._toggleHandlers(true);
        this.setScaleFormat(this.options.scaleFormat);
        this._checkPositionChanged();
        map.fire('controladd', this);
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    },
    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
        this.prevCoordinates = this._scaleBarText = null;
        this._toggleHandlers(false);
    }
});

var utils = {
    getScaleBarDistance: function(z, pos) {
        var merc = L.Projection.Mercator.project(pos),
            pos1 = L.Projection.Mercator.unproject(new L.Point(merc.x + 40, merc.y + 30)),
            metersPerPixel = Math.pow(2, -z) * 156543.033928041 * this.distVincenty(pos.lng, pos.lat, pos1.lng, pos1.lat) / 50;

        for (var i = 0; i < 30; i++) {
            var distance = [1, 2, 5][i % 3] * Math.pow(10, Math.floor(i / 3)),
                w = Math.floor(distance / metersPerPixel);
            if (w > 50) {
                return {txt: this.prettifyDistance(distance), width: w};
            }
        }
        return null;
    }
};
if (L.gmxUtil) {
    utils.getCoordinatesString = L.gmxUtil.getCoordinatesString;
    utils.prettifyDistance = L.gmxUtil.prettifyDistance;
    utils.formatDegrees = L.gmxUtil.formatDegrees;
    utils.pad2 = L.gmxUtil.pad2;
    utils.trunc = L.gmxUtil.trunc;
    utils.latLonFormatCoordinates = L.gmxUtil.latLonFormatCoordinates;
    utils.latLonFormatCoordinates2 = L.gmxUtil.latLonFormatCoordinates2;
    utils.degRad = L.gmxUtil.degRad;
    utils.distVincenty = L.gmxUtil.distVincenty;
    utils.parseCoordinates = L.gmxUtil.parseCoordinates;
} else {
    utils.prettifyDistance = function(length) {
        var type = '', //map.DistanceUnit
            txt = _gtxt('units.km') || 'km',
            km = ' ' + txt;
        if (type === 'km') {
            return (Math.round(length) / 1000) + km;
        } else if (length < 2000 || type === 'm') {
            txt = _gtxt('units.m') || 'm';
            return Math.round(length) + ' ' + txt;
        } else if (length < 200000) {
            return (Math.round(length / 10) / 100) + km;
        }
        return Math.round(length / 1000) + km;
    };
    utils.formatDegrees = function(angle) {
        angle = Math.round(10000000 * angle) / 10000000 + 0.00000001;
        var a1 = Math.floor(angle),
            a2 = Math.floor(60 * (angle - a1)),
            a3 = this.pad2(3600 * (angle - a1 - a2 / 60)).substring(0, 2);
        return this.pad2(a1) + '°' + this.pad2(a2) + '\'' + a3 + '"';
    };
    utils.pad2 = function(t) {
        return (t < 10) ? ('0' + t) : ('' + t);
    };
    utils.trunc = function(x) {
        return ('' + (Math.round(10000000 * x) / 10000000 + 0.00000001)).substring(0, 9);
    };
    utils.latLonFormatCoordinates = function(x, y) {
        return  this.formatDegrees(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
            this.formatDegrees(Math.abs(x)) + (x > 0 ? ' E' : ' W');
    };
    utils.latLonFormatCoordinates2 = function(x, y) {
        return  this.trunc(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
            this.trunc(Math.abs(x)) + (x > 0 ? ' E' : ' W');
    };
    utils.degRad = function(ang) {
        return ang * (Math.PI / 180.0);
    };

    utils.distVincenty =  function(lon1, lat1, lon2, lat2) {
        var p1 = {};
        var p2 = {};

        p1.lon =  this.degRad(lon1);
        p1.lat =  this.degRad(lat1);
        p2.lon =  this.degRad(lon2);
        p2.lat =  this.degRad(lat2);

        var a = 6378137, b = 6356752.3142,  f = 1 / 298.257223563;  // WGS-84 ellipsiod
        var L = p2.lon - p1.lon;
        var U1 = Math.atan((1 - f) * Math.tan(p1.lat));
        var U2 = Math.atan((1 - f) * Math.tan(p2.lat));
        var sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
        var sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

        var lambda = L, lambdaP = 2 * Math.PI;
        var iterLimit = 20;
        while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
                var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
                var sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                    (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
                if (sinSigma === 0) { return 0; }
                var cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
                var sigma = Math.atan2(sinSigma, cosSigma);
                var sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
                var cosSqAlpha = 1 - sinAlpha * sinAlpha;
                var cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
                if (isNaN(cos2SigmaM)) { cos2SigmaM = 0; }
                var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
                lambdaP = lambda;
                lambda = L + (1 - C) * f * sinAlpha *
                    (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
        }
        if (iterLimit === 0) { return NaN; }

        var uSq = cosSqAlpha * (a * a - b * b) / (b * b);
        var A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
        var B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
        var deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
                B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
        var s = b * A * (sigma - deltaSigma);

        s = s.toFixed(3);
        return s;
    };

    utils.parseCoordinates = function(text) {
        // should understand the following formats:
        // 55.74312, 37.61558
        // 55°44'35" N, 37°36'56" E
        // 4187347, 7472103
        // 4219783, 7407468 (EPSG:3395)
        // 4219783, 7442673 (EPSG:3857)

        var crs = null,
            regex = /\(EPSG:(\d+)\)/g,
            t = regex.exec(text);

        if (t) {
            crs = t[1];
            text = text.replace(regex, '');
        }

        if (text.match(/[йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮqrtyuiopadfghjklzxcvbmQRTYUIOPADFGHJKLZXCVBM_:]/)) {
            return null;
        }

        //there should be a separator in the string (exclude strings like "11E11")
        if (text.indexOf(' ') === -1 && text.indexOf(',') === -1) {
            return null;
        }

        if (text.indexOf(' ') !== -1) {
            text = text.replace(/,/g, '.');
        }
        var results = [];
        regex = /(-?\d+(\.\d+)?)([^\d\-]*)/g;
        t = regex.exec(text);
        while (t) {
            results.push(t[1]);
            t = regex.exec(text);
        }
        if (results.length < 2) {
            return null;
        }
        var ii = Math.floor(results.length / 2),
            y = 0,
            mul = 1,
            i;
        for (i = 0; i < ii; i++) {
            y += parseFloat(results[i]) * mul;
            mul /= 60;
        }
        var x = 0;
        mul = 1;
        for (i = ii; i < results.length; i++) {
            x += parseFloat(results[i]) * mul;
            mul /= 60;
        }

        if (Math.max(text.indexOf('N'), text.indexOf('S')) > Math.max(text.indexOf('E'), text.indexOf('W'))) {
            t = x;
            x = y;
            y = t;
        }

        var pos;
        if (crs === '3857') {
            pos = L.Projection.SphericalMercator.unproject(new L.Point(y, x));
            x = pos.lng;
            y = pos.lat;
        }
        if (Math.abs(x) > 180 || Math.abs(y) > 180) {
            pos = L.Projection.Mercator.unproject(new L.Point(y, x));
            x = pos.lng;
            y = pos.lat;
        }

        if (text.indexOf('W') !== -1) {
            x = -x;
        }

        if (text.indexOf('S') !== -1) {
            y = -y;
        }
        return [y, x];
    };

    utils.getCoordinatesString = function(latlng, num) {
        var x = latlng.lng,
            y = latlng.lat,
            formats = coordFormats,
            len = formats.length,
            merc,
            out = '';
        num = num || 0;
        if (x > 180) { x -= 360; }
        if (x < -180) { x += 360; }
        if (num % len === 0) {
            out = utils.latLonFormatCoordinates2(x, y);
        } else if (num % len === 1) {
            out = utils.latLonFormatCoordinates(x, y);
        } else if (num % len === 2) {
            merc = L.Projection.Mercator.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[2];
        } else {
            merc = L.CRS.EPSG3857.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[3];
        }
        return out;
    };
}
L.Control.GmxLocation.Utils = utils;

L.Control.gmxLocation = L.Control.GmxLocation;
L.control.gmxLocation = function (options) {
  return new L.Control.GmxLocation(options);
};
})();

L.Control.GmxPopup = L.Control.extend({
    options: {
        position: 'center',
        id: 'gmxPopup',
        className: 'gmxControlPopup',
        draggable: true
    },

    onAdd: function (map) {
        this._map = map;
		if (!this._container) {
			this._initLayout();
		}
        map.on('click', this.remove, this);
        return this._container;
    },

    openOn: function (map) {
        map.addControl(this);
		this.update();
		return this;
    },

    remove: function () {
		if (this._map) {
            this._map.off('click', this.remove, this);
			if (L.Control.prototype.remove) {
				L.Control.prototype.remove.call(this);
			} else {
				this._map.removeControl(this);
			}
        }
		return this;
    },

	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	update: function () {
		if (!this._container) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';
		return this;
	},

	_updateContent: function () {
		if (!this._content) { return; }

		if (typeof this._content === 'string') {
			this._contentNode.innerHTML = this._content;
		} else {
			while (this._contentNode.hasChildNodes()) {
				this._contentNode.removeChild(this._contentNode.firstChild);
			}
			this._contentNode.appendChild(this._content);
		}
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			L.DomUtil.addClass(container, scrolledClass);
		} else {
			L.DomUtil.removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var offset = new L.Point(this._container.clientWidth, this._container.clientHeight),
            anchor = this.options.anchor && this.options.anchor._subtract(L.point(10, this._container.clientHeight)) || this._map.getSize()._divideBy(2),
            pos = anchor._subtract(offset._divideBy(2));

        L.DomUtil.setPosition(this._container, pos);
	},

	_initLayout: function () {
		var container = this._container = L.DomUtil.create('div', this.options.className),
			closeButton = L.DomUtil.create('div', 'closeButton', container);

        closeButton.innerHTML = '&#215;';
        L.DomEvent.disableClickPropagation(closeButton);
        L.DomEvent.disableClickPropagation(container);

        L.DomEvent.on(closeButton, 'click', this.remove, this);
        if (this.options.draggable) {
            new L.Draggable(container).enable();
            container.style.cursor = 'move';
        }

		var wrapper = L.DomUtil.create('div', 'content-wrapper', container);
		L.DomEvent.disableClickPropagation(wrapper);

		this._contentNode = L.DomUtil.create('div', 'content', wrapper);

		L.DomEvent.disableScrollPropagation(this._contentNode);
		L.DomEvent.on(wrapper, 'contextmenu', L.DomEvent.stopPropagation);

        if (this.options.tip) {
            this._tipContainer = L.DomUtil.create('div', 'tip-container', container);
            this._tip = L.DomUtil.create('div', 'tip', this._tipContainer);
        }
	}
});

L.control.gmxPopup = function (options) {
  return new L.Control.GmxPopup(options);
};

(function () {

var _gtxt = function (key) {
    var res = L.gmxLocale ? L.gmxLocale.getText(key) : null;
    return res || '';
};

L.Control.GmxCopyright = L.Control.extend({
    options: {
        position: 'gmxbottomleft',
        type: 'window', // 'window' or 'line'
        closeButton: false,
        notHide: true,
		cursorPosition: false,
        mapCopyright: '',
        scanexCopyright: '<a target="_blank" href="http://kosmosnimki.ru/terms.html">&copy; 2007-' + (new Date().getUTCFullYear()) + ' RDC ScanEx</a> - Terms of Service',
        leafletCopyright: '<a target="_blank" href="http://leafletjs.com">&copy; Leaflet</a>',
        id: 'copyright'
    },

    onAdd: function (map) {
        if (L.gmxLocale) {
            L.gmxLocale.addText({
                eng: {
                    gmxCopyright: {
                        showHide: 'Show/Hide copyrights'
                    }
                },
                rus: {
                    gmxCopyright: {
                        showHide: 'Показать/Скрыть копирайты'
                    }
                }
            });
        }
        this._currentText = '';

        this._container = L.DomUtil.create('span', 'leaflet-gmx-copyright');
        if (this.options.notHide) { this._container._notHide = true; }
        this._container._id = this.options.id;

        this._window = L.DomUtil.create('div', 'leaflet-gmx-copyright-window', this._container);
		if (this.options.closeButton) {
			var closeButton = L.DomUtil.create('div', 'closeButton', this._window);
			closeButton.innerHTML = '&#215;';
			L.DomEvent.on(closeButton, 'click', this.toggleWindow, this);
		}

		this._windowContent = L.DomUtil.create('div', 'windowContent', this._window);
		L.DomEvent.on(this._window, 'contextmenu', L.DomEvent.fakeStop || L.DomEvent._fakeStop);

        this._copyrights = L.DomUtil.create('span', 'leaflet-gmx-copyrights', this._container);

        if (this.options.cursorPosition) {
			var utils = L.gmxUtil || (L.Control.GmxLocation ? L.Control.GmxLocation.Utils : null),
				gmxLocation = map.gmxControlsManager.get('location') || null;

			if (utils) {
				var cursorPositionContainer = L.DomUtil.create('span', 'leaflet-gmx-cursorposition', this._container);
				this.lastLatLng = L.latLng(0, 0);
				this.cursorPosition = function (ev) {
					if (!map._animatingZoom) {
						var latlng = ev.latlng,
							mouseDown = L.Browser.webkit ? ev.originalEvent.which : ev.originalEvent.buttons;
						if (!mouseDown && !latlng.equals(this.lastLatLng)) {
							this.lastLatLng = latlng;
							cursorPositionContainer.innerHTML = utils.getCoordinatesString(latlng, gmxLocation ? gmxLocation.getCoordinatesFormat() : 0);
						}
					}
				};
				map.on('mousemove', this.cursorPosition, this);
			}
		}
        this.setFormat = function (type) {
            if (type === 'window') {
                this._copyrights.title = _gtxt('gmxCopyright.showHide');
                this._copyrights.innerHTML = '© Copyrights';
                this._container.style.width = 'auto';
            } else {
                this._copyrights.title = '';
            }
            this.options.type = type;
            this.toggleWindow();
            this._window.style.display = 'none';
        };

        this.setFormat(this.options.type);
        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .on(this._window, 'dblclick', stop)
            .on(this._window, 'click', stop)
            .on(this._container, 'mousemove', stop)
            .on(this._copyrights, 'dblclick', stop)
            .on(this._copyrights, 'click', stop)
            .on(this._copyrights, 'click', this.toggleWindow, this);
        map
            .on('click', this.closeWindow, this)
            .on('onChangeLocationSize', this._chkWidth, this)
            .on('moveend', this._redraw, this)
            .on('layeradd', this._redraw, this)
            .on('layerremove', this._redraw, this);
        this._redraw();
        map.fire('controladd', this);
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return this._container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
        var stop = L.DomEvent.stopPropagation;
        L.DomEvent
            .off(this._window, 'dblclick', stop)
            .off(this._window, 'click', stop)
            .off(this._container, 'mousemove', stop)
            .off(this._copyrights, 'dblclick', stop)
            .off(this._copyrights, 'click', stop)
            .off(this._copyrights, 'click', this.toggleWindow, this);
        map
            .off('click', this.closeWindow, this)
            .off('onChangeLocationSize', this._chkWidth, this)
            .off('moveend', this._redraw, this)
            .off('layeradd', this._redraw, this)
            .off('layerremove', this._redraw, this);

        if (this.cursorPosition) {
			map.off('mousemove', this.cursorPosition, this);
		}
    },

    toggleWindow: function() {
		this.setWindowVisible(this._window.style.display === 'none' ? true : false);
    },

    closeWindow: function() {
		this.setWindowVisible(false);
    },

    setWindowVisible: function(flag) {
		if (this.options.type === 'window') {
			var style = this._window.style;
			style.display = flag ? 'block' : 'none';
			this._currentText = '';
			this._redraw();
		}
    },

    _chkWidth: function(ev) {
        if (this.options.type !== 'window') {
            var width = this._map._size.x - ev.locationSize - 25;
            this._container.style.width = (width > 0 ? width : 0) + 'px';
        }
    },

    setMapCopyright: function(copyright) {
        this.options.mapCopyright = copyright || '';
        this._redraw();
    },

    _redrawItems: function() {
        var prefix = '<a target="_blank"',
            texts = [],
            _layers = this._map._layers,
            _zoom = this._map._zoom,
            _bounds = this._map.getBounds(),
            arr = [],
            chkExists = {};

        if (this.options.scanexCopyright) { texts.push(this.options.scanexCopyright); }
        if (this.options.mapCopyright) { texts.push(this.options.mapCopyright); }
        for (var id in _layers) {
            if (_layers[id].options) { arr.push(_layers[id].options); }
        }
        arr = arr.sort(function(a, b) { return a.zIndex - b.zIndex; });

        arr.forEach(function(item) {
            var attribution = item.attribution;
            if (attribution && !chkExists[attribution]) {
                chkExists[attribution] = true;
                texts.push(attribution.split('<a').join(prefix));
            }

            if (item.gmxCopyright) {
                item.gmxCopyright.forEach(function(item1) {
                    var copyright = item1.attribution;
                    if (chkExists[copyright] || _zoom < item1.minZoom || _zoom > item1.maxZoom) { return; }
                    if (item1.bounds) {
                        if (!(item1.bounds instanceof L.LatLngBounds)) {
                            item1.bounds = L.latLngBounds(item1.bounds);
                        }
                        if (!_bounds.intersects(item1.bounds)) { return; }
                    }
                    chkExists[copyright] = true;
                    texts.push(copyright.split('<a').join(prefix));
                });
            }
        });
        if (this.options.leafletCopyright) { texts.push(this.options.leafletCopyright); }

        var text = texts.join(' ');

        if (this._currentText !== text) {
            this._currentText = text;
            if (this.options.type === 'window') {
                this._windowContent.innerHTML = texts.join('<br>');
            } else {
                this._copyrights.innerHTML = text;
            }

        }
    },

    _redraw: function () {
        if (!this._map._animatingZoom) {
			if (this._redrawTimer) { cancelIdleCallback(this._redrawTimer); }
			this._redrawTimer = requestIdleCallback(function () {
				if (this._map) { this._redrawItems(); }
			}.bind(this), {timeout: 250});
		}
        // var my = this;
			// if (this._redrawTimer) { clearTimeout(this._redrawTimer); }
			// this._redrawTimer = setTimeout(function() {
				// my._redrawTimer = null;
				// if (my._map) { my._redrawItems(); }
			// }, 100);
		// }
    }
});

L.Control.gmxCopyright = L.Control.GmxCopyright;
L.control.gmxCopyright = function (options) {
  return new L.Control.GmxCopyright(options);
};
})();

L.Control.GmxZoom = L.Control.Zoom.extend({
    options: {
        id: 'zoom',
        disableEvents: 'mousemove mousedown contextmenu',
		//position: 'gmxbottomright',	// topleft left topright right gmxbottomright
		info: true
    },

    onAdd: function (map) {
		this.options.zoomInfoTitle = 'Current zoom';
        if (L.gmxLocale && L.gmxLocale.getLanguage() === 'rus') {
			this.options.zoomInTitle = 'Увеличить';
			this.options.zoomOutTitle = 'Уменьшить';
			this.options.zoomInfoTitle = 'Текущий номер зума';
        }
		var classPrefix = 'gmxzoom',
			needInfo = !this._zoomInfo;
		if (this.options.info && needInfo) {
			this._zoomInfo = L.DomUtil.create('div', classPrefix + '-info');
			this._zoomInfo.title = this.options.zoomInfoTitle;
		}
		var container = L.Control.Zoom.prototype.onAdd.call(this, map);
		L.DomEvent.on(container, this.options.disableEvents, L.DomEvent.stop);
		L.DomEvent.on(container, this.options.disableEvents, L.DomEvent.preventDefault);
		L.DomUtil.addClass(container, classPrefix + '-container');
		if (this.options.info && needInfo) {
			container.insertBefore(this._zoomInfo, this._zoomOutButton);
		}
        return container;
    },

    _updateDisabled: function (ev) {
        L.Control.Zoom.prototype._updateDisabled.call(this, ev);
		if (this._zoomInfo) {
			var map = this._map,
				z = map._zoom;
			if (z <= map.getMinZoom() || z >= map.getMaxZoom()) {
				L.DomUtil.addClass(this._zoomInfo, 'gmxZoomRed');
			} else {
				L.DomUtil.removeClass(this._zoomInfo, 'gmxZoomRed');
			}
			this._zoomInfo.innerHTML = z;
		}
    },

    setVisible: function(isVisible) {
        if (this._container) {
            this._container.style.display = isVisible ? 'block' : 'none';
        }
    }
});

L.Control.gmxZoom = L.Control.GmxZoom;
L.control.gmxZoom = function (options) {
  return new L.Control.GmxZoom(options);
};

L.Control.GmxBottom = L.Control.extend({
    options: {
        position: 'bottom',
        notHide: true,
        id: 'bottom'
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
        var corners = map._controlCorners;
        ['bottomleft', 'bottomright', 'right', 'left'].map(function (it) {
            if (corners[it]) {
                L.DomUtil.removeClass(corners[it], 'gmx-bottom-shift');
            }
        });
    },

    onAdd: function (map) {
        var className = 'leaflet-gmx-copyright-location',
            container = L.DomUtil.create('div', className);

        this._container = container;
        container._id = this.options.id;
        if (this.options.notHide) { container._notHide = true; }
        L.DomEvent
            .on(container, 'mousemove', L.DomEvent.stopPropagation)
            .on(this._map._controlContainer, 'dblclick', L.DomEvent.stopPropagation);
        L.DomUtil.create('div', className + '-bg', container);
        map.fire('controladd', this);

        var corners = map._controlCorners;
        ['bottomleft', 'bottomright', 'right', 'left'].map(function (it) {
            if (corners[it]) {
                L.DomUtil.addClass(corners[it], 'gmx-bottom-shift');
            }
        });
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    }
});

L.Control.gmxBottom = L.Control.GmxBottom;
L.control.gmxBottom = function (options) {
  return new L.Control.GmxBottom(options);
};

L.Control.GmxLogo = L.Control.extend({
    options: {
        position: 'gmxbottomcenter',
        notHide: true,
        id: 'logo'
    },

    onAdd: function (map) {
        var container = L.DomUtil.create('a', '');
        this._container = container;
        if (this.options.notHide) { container._notHide = true; }
        container.id = this.options.id;
        container.setAttribute('href', 'http://geomixer.ru');
        container.setAttribute('target', '_blank');

        this._logoPrefix = 'leaflet-gmx-logo' + (this.options.type ? '-' + this.options.type : '');
        var shiftClass = this._logoPrefix + '-shift';
        this._shift = false;
        this._updatePosition = function (ev) {
            if (container.parentNode) {
                var shift = (container.clientWidth - container.parentNode.clientWidth) / 2 + ev.locationSize > 0 ? true : false;
                if (this._shift !== shift) {
                    this._shift = shift;
                    if (shift) {
                        L.DomUtil.addClass(container, shiftClass);
                    } else {
                        L.DomUtil.removeClass(container, shiftClass);
                    }
                }
            }
        };
        map.fire('controladd', this);
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
        map.off('onChangeLocationSize', this._updatePosition, this);
    },

    addTo: function (map) {
        L.Control.prototype.addTo.call(this, map);
        L.DomUtil.addClass(this._container, this._logoPrefix);
        map.on('onChangeLocationSize', this._updatePosition, this);
        return this;
    }
});

L.Control.gmxLogo = L.Control.GmxLogo;
L.control.gmxLogo = function (options) {
  return new L.Control.GmxLogo(options);
};

L.Map.addInitHook(function () {
    if (!this._controlCorners.bottom) {
        this._controlCorners.bottom = L.DomUtil.create(
            'div',
            'leaflet-bottom leaflet-left leaflet-right',
            this._controlContainer
        );
    }
});

L.Control.GmxSidebar = L.Control.extend({
    options: {
        id: 'defaultSidebar',
        position: 'right'
    },
    onAdd: function(map) {
        var container = document.createElement('div');
        this._container = container;
        container._id = this.options.id;
        container.className = 'leaflet-gmx-sidebar';
        if (typeof this.options.width === 'number') {
            container.setAttribute('style', 'width: ' + this.options.width + 'px');
        }
        if (typeof this.options.className === 'string') {
            L.DomUtil.addClass(container, this.options.className);
        }
        L.DomEvent
            .on(container, 'mousemove', L.DomEvent.stopPropagation)
            .on(container, 'dblclick', L.DomEvent.stopPropagation);

        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        return container;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
    },
    expand: function() {
        L.DomUtil.addClass(this._container, 'leaflet-gmx-sidebar_expanded');
    },
    collapse: function() {
        L.DomUtil.removeClass(this._container, 'leaflet-gmx-sidebar_expanded');
    },
    isExpanded: function() {
        return L.DomUtil.hasClass(this._container, 'leaflet-gmx-sidebar_expanded');
    },
    getContentContainer: function() {
        return this.getContainer();
    },
    setWidth: function(w) {
        if (typeof w === 'number') {
            this._container.setAttribute('style', 'width: ' + w + 'px');
        }
    }
});

L.Control.gmxSidebar = L.Control.GmxSidebar;
L.control.gmxSidebar = function(options) {
    return new L.Control.GmxSidebar(options);
};

L.Control.GmxLoaderStatus = L.Control.extend({
    options: {
        id: 'loaderStatus',
        position: 'topleft',
        type: 'gif' // 'gif' 'font'
    },
    _items: {},
    _text: 'Loader status',

    addItem: function (id, type) {
        var itemId = id || L.gmxUtil.newId(),
            item = this._items[itemId],
            className = this.options.type === 'gif' ? 'icon-refresh-gif' : 'animate-spin icon-refresh';
        className += (type ? ' leaflet-gmx-loaderStatus-' + type : '');

        this._div.className = className;
        L.DomUtil.removeClass(this._container, 'leaflet-gmx-visibility-hidden');
        if (item) {
            item++;
        } else {
            this._items[itemId] = 1;
        }
		this._container.title = this._text + ': ' + Object.keys(this._items).length;

        return itemId;
    },

    removeItem: function (id) {
        var item = this._items[id];
        if (item > 1) {
            this._items[id]--;
        } else {
            delete this._items[id];
        }
        if (Object.keys(this._items).length === 0) {
            if (this.options.type !== 'gif') { L.DomUtil.removeClass(this._div, 'animate-spin'); }
            L.DomUtil.addClass(this._container, 'leaflet-gmx-visibility-hidden');
        }
		this._container.title = this._text + ': ' + Object.keys(this._items).length;
    },

    onRemove: function (map) {
        if (map.gmxControlsManager) {
            map.gmxControlsManager.remove(this);
        }
        map.fire('controlremove', this);
        delete L.gmx.loaderStatus;
    },

    onAdd: function (map) {
        var options = this.options,
            className = 'leaflet-gmx-visibility-hidden leaflet-gmx-' + options.id,
            container = L.DomUtil.create('div', className),
            div = L.DomUtil.create('div', options.type === 'gif' ? 'icon-refresh-gif' : 'animate-spin icon-refresh', container),
            txt = 'Loader status';

        if (L.gmxLocale) {
            txt = L.gmxLocale.addText({
                'eng': {hide: txt},
                'rus': {hide: 'Статус загрузки'}
            }).getText('hide');
        }

        container._id = this.options.id;
        container.title = this._text = txt;

        this._container = container;
        this._div = div;
        this._items = {};

        map.fire('controladd', this);
        if (map.gmxControlsManager) {
            map.gmxControlsManager.add(this);
        }
        var _this = this;
        if (!L.gmxUtil) { L.gmxUtil = {}; }
        L.gmxUtil.loaderStatus = function(id, removeFlag, type) {
            return _this[removeFlag ? 'removeItem' : 'addItem'].apply(_this, [id, type]);
        };
		L.DomEvent
			.on(container, 'click', L.DomEvent.stopPropagation)
			.on(container, 'click', function() {
				var arr = Object.keys(this._items);
				console.info('Запросов в очереди на загрузку:', arr);
			}, this);
        return container;
    }
});

L.Control.gmxLoaderStatus = L.Control.GmxLoaderStatus;
L.control.gmxLoaderStatus = function (options) {
  return new L.Control.GmxLoaderStatus(options);
};
