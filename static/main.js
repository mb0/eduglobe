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
var supports = (function() {
	var r = {canvas:false, webgl: false};
	var c = document.createElement("canvas"),ctx;
	if (!!c.getContext) {
		try {
			ctx = c.getContext("experimental-webgl");
			if (!!ctx) {
				r.webgl = r.canvas = true;
				return r;
			}
			ctx = c.getContext("2d");
			r.canvas = !!ctx;
		} catch(e){}
	}
	return r;
})();
window.requestAnimationFrame = (function() {
  return window.requestAnimationFrame ||
         window.webkitRequestAnimationFrame ||
         window.mozRequestAnimationFrame ||
         window.oRequestAnimationFrame ||
         window.msRequestAnimationFrame ||
         function(callback) {
           window.setTimeout(callback, 1000/60);
         };
})();

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
	this.bg = new Image();
	this.layers = [];
	this.onclick = null;
};

Map.prototype = {
	loadBg: function(href) {
		this.bg.src = href;
	},
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
	draw: function(ctx) {
		if (this.bg.width) {
			ctx.drawImage(this.bg, 0, 0);
		}
		ctx.lineWidth = 0.4;
		ctx.strokeStyle = "#FF0000";
		ctx.fillStyle = "rgba(60,60,60,.2)";
		for (var i=0; i < this.layers.length; i++) {
			var l = this.layers[i];
			var over = l == this.overlayer;
			if (over) {
				ctx.fillStyle = "rgba(255,255,255,.3)";
			}
			ctx.beginPath();
			for (var j=0; j < l.mpoly.length; j++) {
				l.mpoly[j].draw(ctx);
			}
			ctx.fill();
			ctx.stroke();
			if (over) {
				ctx.fillStyle = "rgba(60,60,60,.2)";
			}
		}
	},
};

var Render2d = function(canvas, map) {
	this.canvas = canvas;
	this.map = map;
	this.scale = 0.5;
	this.offset = {x: 0, y: 0};
	this.ctx = canvas.getContext("2d");
	this.update = false;
};
Render2d.prototype = {
	dim: 2,
	render: function() {
		if (!this.update) {
			return;
		}
		this.update = false;
		this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
		this.ctx.save();
		this.ctx.scale(this.scale, this.scale);
		this.ctx.translate(-this.offset.x, -this.offset.y);
		this.map.draw(this.ctx);
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
		this.update =  this.update || changed;
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
		this.update = true;
	},
};

