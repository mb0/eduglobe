// Copyright 2013 Martin Schnabel. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

(function() {

var leftofedge = function(v1, v2, x, y) {
	return (v2[0] - v1[0]) * (y - v1[1]) - (v2[1] - v1[1]) * (x - v1[0]);
};
var windingnumber = function(ring, x, y) {
	var wn = 0;
	var i, v1, v2 = ring[0];
	for (i = 1; i < ring.length; i++) {
		v1 = v2;
		v2 = ring[i];
		if (v1[1] <= y) {
			if (v2[1] > y && leftofedge(v1, v2, x, y) > 0) {
				wn++;
			}
		} else {
			if (v2[1] <= y && leftofedge(v1, v2, x, y) < 0) {
				wn--;
			}
		}
	}
	return wn;
};
var shuffel = function(array) {
	var i, tmp, rand, copy = array.concat();
	for (i=0; i<copy.length; i++) {
		rand = (Math.random()*copy.length)|0;
		tmp = copy[i];
		copy[i] = copy[rand];
		copy[rand] = tmp;
	}
	return copy;
};
var Polygon = function(data, box) {
	this.data = data;
	this.box = box;
};
Polygon.prototype = {
	contains: function(x, y) {
		if (this.data.length < 1 || this.data[0].length < 4)
			return false;
		if (!this.box.contains(x,y)) {
			return false;
		}
		if (windingnumber(this.data[0], x, y) === 0) {
			return false;
		}
		for (var i = 1; i < this.data.length; i++) {
			if (windingnumber(this.data[i], x, y) !== 0) {
				return false;
			}
		}
		return true;
	},
	draw: function(ctx) {
		var xy,i,j;
		for (i=0; i < this.data.length; i++) {
			var ring = this.data[i];
			for (j=0; j < ring.length; j++) {
				xy = ring[j];
				if (j === 0) {
					ctx.moveTo(xy[0], xy[1]);
				} else {
					ctx.lineTo(xy[0], xy[1]);
				}
			}
		}
	},
};

var BBox = function() {
	this.x1 = this.y1 = this.x2 = this.y2 = null;
};
BBox.prototype = {
	grow: function(x, y) {
		if (this.x1 === null || this.x1 > x) this.x1 = x;
		if (this.y1 === null || this.y1 > y) this.y1 = y;
		if (this.x2 === null || this.x2 < x) this.x2 = x;
		if (this.y2 === null || this.y2 < y) this.y2 = y;
	},
	contains: function(x, y) {
		return this.x1 <= x && this.x2 >= x &&
			this.y1 <= y && this.y2 >= y;
	}
};

var Layer = function(data) {
	this.id = data.Id;
	this.name = data.Name;
	this.iso = data.Iso;
	this.capital = data.Capital;
	this.area = data.Area;
	this.mpoly = data.MPoly;
};
// Map represents the map dimensions
var Map = function(w, h) {
	this.w = w;
	this.h = h;
	this.layers = [];
	this.onclick = null;
};

Map.prototype = {
	// equirectangular projection
	projectPoly: function(poly) {
		var box = new BBox();
		var i, j, p;
		for (i=0; i < poly.length; i++) {
			for (j=0; j < poly[i].length; j++) {
				p = poly[i][j];
				p[0] = ((p[0]+180)/360)*this.w;
				p[1] = ((-p[1]+90)/180)*this.h;
				if (i === 0 && j > 0) {
					box.grow(p[0], p[1]);
				}
			}
		}
		return new Polygon(poly, box);
	},
	add: function(data) {
		var layer = new Layer(data);
		for (var i=0; i < layer.mpoly.length; i++) {
			layer.mpoly[i] = this.projectPoly(layer.mpoly[i]);
		}
		this.layers.push(layer);
	},
	clear: function() {
		this.layers = [];
	},
	layerAt: function(x, y) {
		for (var i=0; i < this.layers.length; i++) {
			var l = this.layers[i];
			for (var j=0; j < l.mpoly.length; j++) {
				if (l.mpoly[j].contains(x,y)) {
					return l;
				}
			}
		}
		return null;
	},
	click: function(x, y) {
		var l = this.layerAt(x, y);
		if (l !== null && this.onclick) {
			this.onclick(l, x, y);
		}
	},
	over: function(x, y) {
		var l = this.layerAt(x, y);
		var changed = l !== this.overlayer;
		if (changed) {
			this.overlayer = l;
		}
		return changed;
	},
};

var Render2d = function(canvas, map) {
	this.canvas = canvas;
	this.map = map;
	this.scale = 0.5;
	this.offset = {x: 0, y: 0};
	this.ctx = canvas.getContext("2d");
	this.bg = null;
	this.update = false;
};
Render2d.prototype = {
	loadBg: function(href) {
		var r = this;
		this.bg = new Image();
		this.bg.src = href;
		this.bg.onload = function() {
			r.render();
		};
		return this.bg;
	},
	render: function() {
		this.update = false;
		this.ctx.save();
		this.ctx.scale(this.scale, this.scale);
		this.ctx.translate(-this.offset.x, -this.offset.y);
		if (this.bg) {
			this.ctx.drawImage(this.bg, 0, 0);
		}
		this.ctx.lineWidth = 0.4;
		this.ctx.strokeStyle = "#FF0000";
		this.ctx.fillStyle = "rgba(60,60,60,.2)";
		var i, l;
		for (i=0; i < this.map.layers.length; i++) {
			l = this.map.layers[i];
			var over = l == this.map.overlayer;
			if (over) {
				this.ctx.fillStyle = "rgba(255,255,255,.3)";
			}
			this.ctx.beginPath();
			for (var j=0; j < l.mpoly.length; j++) {
				l.mpoly[j].draw(this.ctx);
			}
			this.ctx.fill();
			this.ctx.stroke();
			if (over) {
				this.ctx.fillStyle = "rgba(60,60,60,.2)";
			}
		}
		this.ctx.restore();
	},
	move: function(dx, dy) {
		if (dx) {
			this.update = true;
			var x = this.offset.x + dx/this.scale;
			x = Math.min(this.map.w-this.canvas.width/this.scale, x);
			this.offset.x = Math.max(0, x);
		}
		if (dy) {
			this.update = true;
			var y = this.offset.y + dy/this.scale;
			y = Math.min(this.map.h-this.canvas.height/this.scale, y);
			this.offset.y = Math.max(0, y);
		}
		if (this.update) this.render();
	},
	click: function(ox, oy) {
		var mx = ox/this.scale + this.offset.x;
		var my = oy/this.scale + this.offset.y;
		this.map.click(mx, my);
	},
	over: function(ox, oy) {
		var mx = ox/this.scale + this.offset.x;
		var my = oy/this.scale + this.offset.y;
		var changed = this.map.over(mx, my);
		if (changed) {
			this.render();
		}
	},
	zoom: function(delta, ox, oy) {
		var px = (ox/this.scale + this.offset.x) / this.map.w;
		var py = (oy/this.scale + this.offset.y) / this.map.h;
		// scale
		this.scale = Math.max(0.5, Math.min(6, this.scale + delta));
		// fix offset
		var fx = px * this.map.w - ox/this.scale;
		var fy = py * this.map.h - oy/this.scale;
		this.offset.x = Math.max(0, Math.min(this.map.w-this.canvas.width/this.scale, fx));
		this.offset.y = Math.max(0, Math.min(this.map.h-this.canvas.height/this.scale, fy));
		this.render();
	},
};
var Select = function(game) {
	this.game = game;
	this.game.state = this;
	this.game.loadMapdata("region.json");
};
Select.prototype = {
	start: function() {
		this.game.ui.instruct("select a region to start the quiz");
	},
	clickLayer: function(l) {
		this.game.start(l.id);
	},
};
var Quiz = function(game, id) {
	this.game = game;
	this.game.state = this;
	this.id = id;
	this.game.loadMapdata("country_"+ id +".json");
	this.round = 0;
	this.fails = 0;
	this.startTime = 0;
	this.layers = [];
};
Quiz.prototype = {
	start: function() {
		// filter small islands
		var layers = this.game.map.layers;
		for (var i=0; i<layers.length; i++) {
			if (layers[i].area < 8000) {
				layers.splice(i--, 1);
			}
		}
		// and shuffel countries
		this.layers = shuffel(layers);
		this.startTime = Date.now();
		this.game.ui.instruct("find", this.layers[0].name);
	},
	clickLayer: function(l) {
		if (l.id == this.layers[0].id) { // correct
			this.layers.shift();
			if (true) { // if easy mode
				var layers = this.game.map.layers;
				for (var i=0; i<layers.length; i++) {
					if (layers[i] == l) {
						layers.splice(i, 1);
						break;
					}
				}
				this.game.renderer.render();
			}
			if (this.layers.length > 0) {
				this.game.ui.instruct("correct! now find", this.layers[0].name);
			} else {
				this.game.ui.instruct("congratulations! you won!");
				this.game.start();
			}
		} else { // fail
			this.fails++;
			this.game.ui.instruct("sorry this is", l.name, "... find", this.layers[0].name);
		}
	},
};
var Control = function(game) {
	var lastover = 0;
	window.addEventListener("keydown", function(e) {
		switch (e.keyIdentifier) {
		case "Up":
			return game.renderer.move(0, -5);
		case "Down":
			return game.renderer.move(0, 5);
		case "Left":
			return game.renderer.move(-5, 0);
		case "Right":
			return game.renderer.move(5, 0);
		}
	});
	game.canvas.addEventListener("mousemove", function(e) {
		if (e.timeStamp > lastover+50) {
			lastover = e.timeStamp;
			game.renderer.over(e.offsetX, e.offsetY);
		}
	});
	game.canvas.addEventListener("mousewheel", function(e) {
		var sign = e.wheelDelta < 0 ? -1 : 1;
		game.renderer.zoom(sign * 0.25, e.offsetX, e.offsetY);
	});
	var dragctx, dragging, drop;
	game.canvas.addEventListener("mousedown", function(e) {
		dragctx = {
			x: e.offsetX,
			y: e.offsetY,
			t: e.timeStamp + 150,
			c: false,
		};
		window.addEventListener("mousemove", dragging);
		window.addEventListener("mouseup", drop);
	});
	dragging = function(e) {
		if (dragctx.t > e.timeStamp) {
			return;
		}
		game.renderer.move(dragctx.x - e.offsetX, dragctx.y - e.offsetY);
		dragctx.x = e.offsetX;
		dragctx.y = e.offsetY;
		dragctx.c = true;
	};
	drop = function(e) {
		if (!dragctx.c) {
			if (e.target == game.canvas) {
				game.renderer.click(e.offsetX, e.offsetY);
			}
		}
		window.removeEventListener("mousemove", dragging);
		window.removeEventListener("mouseup", drop);
	};
	return game;
};
var Layout = function(cont) {
	this.header = document.createElement("header");
	cont.appendChild(this.header);
	this.section = document.createElement("section");
	cont.appendChild(this.section);
};
var UI = function(cont) {
	this.cont = cont;
	this.instructions = document.createElement("div");
	this.cont.appendChild(this.instructions);
};
UI.prototype = {
	instruct: function(msg, args) {
		this.instructions.innerHTML = Array.prototype.join.call(arguments, " ");
	},
};
var Game = function(cont) {
	var layout = new Layout(cont);
	this.map = new Map(2048, 1024);
	this.canvas = document.createElement("canvas");
	this.canvas.width = 750;
	this.canvas.height = 450;
	this.renderer = new Render2d(this.canvas, this.map);
	this.renderer.loadBg("static/world_day.jpg");
	this.state = null;
	var g = this;
	this.map.onclick = function(l, x, y) {
		if (g.state) g.state.clickLayer(l);
	};
	this.ui = new UI(layout.header, this);
	layout.section.appendChild(this.canvas);
	Control(this);
};
Game.prototype = {
	start: function(id) {
		this.map.clear();
		if (id === undefined) {
			new Select(this);
		} else {
			new Quiz(this, id);
		}
	},
	loadMapdata: function(href) {
		var game = this;
		var req = new XMLHttpRequest();
		req.onload = function(e) {
			game.onMapdata(e);
		};
		req.open("GET", "static/gisdata/"+href, true);
		req.send();
	},
	onMapdata: function(e) {
		var data = JSON.parse(e.target.responseText);
		for (var i=0; i < data.Layers.length; i++) {
			this.map.add(data.Layers[i]);
		}
		this.renderer.render();
		this.state.start();
	},
};
new Game(document.body).start();

})();