var Render3d = function(canvas, map) {
	this.canvas = canvas;
	this.map = map;
	this.update = false;
	this.canvas2d = document.createElement("canvas");
	this.canvas2d.width = map.w;
	this.canvas2d.height = map.h;
	this.ctx = this.canvas2d.getContext("2d");
	this.gl = this.initGl(this.canvas);
	this.prog = this.initProg(this.gl);
	this.initBuffers(this.gl);
	this.tx = this.gl.createTexture();
	this.tx.image = this.canvas2d;
	this.pMatrix = mat4.create();
	this.mvMatrix = mat4.create();
	this.nMatrix = mat3.create();
	mat4.perspective(this.pMatrix, 45, canvas.width / canvas.height, 0.1, 100.0);
	this.cam = [0, 0, 2.25]; // rotx, roty in deg and distance
};
Render3d.prototype = {
	dim: 3,
	initGl: function(canvas) {
		var gl = canvas.getContext("experimental-webgl");
		gl.viewportWidth = canvas.width;
		gl.viewportHeight = canvas.height;
		gl.enable(gl.DEPTH_TEST);
		gl.clearColor(1.0, 1.0, 1.0, 1.0);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		return gl;
	},
	initProg: function(gl) {
		var prog = gl.createProgram();
		function initShader(type, src) {
			var shader = gl.createShader(type);
			gl.shaderSource(shader, src);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error("shader error "+ type +" "+ gl.getShaderInfoLog(shader));
			}
			gl.attachShader(prog, shader);
		}
		initShader(gl.VERTEX_SHADER, [
			"attribute vec2 uv;",
			"attribute vec3 position;",
			"attribute vec3 normal;",
			"uniform mat4 modelViewMatrix;",
			"uniform mat4 projectionMatrix;",
			"uniform mat3 normalMatrix;",
			"varying vec2 vUv;",
			"varying vec3 vNormal;",
			"void main() {",
			"	vUv = uv;",
			'	vNormal = normalize(normalMatrix * normal);',
			"	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
			"}",
		].join("\n"));
		initShader(gl.FRAGMENT_SHADER, [
			"precision mediump float;",
			"uniform sampler2D texture;",
			"varying vec2 vUv;",
			"varying vec3 vNormal;",
			"void main() {",
			"	vec3 diffuse = texture2D(texture, vUv).xyz;",
			"	float intensity = 1.05 - dot(vNormal, vec3(0.0, 0.0, 1.0));",
			"	vec3 atmosphere = vec3(1.0, 1.0, 1.0) * pow(intensity, 3.0);",
			"	gl_FragColor = vec4(atmosphere + diffuse, 1.0);",
			"}",
		].join("\n"));
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			throw new Error("could not link webgl program");
		}
		gl.useProgram(prog);
		prog.uv = gl.getAttribLocation(prog, "uv");
		gl.enableVertexAttribArray(prog.uv);
		prog.position = gl.getAttribLocation(prog, "position");
		gl.enableVertexAttribArray(prog.position);
		prog.normal = gl.getAttribLocation(prog, "normal");
		gl.enableVertexAttribArray(prog.normal);
		prog.modelViewMatrix = gl.getUniformLocation(prog, "modelViewMatrix");
		prog.projectionMatrix = gl.getUniformLocation(prog, "projectionMatrix");
		prog.normalMatrix = gl.getUniformLocation(prog, "normalMatrix");
		prog.texture = gl.getUniformLocation(prog, "texture");
		return prog;
	},
	initBuffers: function(gl) {
		var lat, latn = 30;
		var lon, lonn = 30;
		var radius = 1;
		var positionData = [];
		var normalData = [];
		var textureData = [];
		for (lat=0; lat <= latn; lat++) {
			var theta = lat * Math.PI / latn;
			var sint = Math.sin(theta);
			var cost = Math.cos(theta);
			for (lon=0; lon <= lonn; lon++) {
				var phi = lon * 2 * Math.PI / lonn;
				phi = (phi-Math.PI/2) % (2*Math.PI);
				var x = Math.cos(phi) * sint;
				var y = cost;
				var z = Math.sin(phi) * sint;
				normalData.push(x, y, z);
				positionData.push(radius * x, radius * y, radius * z);
				textureData.push(1 - (lon / lonn), 1 - (lat / latn));
			}
		}
		var indexData = [];
		for (lat=0; lat < latn; lat++) {
			for (lon=0; lon < lonn; lon++) {
				var first = lat *(lonn +1) + lon;
				var second = first + lonn +1;
				indexData.push(first, second, first+1);
				indexData.push(second, second+1, first+1);
			}
		}
		
		this.normalBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalData), gl.STATIC_DRAW);
		this.normalBuffer.itemSize = 3;
		this.normalBuffer.numItems = normalData.length / 3;
		
		this.positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positionData), gl.STATIC_DRAW);
		this.positionBuffer.itemSize = 3;
		this.positionBuffer.numItems = positionData.length / 3;
		
		this.textureBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureData), gl.STATIC_DRAW);
		this.textureBuffer.itemSize = 2;
		this.textureBuffer.numItems = textureData.length / 2;
		
		this.indexBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);
		this.indexBuffer.itemSize = 1;
		this.indexBuffer.numItems = indexData.length;
		
	},
	initTexture: function(gl) {
		gl.bindTexture(gl.TEXTURE_2D, this.tx);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.tx.image);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);
	},
	render: function() {
		if (!this.update) {
			return;
		}
		this.update = false;
		
		this.ctx.save();
		this.map.draw(this.ctx);
		this.ctx.restore();
		this.initTexture(this.gl);
		
		var gl = this.gl;
		
		gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.tx);
		gl.uniform1i(this.prog.texture, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.vertexAttribPointer(this.prog.position, this.positionBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.textureBuffer);
		gl.vertexAttribPointer(this.prog.uv, this.textureBuffer.itemSize, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.vertexAttribPointer(this.prog.normal, this.normalBuffer.itemSize, gl.FLOAT, false, 0, 0);
		
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
		
		gl.uniformMatrix4fv(this.prog.projectionMatrix, false, this.pMatrix);
		gl.uniformMatrix4fv(this.prog.modelViewMatrix, false, this.calcMv());
		mat3.fromMat4(this.nMatrix, this.mvMatrix);
		mat3.invert(this.nMatrix, this.nMatrix);
		mat3.transpose(this.nMatrix, this.nMatrix);
		gl.uniformMatrix3fv(this.prog.normalMatrix, false, this.nMatrix);
		
		gl.drawElements(gl.TRIANGLES, this.indexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
	},
	calcMv: function() {
		this.mvMatrix = mat4.create();
		mat4.identity(this.mvMatrix);
		mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, -this.cam[2]]);
		mat4.rotate(this.mvMatrix, this.mvMatrix, this.cam[0]*Math.PI/180, [1, 0, 0]);
		mat4.rotate(this.mvMatrix, this.mvMatrix, this.cam[1]*Math.PI/180, [0, 1, 0]);
		return this.mvMatrix;
	},
	move: function(dx, dy) {
		this.cam[1] = (this.cam[1]+360+dx*(this.cam[2]/-30))%360;
		this.cam[0] = Math.max(-65, Math.min(65, this.cam[0]+dy*(this.cam[2]/-30)));
		this.update = true;
	},
	unproject: function(x, y, z, pmvi) {
		var dest = [x*2/this.gl.viewportWidth-1, -y*2/this.gl.viewportHeight+1, z*2-1, 1.0];
		vec4.transformMat4(dest, dest, pmvi);
		if (!dest[3]) return null;
		vec3.scale(dest, dest, 1/dest[3]);
		return dest;
	},
	traceDist: function(orig, dir) {
		var c = vec3.create();
		vec3.scale(c, orig, -1);
		var pc = vec3.dot(dir, c);
		var cc = vec3.dot(c, c);
		var val = pc*pc - cc + 1;
		if (val < 0) {
			return null;
		}
		val = Math.sqrt(val);
		return Math.min(pc+val, pc-val);
	},
	mouseToMap: function(x, y) {
		var pmvi = mat4.create();
		mat4.multiply(pmvi, this.pMatrix, this.calcMv());
		mat4.invert(pmvi, pmvi);
		var orig = this.unproject(x, y, 1, pmvi);
		var dest = this.unproject(x, y, 0, pmvi);
		if (orig === null || dest === null) {
			return null;
		}
		var dir = vec3.create();
		vec3.subtract(dir, orig, dest);
		vec3.normalize(dir, dir);
		var dist = this.traceDist(orig, dir);
		if (dist === null) {
			return null;
		}
		var p = vec3.create();
		vec3.add(p, orig, vec3.scale(dest, dir, dist));
		var lon = Math.asin(p[0] / Math.sqrt(1 - p[1] * p[1])) * 180/ Math.PI;
		if (p[2] < -0.01) lon = 180 - lon;
		if (lon > 180) lon -= 360;
		var lat = Math.asin(p[1]) * 180 / Math.PI;
		return [((lon+180)/360)*this.map.w, ((-lat+90)/180)*this.map.h];
	},
	click: function(ox, oy) {
		var m = this.mouseToMap(ox, oy);
		if (m === null) {
			return;
		}
		this.map.click(m[0], m[1]);
	},
	over: function(ox, oy) {
		var m = this.mouseToMap(ox, oy);
		if (m === null) {
			return;
		}
		var changed = this.map.over(m[0], m[1]);
		this.update =  this.update || changed;
	},
	zoom: function(delta, ox, oy) {
		this.cam[2] = Math.max(1.25, Math.min(2.5, this.cam[2]-delta));
		this.update = true;
	},
};

var Select = function(game) {
	this.game = game;
	this.game.state = this;
	this.game.loadMapdata("region.json");
};
Select.prototype = {
	start: function() {
		// filter antarctic
		var layers = this.game.map.layers;
		for (var i=0; i<layers.length; i++) {
			if (layers[i].id === "0") {
				layers.splice(i, 1);
				break;
			}
		}
		this.game.ui.instruct("select a region to start the quiz.");
	},
	clickLayer: function(l) {
		if (l.id === "0") return;
		this.game.start(l.id);
		this.game.ui.report(l.name, "quiz started!");
	},
};
var Quiz = function(game, id) {
	this.game = game;
	this.game.state = this;
	this.id = id;
	this.game.loadMapdata("country_"+ id +".json");
	this.rounds = 0;
	this.errors = 0;
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
		this.rounds = this.layers.length;
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
				this.game.renderer.update = true;
			}
			if (this.layers.length > 0) {
				this.game.ui.report("correct!", "--", this.report());
				this.game.ui.instruct("find", this.layers[0].name);
			} else {
				var sec = ((Date.now() - this.startTime)/1000)|0;
				this.game.ui.report("congratulations! you won after "+ sec +"s with "+ this.errors +" errors.");
				this.game.start();
			}
		} else { // fail
			this.errors++;
			this.game.ui.report("sorry you clicked on", l.name, "--", this.report());
		}
	},
	report: function() {
		var round = this.rounds-this.layers.length+1;
		var sec = ((Date.now() - this.startTime)/1000)|0;
		return "round "+ round +"/"+ this.rounds + " after "+ sec +"s with "+ this.errors +" errors";
	},
};
var Control = function(game) {
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
		game.renderer.over(e.offsetX, e.offsetY);
	});
	game.canvas.addEventListener("mousewheel", function(e) {
		e.preventDefault();
		var sign = e.wheelDelta < 0 ? -1 : 1;
		game.renderer.zoom(sign * 0.25, e.offsetX, e.offsetY);
	});
	var dragctx, drag, dragging, drop;
	setxy = function(e, ctx) {
		var t = e;
		if (e.targetTouches && e.targetTouches.length) {
			t = e.targetTouches[0];
		} else if (e.changedTouches && e.changedTouches.length) {
			t = e.changedTouches[0];
		}
		ctx.x = t.clientX;
		ctx.y = t.clientY;
	};
	getdist = function(e) {
		var dx = e.touches[0].clientX-e.touches[1].clientX;
		var dy = e.touches[0].clientY-e.touches[1].clientY;
		return dx * dx + dy * dy;
	};
	drag = function(e) {
		e.preventDefault();
		dragctx = { t: e.timeStamp + 150, c: false, pinch: false};
		setxy(e, dragctx);
		if (e.touches && e.touches.length > 1) {
			dragctx.pinch = true;
			dragctx.dist = getdist(e);
		}
		window.addEventListener("mousemove", dragging);
		window.addEventListener("touchmove", dragging);
		window.addEventListener("mouseup", drop);
		window.addEventListener("touchend", drop);
	};
	dragging = function(e) {
		if (!dragctx.pinch && dragctx.t > e.timeStamp) {
			return;
		}
		if (dragctx.pinch) {
			var dist = getdist(e);
			var sign = dist < dragctx.dist ? -1 : 1;
			game.renderer.zoom(sign * 0.01, dragctx.x, dragctx.y);
		} else {
			var x = dragctx.x, y = dragctx.y;
			setxy(e, dragctx);
			game.renderer.move(x - dragctx.x, y - dragctx.y);
			dragctx.c = true;
		}
	};
	drop = function(e) {
		e.preventDefault();
		if (!dragctx.pinch && !dragctx.c) {
			setxy(e, dragctx);
			if (e.target == game.canvas) {
				game.renderer.click(dragctx.x, dragctx.y);
			}
		}
		window.removeEventListener("mousemove", dragging);
		window.removeEventListener("touchmove", dragging);
		window.removeEventListener("mouseup", drop);
		window.removeEventListener("touchend", drop);
	};
	game.canvas.addEventListener("mousedown", drag);
	game.canvas.addEventListener("touchstart", drag);
	return game;
};
var Layout = function(cont) {
	this.header = document.createElement("header");
	cont.appendChild(this.header);
	this.section = document.createElement("section");
	cont.appendChild(this.section);
};
var UI = function(cont, game) {
	this.cont = cont;
	this.reports = document.createElement("div");
	this.cont.appendChild(this.reports);
	this.instructions = document.createElement("div");
	this.cont.appendChild(this.instructions);
	this.report("welcome to eduglobe!");
	this.controls = document.createElement("div");
	this.cont.appendChild(this.controls);
	if (supports.webgl === true) {
		var changeRenderer = document.createElement("button");
		changeRenderer.innerHTML = "change to " +(game.renderer.dim > 2 ? "2d" : "3d");
		changeRenderer.addEventListener("click", function() {
			changeRenderer.innerHTML = "change to "+ (game.renderer.dim > 2 ? "3d" : "2d");
			game.init(game.renderer.dim > 2 ? Render2d : Render3d);
		});
		this.controls.appendChild(changeRenderer);
	}
};
UI.prototype = {
	instruct: function(msgs) {
		this.instructions.innerHTML = Array.prototype.join.call(arguments, " ");
	},
	report: function(msgs) {
		this.reports.innerHTML = Array.prototype.join.call(arguments, " ");
	},
};
var Game = function(cont) {
	this.layout = new Layout(cont);
	this.map = new Map(2048, 1024);
	this.canvas = null;
	this.renderer = null;
	this.state = null;
	this.init(Render2d);
	var g = this;
	this.map.loadBg("static/world_day.jpg");
	this.map.bg.onload = function() {
		g.renderer.update = true;
	};
	this.map.onclick = function(l, x, y) {
		if (g.state) g.state.clickLayer(l);
	};
	this.ui = new UI(this.layout.header, this);
	(function tick() {
		window.requestAnimationFrame(tick);
		if (g.renderer !== null) {
			g.renderer.render();
		}
	})();
};
Game.prototype = {
	init: function(rendererType) {
		if (this.canvas !== null) {
			this.layout.section.removeChild(this.canvas);
		}
		this.canvas = document.createElement("canvas");
		this.canvas.width = 800;
		this.canvas.height = 500;
		this.layout.section.appendChild(this.canvas);
		this.renderer = new rendererType(this.canvas, this.map);
		Control(this);
		this.renderer.update = true;
	},
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
		this.state.start();
		this.renderer.update = true;
	},
};
new Game(document.body).start();

})();