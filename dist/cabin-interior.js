import * as THREE from "./vendor/three.module.js";
import { Box3, BufferGeometry, ClampToEdgeWrapping, DataTexture, DoubleSide, EquirectangularReflectionMapping, Float32BufferAttribute, FloatType, InstancedBufferAttribute, LinearFilter, LinearMipmapLinearFilter, LinearSRGBColorSpace, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, RGBAFormat, Raycaster, SRGBColorSpace, Shape, ShapeGeometry, SphereGeometry, Texture, Vector3, Vector4 } from "./vendor/three.module.js";
import { GLTFLoader } from "./vendor/addons/loaders/GLTFLoader.js";
import { createGardenNavigation } from "./garden-navigation.js";
//#region src/scenes/cabin/cabinGeometry.ts
/** A shared 44-triangle joinery block. The bevel catches light instead of relying on painted edges. */
function createJoineryBlock(bevel = .035) {
	const c = .5 - Math.max(.005, Math.min(.12, bevel));
	const positions = [], normals = [], uvs = [];
	function polygon(points) {
		const a = new Vector3(...points[0]);
		const n = new Vector3(...points[1]).sub(a).cross(new Vector3(...points[2]).sub(a)).normalize();
		const centre = new Vector3();
		for (const p of points) centre.add(new Vector3(...p));
		if (n.dot(centre) < 0) {
			points = [...points].reverse();
			n.negate();
		}
		for (let i = 1; i < points.length - 1; i++) for (const p of [
			points[0],
			points[i],
			points[i + 1]
		]) {
			positions.push(...p);
			normals.push(n.x, n.y, n.z);
			const axis = Math.abs(n.x) >= Math.abs(n.y) && Math.abs(n.x) >= Math.abs(n.z) ? 0 : Math.abs(n.y) >= Math.abs(n.z) ? 1 : 2;
			uvs.push(p[axis === 0 ? 2 : 0] + .5, p[axis === 1 ? 2 : 1] + .5);
		}
	}
	for (let axis = 0; axis < 3; axis++) for (const sign of [-1, 1]) {
		const other = [
			0,
			1,
			2
		].filter((v) => v !== axis);
		polygon([
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1]
		].map(([u, v]) => {
			const p = [
				0,
				0,
				0
			];
			p[axis] = sign * .5;
			p[other[0]] = u * c;
			p[other[1]] = v * c;
			return p;
		}));
	}
	for (let along = 0; along < 3; along++) for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
		const [a, b] = [
			0,
			1,
			2
		].filter((v) => v !== along);
		polygon([
			[
				-c,
				.5,
				c
			],
			[
				c,
				.5,
				c
			],
			[
				c,
				c,
				.5
			],
			[
				-c,
				c,
				.5
			]
		].map(([length, u, v]) => {
			const p = [
				0,
				0,
				0
			];
			p[along] = length;
			p[a] = sa * u;
			p[b] = sb * v;
			return p;
		}));
	}
	for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) polygon([
		[
			x * .5,
			y * c,
			z * c
		],
		[
			x * c,
			y * .5,
			z * c
		],
		[
			x * c,
			y * c,
			z * .5
		]
	]);
	const geometry = new BufferGeometry();
	geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
	geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
	geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return geometry;
}
/** Blunted masonry with uneven corners. Bounds stay within the same unit collision box. */
function createHewnStone(variant = 0) {
	const geometry = createJoineryBlock(.095);
	const p = geometry.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
		const wave = .965 + .028 * Math.sin(x * 7.1 + y * 9.4 + z * 5.7 + variant * 2.3);
		p.setXYZ(i, x * wave, y * (.97 + .018 * Math.sin(x * 8 + z * 6 + variant)), z * wave);
	}
	geometry.computeVertexNormals();
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();
	return geometry;
}
//#endregion
//#region src/scenes/cabin/cabinTextiles.ts
var smooth = (a, b, x) => {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
/** Mattress top is .605. Broad shallow folds stay above it, then drape at the edges. */
function quiltHeight(x, z) {
	return .642 - .24 * smooth(.84, 1.09, Math.abs(x)) - .15 * smooth(.89, 1.07, z) + .005 * Math.sin(x * 3.8 + z * .7) + .003 * Math.cos(z * 3.2);
}
function upward(g) {
	const ix = g.index;
	for (let i = 0; i < ix.count; i += 3) {
		const a = ix.getX(i + 1);
		ix.setX(i + 1, ix.getX(i + 2));
		ix.setX(i + 2, a);
	}
	g.computeVertexNormals();
	return g;
}
function createBedQuilt() {
	const g = new PlaneGeometry(2.18, 2.14, 32, 24), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), z = p.getY(i);
		p.setXYZ(i, x, quiltHeight(x, z), z);
	}
	return upward(g);
}
function createBedTurnover() {
	const g = new PlaneGeometry(2.16, .35, 24, 6), p = g.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i), z = p.getY(i), t = (z + .175) / .35;
		p.setXYZ(i, x, quiltHeight(x, z - .7) + .026 + .012 * Math.sin(Math.PI * t), z);
	}
	return upward(g);
}
/** Two intersecting circular arcs, with shared exact tips and an open inner arc. */
function createBannerCrescent() {
	const r = .19, inner = .175, offset = .09, x = .013575000000000004 / (2 * offset);
	const y = Math.sqrt(r * r - x * x), outerAngle = Math.atan2(y, x), innerAngle = Math.atan2(y, -.01458333333333331);
	const shape = new Shape();
	shape.absarc(0, 0, r, outerAngle, Math.PI * 2 - outerAngle, false);
	shape.absarc(offset, 0, inner, -innerAngle, innerAngle, true);
	shape.closePath();
	const points = shape.getPoints(40).filter((p, i, all) => i === 0 || p.distanceTo(all[i - 1]) > 1e-7);
	if (points[0].distanceTo(points.at(-1)) < 1e-7) points.pop();
	return new ShapeGeometry(new Shape(points), 40);
}
//#endregion
//#region src/scenes/cabin/cabinRugGeometry.ts
/** A real woven surface with a softly irregular circular outline, gentle cloth relief,
* and one continuous UV island. Its border never bends or stretches the motif. */
function rugRadius(a, r = 1.61) {
	return r * (1 + .0016 * Math.sin(a * 5) + .001 * Math.sin(a * 11));
}
function rugClothHeight(x, z) {
	const t = Math.min(1, Math.hypot(x, z) / 1.61), a = Math.atan2(z, x);
	return .034 + .0015 * Math.sin(x * 2.4 + z * .8) * Math.cos(z * 2.1) + .004 * Math.pow(t, 6) * (.5 + .5 * Math.sin(a * 7 + .7));
}
function createRugSurface(radius = 1.61, segments = 96, rings = 7) {
	const positions = [
		0,
		rugClothHeight(0, 0),
		0
	], uv = [.5, .5], indices = [];
	for (let ring = 1; ring <= rings; ring++) for (let i = 0; i <= segments; i++) {
		const a = i / segments * Math.PI * 2, t = ring / rings, r = rugRadius(a, radius) * t, x = Math.cos(a) * r, z = Math.sin(a) * r;
		positions.push(x, rugClothHeight(x, z), z);
		uv.push(.5 + x / (2 * radius * 1.003), .5 - z / (2 * radius * 1.003));
	}
	for (let i = 0; i < segments; i++) indices.push(0, 1 + i + 1, 1 + i);
	for (let ring = 1; ring < rings; ring++) for (let i = 0; i < segments; i++) {
		const a = 1 + (ring - 1) * (segments + 1) + i, b = a + segments + 1;
		indices.push(a, b + 1, b, a, a + 1, b + 1);
	}
	const g = new BufferGeometry();
	g.name = "violet-woven-rug-surface";
	g.setAttribute("position", new Float32BufferAttribute(positions, 3));
	g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
	g.setIndex(indices);
	g.computeVertexNormals();
	return g;
}
/** Thin flexible backing follows the cloth edge, rather than a rigid cylinder. */
function createRugBacking() {
	const p = [], uv = [], ix = [], segments = 96;
	for (let i = 0; i <= segments; i++) {
		const a = i / segments * Math.PI * 2, r = rugRadius(a), x = Math.cos(a) * r, z = Math.sin(a) * r;
		p.push(x, rugClothHeight(x, z) - 5e-4, z, x, .019, z);
		uv.push(i / segments, 1, i / segments, 0);
	}
	for (let i = 0; i < segments; i++) {
		const a = i * 2;
		ix.push(a, a + 3, a + 1, a, a + 2, a + 3);
	}
	const g = new BufferGeometry();
	g.name = "flexible-textile-backing";
	g.setAttribute("position", new Float32BufferAttribute(p, 3));
	g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
	g.setIndex(ix);
	g.computeVertexNormals();
	return g;
}
/** Flat woven fringe strips have the same upward-facing textile surface as
* the rug; tiny cylindrical side faces previously produced a dark dotted rim. */
function createRugTassel() {
	const positions = [], uv = [], indices = [];
	for (let strand = 0; strand < 3; strand++) {
		const x = (strand - 1) * .02, length = .07 + strand % 2 * .008, start = positions.length / 3;
		for (let section = 0; section < 3; section++) {
			const t = section / 2, width = section === 1 ? .018 : .014;
			for (const side of [-1, 1]) {
				positions.push(x * (1 + t * .12) + side * width / 2, -5e-4 * t, length * t);
				uv.push(side < 0 ? 0 : 1, t);
			}
		}
		for (let section = 0; section < 2; section++) {
			const a = start + section * 2;
			indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
		}
	}
	const g = new BufferGeometry();
	g.name = "woven-rug-flat-fringe";
	g.setAttribute("position", new Float32BufferAttribute(positions, 3));
	g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
	g.setIndex(indices);
	g.computeVertexNormals();
	return g;
}
//#endregion
//#region src/scenes/cabin/buildCabinLayout.ts
/** v44 geometry port. Shared buffers and matrices, no Scene/renderer/input/physics. */
function buildCabinLayout() {
	const materials = {}, batches = /* @__PURE__ */ new Map(), geometries = /* @__PURE__ */ new Map(), obstacles = [], lamps = [];
	let category = "architecture", ownerId = null;
	const objects = [], origins = /* @__PURE__ */ new Map(), counters = /* @__PURE__ */ new Map();
	function object(id, name, pivot, parentId = null) {
		if (!origins.has(id)) {
			const parent = parentId ? origins.get(parentId) : [
				0,
				0,
				0
			];
			objects.push({
				id,
				name,
				parentId,
				position: [
					pivot[0] - parent[0],
					pivot[1] - parent[1],
					pivot[2] - parent[2]
				],
				rotationY: 0
			});
			origins.set(id, [...pivot]);
		}
		ownerId = id;
		category = "furniture";
	}
	function prop(kind, name, pivot, draw) {
		const previous = ownerId, previousCategory = category, key = `${previous ?? "decor"}/${kind}`, index = (counters.get(key) ?? 0) + 1;
		counters.set(key, index);
		object(`${key}-${String(index).padStart(3, "0")}`, `${name} ${index}`, pivot, previous);
		try {
			draw();
		} finally {
			ownerId = previous;
			category = previousCategory;
		}
	}
	const mat = (name, color, options = {}) => materials[name] = new THREE.MeshStandardMaterial({
		name,
		color,
		roughness: .86,
		...options
	});
	mat("wood", "#543829", { roughness: .72 });
	mat("plank", "#654733", { roughness: .7 });
	mat("plankLight", "#70503a", { roughness: .73 });
	mat("beam", "#2c2228");
	mat("wall", "#604332", { roughness: .82 });
	mat("stone", "#474249");
	mat("stoneLight", "#655960");
	mat("metal", "#332e3c", {
		metalness: .5,
		roughness: .57
	});
	mat("brass", "#a18450", {
		metalness: .42,
		roughness: .59
	});
	mat("cloth", "#493149");
	mat("clothLight", "#886479");
	mat("bedCloth", "#493149");
	mat("bedLinen", "#886479");
	mat("bannerMoon", "#c5a079", { roughness: .98 });
	mat("rug", "#302539");
	mat("roundRug", "#302539");
	mat("trim", "#958087");
	mat("paper", "#bfb098");
	mat("book", "#49354f");
	mat("rugEdge", "#2a183c", { roughness: 1 });
	mat("rugFringe", "#342045", { roughness: 1 });
	mat("rugFringeLight", "#3b254e", { roughness: 1 });
	mat("bookRed", "#7d4546");
	mat("bookBlue", "#46566f");
	mat("bookGreen", "#435b4b");
	mat("bookOchre", "#8a6946");
	mat("ceramic", "#405456");
	mat("leaf", "#39493e");
	mat("wax", "#d3bc95");
	mat("crystal", "#9a81b6", {
		emissive: "#6d458e",
		emissiveIntensity: .1,
		roughness: .45
	});
	mat("flame", "#ffe6af", {
		emissive: "#ffc16a",
		emissiveIntensity: 1.3,
		roughness: 1
	});
	mat("window", "#637aa6", {
		emissive: "#43568b",
		emissiveIntensity: .25,
		roughness: .8
	});
	mat("soot", "#211e27");
	mat("potion", "#8154b6", {
		emissive: "#9463d4",
		emissiveIntensity: .84,
		metalness: .18,
		roughness: .32
	});
	mat("stitch", "#a98c7c");
	mat("windowMoon", "#bacbff", {
		emissive: "#9aafff",
		emissiveIntensity: .9
	});
	mat("soil", "#261e27");
	mat("leather", "#48302b");
	mat("leatherLight", "#72513b");
	mat("bark", "#453329");
	mat("leafLight", "#687044");
	mat("leafDark", "#283c32");
	mat("herbDry", "#8c7352");
	mat("terracotta", "#89533d");
	materials.bottleGlass = new THREE.MeshPhysicalMaterial({
		name: "bottleGlass",
		color: "#48687b",
		roughness: .22,
		clearcoat: .72,
		clearcoatRoughness: .18
	});
	materials.bottleGlassGreen = new THREE.MeshPhysicalMaterial({
		name: "bottleGlassGreen",
		color: "#426258",
		roughness: .24,
		clearcoat: .65,
		clearcoatRoughness: .2
	});
	const get = (key, make) => {
		if (!geometries.has(key)) geometries.set(key, make());
		return geometries.get(key);
	};
	const box = get("box", () => new THREE.BoxGeometry(1, 1, 1));
	const joinery = get("joinery", () => createJoineryBlock());
	const masonry = [
		0,
		1,
		2
	].map((i) => get(`hewn-stone-${i}`, () => createHewnStone(i)));
	const cylinder = get("cylinder", () => new THREE.CylinderGeometry(1, 1, 1, 10));
	const sphere = get("orb", () => new THREE.IcosahedronGeometry(1, 1));
	const cone = get("cone", () => new THREE.ConeGeometry(1, 1, 8));
	const leaf = get("leaf", () => {
		const p = [
			0,
			.5,
			0,
			-.4,
			.17,
			0,
			-.35,
			-.23,
			0,
			0,
			-.5,
			0,
			.35,
			-.23,
			0,
			.4,
			.17,
			0,
			0,
			0,
			.12,
			0,
			0,
			-.035
		], indices = [];
		for (let i = 0; i < 6; i++) {
			const j = (i + 1) % 6;
			indices.push(6, i, j, 7, j, i);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
		g.setIndex(indices);
		g.computeVertexNormals();
		return g;
	});
	const softBox = get("soft-box", () => {
		const g = new THREE.BoxGeometry(1, 1, 1, 4, 2, 4), p = g.attributes.position, v = new THREE.Vector3(), inner = new THREE.Vector3();
		for (let i = 0; i < p.count; i++) {
			v.fromBufferAttribute(p, i);
			inner.copy(v).clampScalar(-.4, .4);
			v.sub(inner).normalize().multiplyScalar(.1).add(inner);
			p.setXYZ(i, v.x, v.y, v.z);
		}
		g.computeVertexNormals();
		return g;
	});
	const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Euler(), quaternion = new THREE.Quaternion();
	function add(g, m, p, s = [
		1,
		1,
		1
	], r = [
		0,
		0,
		0
	], shadow = true) {
		if (category === "furniture" && !ownerId) {
			prop("detail", "Objeto decorativo", p, () => add(g, m, p, s, r, shadow));
			return;
		}
		const key = category + g.uuid + m.uuid + shadow;
		if (!batches.has(key)) batches.set(key, {
			key,
			category,
			g,
			m,
			shadow,
			matrices: [],
			ownerIds: []
		});
		quaternion.setFromEuler(rotation.set(...r));
		matrix.compose(position.set(...p), quaternion, scale.set(...s));
		batches.get(key).matrices.push(matrix.clone());
		batches.get(key).ownerIds.push(category === "furniture" ? ownerId : null);
	}
	function block(m, p, s, r = [
		0,
		0,
		0
	]) {
		const size = Math.min(...s), timber = [
			"wood",
			"plank",
			"plankLight",
			"beam",
			"wall",
			"book",
			"bookRed",
			"bookBlue",
			"bookGreen",
			"bookOchre",
			"leather",
			"leatherLight"
		].includes(m);
		const stone = m === "stone" || m === "stoneLight";
		const index = Math.abs(Math.round(p[0] * 11 + p[1] * 23 + p[2] * 17)) % 3;
		add(stone && size > .1 ? masonry[index] : timber && size > .035 ? joinery : box, materials[m], p, s, r);
	}
	function round(m, p, r, h) {
		add(m === "rug" ? get("rug-disc", () => new THREE.CylinderGeometry(1, 1, 1, 48)) : cylinder, materials[m], p, [
			r,
			h,
			r
		]);
	}
	function solid(name, p, s) {
		obstacles.push({
			kind: "box",
			name,
			position: p,
			size: s
		});
	}
	function stroke(m, a, b, w = .012) {
		const d = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
		quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
		const e = new THREE.Euler().setFromQuaternion(quaternion);
		block(m, [
			(a[0] + b[0]) / 2,
			(a[1] + b[1]) / 2,
			(a[2] + b[2]) / 2
		], [
			w,
			d.length(),
			w
		], [
			e.x,
			e.y,
			e.z
		]);
	}
	function candle(x, y, z, height = .23) {
		return prop("candle", "Vela", [
			x,
			y,
			z
		], () => {
			round("brass", [
				x,
				y + .023,
				z
			], .105, .035);
			round("wax", [
				x,
				y + height / 2 + .04,
				z
			], .047, height);
			add(sphere, materials.flame, [
				x,
				y + height + .085,
				z
			], [
				.025,
				.061,
				.025
			], [
				0,
				0,
				.12
			], false);
		});
	}
	function bottle(x, y, z, index = 0) {
		return prop("bottle", "Frasco", [
			x,
			y,
			z
		], () => {
			const m = index % 2 ? "bottleGlassGreen" : "bottleGlass";
			add(get("potion-bottle", () => new THREE.LatheGeometry([
				[0, 0],
				[.06, 0],
				[.076, .018],
				[.078, .14],
				[.068, .19],
				[.034, .225],
				[.034, .26],
				[.043, .266],
				[.043, .278],
				[.026, .278],
				[.026, .22]
			].map((v) => new THREE.Vector2(v[0], v[1])), 12)), materials[m], [
				x,
				y,
				z
			]);
			round("wood", [
				x,
				y + .298,
				z
			], .038, .034);
			block("brass", [
				x,
				y + .12,
				z + .075
			], [
				.07,
				.065,
				.006
			]);
		});
	}
	function crystal(x, y, z, h = .28) {
		return prop("crystal", "Cristal", [
			x,
			y,
			z
		], () => {
			add(cone, materials.crystal, [
				x,
				y + h * .65,
				z
			], [
				h * .24,
				h * .75,
				h * .24
			], [
				0,
				.3,
				.15
			]);
			add(cylinder, materials.crystal, [
				x,
				y + h * .28,
				z
			], [
				h * .23,
				h * .43,
				h * .23
			], [
				0,
				.3,
				.15
			]);
		});
	}
	function book(x, y, z, h = .28, w = .1, material = "book", lean = 0) {
		return prop("book", "Livro", [
			x,
			y,
			z
		], () => {
			block(material, [
				x,
				y + h / 2,
				z
			], [
				w,
				h,
				.22
			], [
				0,
				0,
				lean
			]);
			block("paper", [
				x,
				y + h / 2,
				z + .045
			], [
				w * .72,
				h * .87,
				.135
			], [
				0,
				0,
				lean
			]);
			block(material, [
				x,
				y + h / 2,
				z + .119
			], [
				w,
				h,
				.012
			], [
				0,
				0,
				lean
			]);
			block("brass", [
				x,
				y + h * .72,
				z + .128
			], [
				w * .78,
				.013,
				.009
			], [
				0,
				0,
				lean
			]);
			for (const t of [.16, .84]) block("leatherLight", [
				x,
				y + h * t,
				z + .13
			], [
				w * .94,
				.018,
				.013
			], [
				0,
				0,
				lean
			]);
			block("brass", [
				x,
				y + h * .47,
				z + .133
			], [
				w * .46,
				h * .15,
				.005
			], [
				0,
				0,
				lean
			]);
		});
	}
	function plant(x, y, z, s = .45) {
		return prop("plant", "Planta", [
			x,
			y,
			z
		], () => {
			round("terracotta", [
				x,
				y + .1 * s,
				z
			], .19 * s, .2 * s);
			round("soil", [
				x,
				y + .205 * s,
				z
			], .155 * s, .012);
			for (let i = 0; i < 9; i++) {
				const a = i * 2.39996, h = (.4 + i % 3 * .07) * s;
				stroke("leaf", [
					x,
					y + .16 * s,
					z
				], [
					x + Math.sin(a) * .19 * s,
					y + h,
					z + Math.cos(a) * .19 * s
				], .014 * s);
				add(leaf, materials[[
					"leaf",
					"leafLight",
					"leafDark"
				][i % 3]], [
					x + Math.sin(a) * .19 * s,
					y + h,
					z + Math.cos(a) * .19 * s
				], [
					.24 * s,
					.36 * s,
					.28 * s
				], [
					.45,
					a,
					.45
				]);
			}
		});
	}
	function pile(x, y, z, count = 3) {
		return prop("book-stack", "Pilha de livros", [
			x,
			y,
			z
		], () => {
			for (let i = 0; i < count; i++) {
				const a = (i % 3 - 1) * .09, m = [
					"bookRed",
					"book",
					"bookBlue"
				][i % 3];
				block(m, [
					x,
					y + .045 + i * .086,
					z
				], [
					.32 + i % 2 * .035,
					.079,
					.24
				], [
					0,
					a,
					0
				]);
				block("paper", [
					x,
					y + .045 + i * .086,
					z + .127
				], [
					.275,
					.041,
					.013
				], [
					0,
					a,
					0
				]);
			}
		});
	}
	function ivy(x, y, z, length = .85, side = false) {
		return prop("ivy", "Hera", [
			x,
			y,
			z
		], () => {
			for (let i = 0; i < 7; i++) {
				const t = i / 6, sway = Math.sin(i * 1.7) * .06, px = x + (side ? 0 : sway), pz = z + (side ? sway : 0), py = y - length * t;
				if (i) stroke("leaf", [
					x + (side ? 0 : Math.sin((i - 1) * 1.7) * .06),
					y - length * (i - 1) / 6,
					z + (side ? Math.sin((i - 1) * 1.7) * .06 : 0)
				], [
					px,
					py,
					pz
				], .009);
				for (const sign of [-1, 1]) add(leaf, materials[i % 3 ? "leaf" : "leafLight"], [
					px + (side ? .07 : sign * .075),
					py - .022,
					pz + (side ? sign * .075 : .07)
				], [
					.19,
					.24,
					.22
				], [
					.18,
					side ? Math.PI / 2 : 0,
					sign * .48
				]);
			}
		});
	}
	function lamp(id, name, x, y, z, level = 5, phase = 0, lightAt = null) {
		const previous = ownerId, previousCategory = category;
		object(id, name, [
			x,
			y,
			z
		]);
		try {
			round("brass", [
				x,
				y - .25,
				z
			], .17, .04);
			for (const side of [-1, 1]) for (const depth of [-1, 1]) block("metal", [
				x + side * .12,
				y,
				z + depth * .12
			], [
				.023,
				.48,
				.023
			]);
			add(cone, materials.metal, [
				x,
				y + .32,
				z
			], [
				.25,
				.2,
				.25
			]);
			candle(x, y - .25, z, .22);
			if (!level) return;
			lamps.push({
				position: lightAt ?? [
					x,
					y,
					z
				],
				level,
				phase
			});
		} finally {
			ownerId = previous;
			category = previousCategory;
		}
	}
	block("beam", [
		0,
		-.11,
		0
	], [
		10.4,
		.22,
		8.4
	]);
	for (let row = 0; row < 21; row++) {
		const z = -4 + row * .4, offset = row % 3 * .81;
		const joints = [-5.2];
		for (let x = -2.6 - offset; x < 5.19; x += 2.6) if (x > -5.19) joints.push(x);
		joints.push(5.2);
		for (let col = 0; col < joints.length - 1; col++) {
			const width = joints[col + 1] - joints[col], x = (joints[col + 1] + joints[col]) / 2, m = [
				"wood",
				"plank",
				"plankLight"
			][(row * 7 + col * 5 + Math.floor(row / 3)) % 3];
			block(m, [
				x,
				.014,
				z
			], [
				width - .016,
				.028,
				.385
			]);
			if (row % 3 === 1) for (const side of [-1, 1]) add(cylinder, materials.metal, [
				x + side * (width / 2 - .075),
				.03,
				z + .115
			], [
				.012,
				.003,
				.012
			], [
				0,
				0,
				0
			], false);
		}
	}
	const wallH = 2.95;
	for (let i = 0; i < 24; i++) block("wall", [
		-4.97 + i * .4325,
		wallH / 2,
		-4.21
	], [
		.422,
		wallH,
		.18
	]);
	for (let i = 0; i < 19; i++) block("wall", [
		-5.21,
		wallH / 2,
		-3.99 + i * .4325
	], [
		.18,
		wallH,
		.421
	]);
	block("beam", [
		5.21,
		.22,
		0
	], [
		.2,
		.44,
		8.62
	]);
	block("beam", [
		0,
		-.05,
		4.23
	], [
		10.62,
		.28,
		.18
	]);
	for (const x of [
		-5.18,
		-2.58,
		0,
		2.6,
		5.18
	]) block("beam", [
		x,
		wallH / 2,
		-4.12
	], [
		.17,
		3.1700000000000004,
		.23
	]);
	for (const z of [
		-4.12,
		-1.35,
		1.45,
		4.12
	]) block("beam", [
		-5.12,
		wallH / 2,
		z
	], [
		.23,
		3.1700000000000004,
		.16
	]);
	block("beam", [
		0,
		3.03,
		-4.14
	], [
		10.65,
		.2,
		.29
	]);
	block("beam", [
		-5.14,
		3.03,
		0
	], [
		.29,
		.2,
		8.48
	]);
	block("wood", [
		0,
		.31,
		-4.03
	], [
		10.3,
		.13,
		.11
	]);
	block("wood", [
		-5.03,
		.31,
		0
	], [
		.11,
		.13,
		8.3
	]);
	for (const y of [.64, 2.67]) {
		block("wood", [
			0,
			y,
			-4.075
		], [
			10.3,
			.065,
			.07
		]);
		block("wood", [
			-5.075,
			y,
			0
		], [
			.07,
			.065,
			8.3
		]);
	}
	object("window", "Janela e cortinas", [
		-5.06,
		1.85,
		-1.46
	]);
	block("beam", [
		-5.06,
		1.85,
		-1.46
	], [
		.11,
		1.53,
		1.55
	]);
	block("window", [
		-4.991,
		1.86,
		-1.46
	], [
		.014,
		1.29,
		1.28
	]);
	block("wood", [
		-4.966,
		1.86,
		-1.46
	], [
		.1,
		1.4,
		.073
	]);
	block("wood", [
		-4.96,
		1.86,
		-1.46
	], [
		.1,
		.073,
		1.42
	]);
	block("plank", [
		-4.83,
		1.12,
		-1.46
	], [
		.45,
		.08,
		1.78
	]);
	function drape(key, width, height, amplitude = .035) {
		return get(key, () => {
			const g = new THREE.PlaneGeometry(width, height, 12, 10), p = g.attributes.position;
			for (let i = 0; i < p.count; i++) {
				const x = p.getX(i), y = p.getY(i), t = (height / 2 - y) / height;
				p.setZ(i, Math.sin(x / width * Math.PI * 7) * amplitude * (.35 + t * .65));
				p.setY(i, y - Math.cos(x / width * Math.PI * 4) * t * .035);
			}
			g.computeVertexNormals();
			return g;
		});
	}
	object("curtains", "Cortinas da janela", [
		-4.93,
		1.85,
		-1.46
	], "window");
	for (const z of [-2.14, -.77]) add(drape("curtain", .33, 1.48), materials.cloth, [
		-4.93,
		1.85,
		z
	], [
		1,
		1,
		1
	], [
		0,
		Math.PI / 2,
		0
	]);
	ownerId = null;
	plant(-4.79, 1.16, -1.08, .65);
	category = "furniture";
	const bed = {
		x: -3.7,
		z: -1.08
	};
	object("bed-rug", "Tapete da cama", [
		bed.x,
		0,
		bed.z + .14
	]);
	block("rug", [
		bed.x,
		.031,
		bed.z + .14
	], [
		2.52,
		.006,
		3.45
	]);
	for (const side of [-1, 1]) block("trim", [
		bed.x + side * 1.16,
		.035,
		bed.z + .14
	], [
		.01,
		.001,
		3.22
	]);
	for (const end of [-1, 1]) block("trim", [
		bed.x,
		.035,
		bed.z + .14 + end * 1.6
	], [
		2.32,
		.001,
		.01
	]);
	object("bed", "Cama e tecidos", [
		bed.x,
		0,
		bed.z
	]);
	block("beam", [
		bed.x,
		.3,
		bed.z
	], [
		1.96,
		.24,
		2.64
	]);
	add(softBox, materials.bedLinen, [
		bed.x,
		.51,
		bed.z
	], [
		1.79,
		.19,
		2.47
	]);
	block("beam", [
		bed.x,
		.74,
		bed.z - 1.32
	], [
		2.03,
		.87,
		.14
	]);
	for (let i = 0; i < 5; i++) block(i % 2 ? "wood" : "plank", [
		bed.x - .76 + i * .38,
		.75,
		bed.z - 1.226
	], [
		.35,
		.61,
		.024
	]);
	block("wood", [
		bed.x,
		.38,
		bed.z + 1.33
	], [
		2.03,
		.46,
		.12
	]);
	for (const x of [-1, 1]) for (const z of [-1, 1]) {
		block("beam", [
			bed.x + x * .95,
			.38,
			bed.z + z * 1.29
		], [
			.12,
			.82,
			.12
		]);
		add(sphere, materials.brass, [
			bed.x + x * .95,
			.82,
			bed.z + z * 1.29
		], [
			.067,
			.039,
			.067
		]);
	}
	add(get("quilt", createBedQuilt), materials.bedCloth, [
		bed.x,
		0,
		bed.z + .3
	]);
	add(get("blanket-fold", createBedTurnover), materials.bedLinen, [
		bed.x,
		0,
		bed.z - .4
	]);
	for (const x of [-.43, .43]) add(softBox, materials.bedLinen, [
		bed.x + x,
		.66,
		bed.z - .96
	], [
		.76,
		.21,
		.43
	], [
		.12,
		x * .1,
		x * .06
	]);
	add(softBox, materials.bedCloth, [
		bed.x - .17,
		.7,
		bed.z - .79
	], [
		.35,
		.12,
		.3
	], [
		.1,
		.18,
		0
	]);
	solid("bed", [
		bed.x,
		.54,
		bed.z
	], [
		2.04,
		1.08,
		2.78
	]);
	object("bedside", "Criado-mudo", [
		-4.51,
		0,
		-2.97
	]);
	block("wood", [
		-4.51,
		.42,
		-2.97
	], [
		.62,
		.72,
		.61
	]);
	block("plank", [
		-4.51,
		.82,
		-2.97
	], [
		.69,
		.08,
		.69
	]);
	block("brass", [
		-4.51,
		.59,
		-2.652
	], [
		.09,
		.036,
		.022
	]);
	solid("bedside", [
		-4.51,
		.43,
		-2.97
	], [
		.69,
		.86,
		.69
	]);
	candle(-4.65, .86, -2.9, .25);
	candle(-4.45, .86, -2.83, .17);
	pile(-4.43, .86, -3.12, 2);
	const shelfX = -2.5, shelfZ = -3.66;
	object("bookshelf", "Estante da biblioteca", [
		shelfX,
		0,
		shelfZ
	]);
	block("beam", [
		shelfX,
		1.28,
		shelfZ
	], [
		2,
		2.5,
		.11
	]);
	for (const x of [-.98, .98]) block("wood", [
		shelfX + x,
		1.3,
		-3.48
	], [
		.09,
		2.6,
		.46
	]);
	for (let row = 0; row < 5; row++) {
		const y = .18 + row * .51;
		block("wood", [
			shelfX,
			y,
			-3.5
		], [
			2.06,
			.08,
			.51
		]);
		let cursor = -3.37;
		for (let i = 0; i < 11; i++) {
			if (row === 2 && i >= 7) continue;
			const seed = (row * 19 + i * 13) % 17;
			if (row === 3 && i > 7) {
				if (i === 9) {
					crystal(-1.8599999999999999, y + .06, -3.47, .29);
					crystal(-1.65, y + .06, -3.47, .2);
				}
				continue;
			}
			if (row === 1 && i >= 7) {
				if (i === 7) pile(-1.92, y + .055, -3.5, 3);
				continue;
			}
			const w = .08 + seed % 4 * .022, h = .27 + seed % 6 * .029;
			book(cursor + w / 2, y + .055, -3.49, h, w, [
				"book",
				"bookRed",
				"bookBlue",
				"bookGreen",
				"bookOchre"
			][seed % 5], i === 0 ? -.065 : i === 10 ? .1 : 0);
			cursor += w + .025;
		}
	}
	plant(-3.31, 2.35, -3.49, .83);
	candle(-2, 2.27, -3.48, .21);
	ivy(-3.43, 2.37, -3.34, .95);
	ivy(-1.57, 2.61, -3.4, 1.09);
	solid("bookshelf", [
		shelfX,
		1.3,
		-3.54
	], [
		2.12,
		2.6,
		.62
	]);
	object("library-ladder", "Escada da biblioteca", [
		-2.69,
		0,
		-3.1
	]);
	for (const x of [-.31, .31]) block("plank", [
		-2.69 + x,
		.62,
		-3.1
	], [
		.055,
		1.3,
		.055
	], [
		.1,
		0,
		0
	]);
	for (let i = 0; i < 4; i++) block("wood", [
		-2.69,
		.22 + i * .26,
		-3.04 - i * .026
	], [
		.68,
		.044,
		.05
	]);
	const desk = {
		x: .7,
		z: -3.05
	};
	object("study-desk", "Escrivaninha", [
		desk.x,
		0,
		desk.z
	]);
	add(softBox, materials.plank, [
		desk.x,
		.94,
		desk.z
	], [
		2.7,
		.14,
		.9
	]);
	for (const x of [-1.15, 1.15]) for (const z of [-.33, .33]) block("wood", [
		desk.x + x,
		.45,
		desk.z + z
	], [
		.1,
		.88,
		.1
	]);
	for (const x of [-1, 1]) {
		block("wood", [
			desk.x + x,
			.55,
			desk.z
		], [
			.41,
			.61,
			.71
		]);
		block("beam", [
			desk.x + x,
			.59,
			desk.z + .361
		], [
			.33,
			.25,
			.023
		]);
		block("brass", [
			desk.x + x,
			.59,
			desk.z + .378
		], [
			.06,
			.026,
			.013
		]);
	}
	for (const x of [-1, 1]) {
		for (const side of [-1, 1]) block("plank", [
			desk.x + x + side * .174,
			.56,
			desk.z + .377
		], [
			.035,
			.55,
			.025
		]);
		for (const y of [
			.31,
			.54,
			.81
		]) block("plank", [
			desk.x + x,
			y,
			desk.z + .379
		], [
			.36,
			.025,
			.029
		]);
		block("wood", [
			desk.x + x,
			.405,
			desk.z + .374
		], [
			.29,
			.2,
			.018
		]);
		block("brass", [
			desk.x + x,
			.41,
			desk.z + .395
		], [
			.048,
			.024,
			.018
		]);
	}
	block("leather", [
		desk.x,
		1.018,
		desk.z
	], [
		1.26,
		.016,
		.77
	]);
	object("grimoire", "Grimório aberto", [
		desk.x,
		1.018,
		desk.z + .055
	], "study-desk");
	for (const side of [-1, 1]) {
		block("book", [
			desk.x + side * .235,
			1.065,
			desk.z + .055
		], [
			.46,
			.062,
			.46
		], [
			0,
			0,
			side * -.085
		]);
		block("paper", [
			desk.x + side * .23,
			1.11,
			desk.z + .055
		], [
			.43,
			.02,
			.43
		], [
			0,
			0,
			side * -.085
		]);
	}
	const pageHeight = (x, z) => .015 + .022 * Math.cos(x * 6) + .012 * Math.sin(z * 5);
	const parchment = get("grimoire-page", () => {
		const g = new THREE.PlaneGeometry(.435, .43, 10, 6), p = g.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), z = p.getY(i);
			p.setXYZ(i, x, pageHeight(x, z), z);
		}
		const ix = g.index;
		for (let i = 0; i < ix.count; i += 3) {
			const a = ix.getX(i + 1);
			ix.setX(i + 1, ix.getX(i + 2));
			ix.setX(i + 2, a);
		}
		g.computeVertexNormals();
		return g;
	});
	for (const side of [-1, 1]) {
		add(parchment, materials.paper, [
			desk.x + side * .23,
			1.113,
			desk.z + .055
		], [
			1,
			1,
			1
		], [
			0,
			0,
			side * -.085
		]);
		for (let row = 0; row < 5; row++) {
			const z = -.13 + row * .058, width = .26 - row % 2 * .045, angle = side * -.085;
			const inkPoint = (x) => {
				const y = pageHeight(x, z) + .002;
				return [
					desk.x + side * .23 + Math.cos(angle) * x - Math.sin(angle) * y,
					1.113 + Math.sin(angle) * x + Math.cos(angle) * y,
					desk.z + .055 + z
				];
			};
			for (let segment = 0; segment < 4; segment++) stroke("book", inkPoint(-width / 2 + segment * width / 4), inkPoint(-width / 2 + (segment + 1) * width / 4), .005);
		}
	}
	round("brass", [
		desk.x,
		1.133,
		desk.z + .08
	], .065, .011);
	object("study-desk", "Escrivaninha", [
		desk.x,
		0,
		desk.z
	]);
	for (let i = 0; i < 2; i++) bottle(desk.x - 1.03 + i * .18, 1.013, -3.26, i);
	pile(desk.x - 1.02, 1.013, -2.89, 2);
	crystal(desk.x + .99, 1.013, -3.11, .23);
	candle(desk.x + .79, 1.013, -3.27, .25);
	candle(desk.x + 1.12, 1.013, -2.94, .17);
	object("study-notes", "Pergaminho e pena", [
		desk.x + .47,
		1.02,
		-2.86
	], "study-desk");
	block("paper", [
		desk.x + .47,
		1.027,
		-2.86
	], [
		.22,
		.014,
		.3
	], [
		0,
		-.25,
		0
	]);
	stroke("brass", [
		desk.x + .37,
		1.043,
		-2.76
	], [
		desk.x + .54,
		1.073,
		-3.04
	], .012);
	solid("study-desk", [
		desk.x,
		.52,
		desk.z
	], [
		2.78,
		1.04,
		.98
	]);
	object("study-chair", "Cadeira de estudo", [
		desk.x,
		0,
		-2.22
	]);
	add(softBox, materials.wood, [
		desk.x,
		.45,
		-2.22
	], [
		.54,
		.08,
		.5
	]);
	for (const x of [-.2, .2]) for (const z of [-.18, .18]) block("wood", [
		desk.x + x,
		.22,
		-2.22 + z
	], [
		.05,
		.44,
		.05
	]);
	block("beam", [
		desk.x,
		.7,
		-2.04
	], [
		.5,
		.48,
		.075
	]);
	solid("study-chair", [
		desk.x,
		.48,
		-2.19
	], [
		.61,
		.96,
		.64
	]);
	object("study-desk", "Escrivaninha", [
		desk.x,
		0,
		desk.z
	]);
	plant(desk.x - 1.2, 1.014, -3.31, .48);
	ownerId = null;
	for (const x of [-.5, 2]) {
		object(x < 0 ? "banner-left" : "banner-right", x < 0 ? "Estandarte esquerdo" : "Estandarte direito", [
			x,
			2.09,
			-4.08
		]);
		add(drape("banner", .83, 1.1, .02), materials.cloth, [
			x,
			2.09,
			-4.08
		]);
		block("brass", [
			x,
			2.69,
			-4.025
		], [
			.94,
			.036,
			.03
		]);
	}
	const moon = get("moon", () => {
		const shape = new THREE.Shape();
		shape.absarc(0, 0, .19, .5, Math.PI * 2 - .5, false);
		shape.quadraticCurveTo(-.075, 0, .19 * Math.cos(.5), .19 * Math.sin(.5));
		return new THREE.ShapeGeometry(shape, 18);
	});
	const bannerMoon = get("banner-crescent", createBannerCrescent);
	for (const x of [-.5, 2]) {
		object(x < 0 ? "banner-left" : "banner-right", x < 0 ? "Estandarte esquerdo" : "Estandarte direito", [
			x,
			2.09,
			-4.08
		]);
		add(bannerMoon, materials.bannerMoon, [
			x,
			2.11,
			-4.017
		], [
			1.12,
			1.12,
			1.12
		], [
			0,
			0,
			0
		], false);
	}
	ownerId = null;
	category = "architecture";
	block("stone", [
		4.08,
		.105,
		-3
	], [
		1.48,
		.17,
		1.4
	]);
	block("soot", [
		4.08,
		.58,
		-3.39
	], [
		.95,
		.76,
		.08
	]);
	for (let row = 0; row < 4; row++) for (const side of [-1, 1]) {
		block(row % 2 ? "stoneLight" : "stone", [
			4.08 + side * .57,
			.27 + row * .2,
			-2.99
		], [
			.25,
			.19,
			1.06
		]);
		block("beam", [
			4.08 + side * .57,
			.17 + row * .2,
			-2.456
		], [
			.235,
			.015,
			.012
		]);
	}
	for (let i = 0; i < 7; i++) {
		const a = i * Math.PI / 6;
		block(i % 2 ? "stone" : "stoneLight", [
			4.08 + Math.cos(a) * .43,
			.65 + Math.sin(a) * .3,
			-2.46
		], [
			.22,
			.2,
			.26
		], [
			0,
			0,
			a - Math.PI / 2
		]);
	}
	block("stoneLight", [
		4.08,
		1.15,
		-3
	], [
		1.5,
		.15,
		1.45
	]);
	for (let row = 0; row < 7; row++) for (let col = 0; col < 2; col++) block((row + col) % 3 ? "stone" : "stoneLight", [
		3.89 + col * .38,
		1.39 + row * .245,
		-3.6
	], [
		.367,
		.235,
		.58
	]);
	block("stone", [
		4.08,
		3.075,
		-3.6
	], [
		.92,
		.11,
		.72
	]);
	for (let i = 0; i < 3; i++) add(cylinder, materials.bark, [
		3.84 + i * .18,
		.23,
		-2.88
	], [
		.062,
		.49,
		.062
	], [
		Math.PI / 2,
		.2 - i * .2,
		0
	]);
	for (let i = 0; i < 3; i++) add(cone, materials.flame, [
		3.9 + i * .17,
		.39 + i % 2 * .045,
		-2.83
	], [
		.075,
		.26 + i % 2 * .07,
		.075
	], [
		.06,
		0,
		(i - 1) * .14
	], false);
	object("cauldron", "Caldeirão e poção", [
		4.08,
		1.25,
		-2.81
	]);
	const cauldronProfile = [
		[0, 0],
		[.22, 0],
		[.34, .08],
		[.43, .24],
		[.44, .34],
		[.4, .47],
		[.36, .55],
		[.34, .58],
		[.31, .57],
		[.315, .5],
		[.35, .42],
		[.37, .3],
		[.32, .16],
		[.18, .11],
		[0, .11]
	];
	add(get("cauldron-body", () => new THREE.LatheGeometry(cauldronProfile.map((p) => new THREE.Vector2(p[0], p[1])), 20)), materials.metal, [
		4.08,
		1.27,
		-2.81
	]);
	add(get("cauldron-rim", () => new THREE.TorusGeometry(.347, .045, 6, 24)), materials.metal, [
		4.08,
		1.82,
		-2.81
	], [
		1,
		1,
		1
	], [
		-Math.PI / 2,
		0,
		0
	]);
	const handle = get("cauldron-handle", () => new THREE.TorusGeometry(.13, .026, 6, 16));
	for (const side of [-1, 1]) add(handle, materials.metal, [
		4.08 + side * .445,
		1.61,
		-2.81
	], [
		1,
		1,
		1
	], [
		0,
		Math.PI / 2,
		side * .09
	]);
	for (let i = 0; i < 3; i++) {
		const a = i * Math.PI * 2 / 3;
		block("metal", [
			4.08 + Math.sin(a) * .25,
			1.25,
			-2.81 + Math.cos(a) * .25
		], [
			.085,
			.13,
			.085
		], [
			.08,
			0,
			.08
		]);
	}
	add(get("potion-surface", () => new THREE.CircleGeometry(.309, 32)), materials.potion, [
		4.08,
		1.742,
		-2.81
	], [
		1,
		1,
		1
	], [
		-Math.PI / 2,
		0,
		0
	], false);
	add(get("potion-edge", () => new THREE.TorusGeometry(.3, .008, 4, 32)), materials.potion, [
		4.08,
		1.744,
		-2.81
	], [
		1,
		1,
		1
	], [
		-Math.PI / 2,
		0,
		0
	], false);
	ownerId = null;
	candle(4.63, 1.23, -3.27, .18);
	solid("hearth", [
		4.08,
		.7,
		-3
	], [
		1.55,
		1.4,
		1.5
	]);
	for (const y of [1.46, 2.02]) {
		object(y < 1.5 ? "alchemy-shelf-low" : "alchemy-shelf-high", y < 1.5 ? "Prateleira de alquimia baixa" : "Prateleira de alquimia alta", [
			2.94,
			y,
			-4
		]);
		block("plank", [
			2.94,
			y,
			-4
		], [
			1.05,
			.065,
			.4
		]);
		for (let i = 0; i < 3; i++) bottle(2.57 + i * .3, y + .04, -3.96, i);
	}
	ownerId = null;
	plant(2.83, .037, -3.58, .7);
	ivy(2.42, 2.65, -3.97, 1);
	object("central-rug", "Tapete de meditação", [
		0,
		0,
		.36
	]);
	add(get("round-rug-body", createRugBacking), materials.rugEdge, [
		0,
		0,
		.36
	]);
	add(get("round-rug-surface", createRugSurface), materials.roundRug, [
		0,
		0,
		.36
	]);
	const tassel = get("round-rug-tassel", createRugTassel);
	for (let i = 0; i < 64; i++) {
		const a = i * Math.PI * 2 / 64;
		const r = rugRadius(Math.PI / 2 - a) - .006, x = Math.sin(a) * r, z = Math.cos(a) * r;
		add(tassel, materials[i % 3 ? "rugFringe" : "rugFringeLight"], [
			x,
			rugClothHeight(x, z) + .001,
			.36 + z
		], [
			1,
			1,
			1
		], [
			0,
			a,
			0
		], false);
	}
	object("storage", "Armário de entrada", [
		4.12,
		0,
		2.86
	]);
	block("wood", [
		4.12,
		.43,
		2.86
	], [
		1.48,
		.8,
		.63
	]);
	add(softBox, materials.plank, [
		4.12,
		.87,
		2.86
	], [
		1.59,
		.09,
		.72
	]);
	for (const x of [3.79, 4.45]) block("beam", [
		x,
		.45,
		3.195
	], [
		.6,
		.63,
		.027
	]);
	for (const x of [3.79, 4.45]) {
		block("plank", [
			x,
			.45,
			3.216
		], [
			.48,
			.51,
			.019
		]);
		for (const side of [-1, 1]) block("wood", [
			x + side * .26,
			.45,
			3.234
		], [
			.035,
			.57,
			.033
		]);
		for (const y of [.18, .72]) block("wood", [
			x,
			y,
			3.234
		], [
			.55,
			.033,
			.035
		]);
	}
	for (const x of [4.06, 4.17]) round("brass", [
		x,
		.5,
		3.226
	], .022, .036);
	solid("storage", [
		4.12,
		.46,
		2.86
	], [
		1.65,
		.92,
		.79
	]);
	plant(4.54, .92, 2.8, .9);
	bottle(3.72, .92, 2.85);
	pile(3.96, .92, 2.8, 2);
	object("chest", "Baú", [
		-3.38,
		0,
		1.2
	]);
	block("wood", [
		-3.38,
		.27,
		1.2
	], [
		1.46,
		.48,
		.7
	]);
	add(get("chest-lid", () => {
		const shape = new THREE.Shape();
		shape.moveTo(-.35, 0);
		shape.lineTo(.35, 0);
		shape.absarc(0, 0, .35, 0, Math.PI, false);
		shape.closePath();
		const g = new THREE.ExtrudeGeometry(shape, {
			depth: 1.44,
			steps: 1,
			curveSegments: 12,
			bevelEnabled: true,
			bevelSize: .009,
			bevelThickness: .009,
			bevelSegments: 1
		});
		g.translate(0, 0, -.72);
		g.rotateY(Math.PI / 2);
		return g;
	}), materials.wood, [
		-3.38,
		.5,
		1.2
	]);
	for (const x of [-3.9, -2.88]) add(get("lid-strap", () => new THREE.TorusGeometry(.357, .021, 4, 18, Math.PI)), materials.metal, [
		x,
		.5,
		1.2
	], [
		1,
		1,
		1
	], [
		0,
		Math.PI / 2,
		0
	]);
	for (const x of [-3.9, -2.88]) block("metal", [
		x,
		.28,
		1.563
	], [
		.055,
		.48,
		.018
	]);
	block("brass", [
		-3.38,
		.36,
		1.575
	], [
		.085,
		.08,
		.028
	]);
	solid("chest", [
		-3.38,
		.45,
		1.2
	], [
		1.49,
		.9,
		.79
	]);
	object("reading-chair", "Poltrona e manta", [
		-3.85,
		0,
		2.78
	]);
	block("wood", [
		-3.85,
		.31,
		2.78
	], [
		1.05,
		.22,
		.94
	]);
	add(softBox, materials.cloth, [
		-3.85,
		.46,
		2.78
	], [
		.88,
		.18,
		.76
	]);
	add(softBox, materials.clothLight, [
		-3.85,
		.77,
		2.43
	], [
		.89,
		.62,
		.17
	], [
		.16,
		0,
		0
	]);
	add(softBox, materials.clothLight, [
		-3.78,
		.59,
		2.77
	], [
		.42,
		.17,
		.36
	], [
		0,
		.2,
		.06
	]);
	for (const x of [-4.31, -3.39]) block("wood", [
		x,
		.67,
		2.77
	], [
		.11,
		.43,
		.96
	]);
	for (const x of [-4.26, -3.44]) for (const z of [2.43, 3.11]) block("beam", [
		x,
		.18,
		z
	], [
		.07,
		.35,
		.07
	]);
	add(get("chair-throw", () => {
		const g = new THREE.PlaneGeometry(.59, 1.34, 10, 18), p = g.attributes.position;
		for (let i = 0; i < p.count; i++) {
			const x = p.getX(i), t = (p.getY(i) + .67) / 1.34;
			const y = t < .42 ? .32 + t * .65 : t < .74 ? .593 + (t - .42) * 1.03 : .923 - (t - .74) * .22;
			const z = t < .42 ? 3.22 - t * 1 : t < .74 ? 2.8 - (t - .42) * .9 : 2.512 - (t - .74) * .42;
			p.setXYZ(i, x, y + .018 * Math.sin(x * 24 + t * 2), z);
		}
		g.computeVertexNormals();
		return g;
	}), materials.clothLight, [
		-3.87,
		0,
		0
	]);
	solid("reading-chair", [
		-3.85,
		.6,
		2.78
	], [
		1.15,
		1.2,
		1.05
	]);
	object("side-table", "Mesa lateral", [
		-2.66,
		0,
		2.79
	]);
	round("wood", [
		-2.66,
		.52,
		2.79
	], .36, .09);
	round("beam", [
		-2.66,
		.26,
		2.79
	], .095, .48);
	candle(-2.66, .57, 2.79, .22);
	solid("side-table", [
		-2.66,
		.28,
		2.79
	], [
		.73,
		.56,
		.73
	]);
	ownerId = null;
	category = "architecture";
	block("plank", [
		0,
		.032,
		3.64
	], [
		1.81,
		.035,
		.84
	]);
	for (let i = 0; i < 3; i++) block("beam", [
		0,
		-.16 - i * .11,
		4.28 + i * .23
	], [
		1.96,
		.16,
		.33
	]);
	for (const p of [
		[
			-4.45,
			.032,
			3.72
		],
		[
			4.65,
			.032,
			1.65
		],
		[
			-1.13,
			.035,
			-3.14
		]
	]) plant(p[0], p[1], p[2], .75);
	ivy(-4.95, 2.91, -2.65, 1.16, true);
	ivy(-4.95, 2.62, -.32, .86, true);
	ivy(-4.95, 2.53, 2.89, 1.16, true);
	for (let i = 0; i < 5; i++) {
		const x = 2.56 + i * .15;
		object(`hanging-herbs-${i + 1}`, `Ervas penduradas ${i + 1}`, [
			x,
			2.5,
			-3.96
		]);
		stroke("brass", [
			x,
			2.82,
			-4
		], [
			x,
			2.5,
			-3.96
		], .01);
		for (let j = 0; j < 3; j++) add(leaf, materials[i % 2 ? "herbDry" : "leaf"], [
			x + (j - 1) * .055,
			2.32 - j * .025,
			-3.92
		], [
			.17,
			.38,
			.26
		], [
			0,
			0,
			(j - 1) * .2
		]);
	}
	lamp("lamp-library", "Lamparina da biblioteca", -3.77, 2.22, -2.75, 9, 0);
	lamp("lamp-study", "Lamparina da escrivaninha", .98, 2.26, -3.3, 10, 2.1);
	lamp("lamp-hearth", "Lamparina junto à lareira", 4.65, 1.98, -3.18, 7, 4.5);
	lamp("lamp-entry-left", "Lamparina esquerda da entrada", -1.06, 1.38, 3.85, 6, 1.3, [
		0,
		1.38,
		3.65
	]);
	lamp("lamp-entry-right", "Lamparina direita da entrada", 1.06, 1.38, 3.85, 0);
	category = "architecture";
	for (const x of [
		-4.9,
		-2.4,
		2.4,
		4.9
	]) stroke("wood", [
		x,
		2.53,
		-4
	], [
		x + (x < 0 ? .35 : -.35),
		2.94,
		-4
	], .09);
	for (const z of [
		-3.8,
		1.25,
		3.85
	]) stroke("wood", [
		-5,
		2.48,
		z
	], [
		-5,
		2.94,
		z - .35
	], .08);
	ownerId = null;
	category = "architecture";
	object("floor-cushion", "Almofada de chão", [
		-1.38,
		0,
		1.47
	]);
	add(softBox, materials.clothLight, [
		-1.38,
		.14,
		1.47
	], [
		.62,
		.22,
		.48
	], [
		0,
		.3,
		.045
	]);
	for (let i = 0; i < 5; i++) block("stitch", [
		-1.61 + i * .115,
		.247,
		1.47
	], [
		.012,
		.007,
		.31
	], [
		0,
		.3,
		0
	]);
	object("bed", "Cama e tecidos", [
		bed.x,
		0,
		bed.z
	]);
	add(moon, materials.brass, [
		bed.x,
		.85,
		bed.z - 1.226
	], [
		.6,
		.6,
		.6
	], [
		0,
		0,
		0
	], false);
	const pot = get("herb-pot", () => new THREE.LatheGeometry([
		[0, 0],
		[.12, 0],
		[.18, .08],
		[.2, .22],
		[.19, .27],
		[.21, .29],
		[.21, .32],
		[.16, .32],
		[.16, .27]
	].map((v) => new THREE.Vector2(v[0], v[1])), 12));
	for (const [x, y, z] of [
		[
			-4.22,
			.038,
			3.73
		],
		[
			2.67,
			.038,
			-2.65
		],
		[
			4.54,
			.96,
			2.8
		]
	]) {
		object(`herb-pot-${x}`, "Vaso de ervas", [
			x,
			y,
			z
		], x > 4 ? "storage" : null);
		add(pot, materials.ceramic, [
			x,
			y,
			z
		]);
		round("soil", [
			x,
			y + .285,
			z
		], .15, .012);
	}
	for (const [x, y, z] of [[
		-4.24,
		1.64,
		-3.92
	], [
		2.68,
		2.47,
		-3.91
	]]) {
		object(`wall-shelf-${x}`, "Prateleira decorativa", [
			x,
			y,
			z
		]);
		block("plank", [
			x,
			y,
			z
		], [
			.84,
			.075,
			.42
		]);
		for (const side of [-1, 1]) stroke("brass", [
			x + side * .31,
			y - .22,
			z + .1
		], [
			x + side * .31,
			y - .02,
			z + .16
		], .025);
		bottle(x - .23, y + .04, z + .06, 1);
		bottle(x, y + .04, z + .06, 0);
		candle(x + .23, y + .04, z + .05, .17);
	}
	object("rolled-linen", "Rolos de linho", [
		4.03,
		.91,
		2.75
	], "storage");
	for (let i = 0; i < 3; i++) add(cylinder, materials.clothLight, [
		3.78 + i * .25,
		.91,
		2.75
	], [
		.08,
		.28,
		.08
	], [
		Math.PI / 2,
		0,
		0
	]);
	object("alchemy-bench", "Bancada de alquimia", [
		2.68,
		0,
		-2.65
	]);
	add(softBox, materials.plank, [
		2.68,
		.91,
		-2.65
	], [
		1.15,
		.13,
		1
	]);
	for (const x of [2.22, 3.14]) for (const z of [-3.02, -2.28]) block("wood", [
		x,
		.45,
		z
	], [
		.075,
		.88,
		.075
	]);
	block("wood", [
		2.68,
		.28,
		-2.65
	], [
		1.03,
		.065,
		.86
	]);
	pile(2.35, .32, -2.5, 3);
	bottle(2.92, .32, -2.49, 1);
	bottle(2.85, .98, -2.96, 0);
	bottle(3.06, .98, -2.92, 1);
	object("mortar", "Almofariz e pilão", [
		2.45,
		.98,
		-2.47
	], "alchemy-bench");
	add(get("mortar", () => new THREE.LatheGeometry([
		[0, 0],
		[.1, 0],
		[.17, .08],
		[.18, .17],
		[.16, .19],
		[.12, .16],
		[.08, .07],
		[0, .06]
	].map((v) => new THREE.Vector2(v[0], v[1])), 12)), materials.stone, [
		2.45,
		.98,
		-2.47
	]);
	add(cylinder, materials.wood, [
		2.47,
		1.16,
		-2.45
	], [
		.025,
		.27,
		.025
	], [
		.28,
		0,
		.38
	]);
	object("alchemy-bench", "Bancada de alquimia", [
		2.68,
		0,
		-2.65
	]);
	prop("notes", "Anotações", [
		2.92,
		.986,
		-2.39
	], () => block("paper", [
		2.92,
		.986,
		-2.39
	], [
		.25,
		.012,
		.28
	], [
		0,
		.16,
		0
	]));
	crystal(2.28, .98, -2.94, .2);
	solid("alchemy-bench", [
		2.68,
		.48,
		-2.65
	], [
		1.2,
		.96,
		1.05
	]);
	for (let i = 0; i < 5; i++) {
		object(`hanging-herbs-${i + 1}`, `Ervas penduradas ${i + 1}`, [
			2.56 + i * .15,
			2.5,
			-3.96
		]);
		add(get("herb-ring", () => new THREE.TorusGeometry(.037, .009, 4, 8)), materials.brass, [
			2.56 + i * .15,
			2.84,
			-3.96
		], [
			1,
			1,
			1
		]);
	}
	for (const x of [-.5, 2]) {
		object(x < 0 ? "banner-left" : "banner-right", x < 0 ? "Estandarte esquerdo" : "Estandarte direito", [
			x,
			2.09,
			-4.08
		]);
		for (let i = 0; i < 16; i++) {
			const a = i * Math.PI * 2 / 16, inner = .255, outer = i % 2 ? .3 : .335;
			stroke("stitch", [
				x + Math.sin(a) * inner,
				2.11 + Math.cos(a) * inner,
				-4.007
			], [
				x + Math.sin(a) * outer,
				2.11 + Math.cos(a) * outer,
				-4.007
			], .008);
		}
		for (const side of [-1, 1]) {
			stroke("stitch", [
				x + side * .26,
				1.76,
				-4.005
			], [
				x + side * .26,
				1.84,
				-4.005
			], .01);
			stroke("stitch", [
				x + side * .225,
				1.8,
				-4.005
			], [
				x + side * .295,
				1.8,
				-4.005
			], .01);
		}
	}
	ownerId = null;
	category = "architecture";
	for (const x of [
		-5.18,
		-2.58,
		0,
		2.6,
		5.18
	]) for (const y of [.4, 2.64]) add(sphere, materials.metal, [
		x,
		y,
		-3.99
	], [
		.028,
		.028,
		.011
	], [
		0,
		0,
		0
	]);
	object("chest", "Baú", [
		-3.38,
		0,
		1.2
	]);
	for (const x of [-3.9, -2.88]) for (const y of [.12, .39]) add(sphere, materials.brass, [
		x,
		y,
		1.581
	], [
		.022,
		.022,
		.009
	], [
		0,
		0,
		0
	]);
	object("reading-chair", "Poltrona e manta", [
		-3.85,
		0,
		2.78
	]);
	for (const x of [-4.13, -3.61]) stroke("stitch", [
		x,
		.34,
		3.2
	], [
		x,
		.58,
		2.83
	], .008);
	object("library-skull", "Caveira da biblioteca", [
		-2.12,
		1.3,
		-3.38
	], "bookshelf");
	object("floor-cauldron", "Caldeirão de chão", [
		4.1,
		0,
		.3
	]);
	block("metal", [
		4.1,
		.435,
		.3
	], [
		.9,
		.8,
		.9
	]);
	const values = [...batches.values()];
	const metrics = {
		triangles: 0,
		meshes: values.length,
		instances: 0,
		geometries: geometries.size,
		materials: Object.keys(materials).length
	};
	for (const b of values) {
		metrics.instances += b.matrices.length;
		metrics.triangles += (b.g.index?.count ?? b.g.attributes.position.count) / 3 * b.matrices.length;
	}
	return {
		batches: values,
		objects,
		materials,
		geometries: [...geometries.values()],
		obstacles,
		lamps,
		metrics,
		dispose() {
			for (const g of geometries.values()) g.dispose();
			for (const m of Object.values(materials)) m.dispose();
		}
	};
}
//#endregion
//#region src/scenes/cabin/cabinFixtures.ts
function fixtureModel(id) {
	if (/^lamp-entry-(left|right)$/.test(id)) return "CandleStick_Stand";
	if (/^lamp-(library|study|hearth)$/.test(id)) return "Chandelier";
	return null;
}
var wicks = {
	Chandelier: [
		[
			-.57742,
			-.91669,
			-27e-5
		],
		[
			-.4048,
			-.91669,
			.41487
		],
		[
			-.00127,
			-.94295,
			.57424
		],
		[
			.40179,
			-.96913,
			.40829
		],
		[
			.57857,
			-.91669,
			.0053
		],
		[
			.40613,
			-.91669,
			-.40781
		],
		[
			-.0018,
			-.94295,
			-.56832
		],
		[
			-.409,
			-.96913,
			-.408
		]
	],
	CandleStick_Stand: [
		[
			-.31675,
			1.29887,
			-18e-5
		],
		[
			-.22177,
			1.29499,
			.22818
		],
		[
			-64e-5,
			1.27876,
			.31487
		],
		[
			.22003,
			1.26236,
			.22404
		],
		[
			.31774,
			1.29499,
			.00346
		],
		[
			.22284,
			1.29487,
			-.22372
		],
		[
			-.001,
			1.27876,
			-.31102
		],
		[
			-.22443,
			1.26236,
			-.22382
		]
	]
};
function fixtureTransform(model, pivot) {
	const scale = model === "Chandelier" ? .76 : 1;
	const y = model === "Chandelier" ? pivot[1] + .42 - .0359170437 * scale : pivot[1] - 1.38 + .035 + .0079470528 * scale;
	return new Matrix4().makeTranslation(pivot[0], y, pivot[2]).multiply(new Matrix4().makeScale(scale, scale, scale));
}
function fixtureFlames(model, matrix) {
	const scale = new Vector3().setFromMatrixScale(matrix).x;
	return wicks[model].map((p) => new Vector3(...p).applyMatrix4(matrix).add(new Vector3(0, .04 * scale, 0)));
}
/** One local emitter per candle object/fixture. Multiple flames on a chandelier
* share their centroid emitter, rather than allocating eight shader lights. */
function candleLightSources(batches) {
	const groups = /* @__PURE__ */ new Map();
	for (const batch of batches) if (batch.m.name === "flame") batch.ownerIds.forEach((id, i) => {
		if (!id) return;
		if (!groups.has(id)) groups.set(id, []);
		groups.get(id).push(new Vector3().setFromMatrixPosition(batch.matrices[i]));
	});
	return [...groups].map(([id, positions]) => ({
		id,
		position: positions.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(positions.length).toArray(),
		power: id.startsWith("lamp-") ? Math.min(8, 3 + positions.length * .6) : 1.7,
		distance: id.startsWith("lamp-") ? 3.5 : 1.9
	}));
}
//#endregion
//#region src/scenes/cabin/cabinFloorPotion.ts
/** Transfer the already-fitted liquid through the two instances of the SAME
* imported cauldron. Its rim clearance is preserved under translation/scale. */
function addFloorPotion(batches, bowl, geometries, ownedMaterials) {
	const oldIndex = bowl.ownerIds.indexOf("cauldron"), floorIndex = bowl.ownerIds.indexOf("floor-cauldron");
	if (oldIndex < 0 || floorIndex < 0) throw Error("Caldeirão de chão ausente.");
	const transfer = bowl.matrices[floorIndex].clone().multiply(bowl.matrices[oldIndex].clone().invert());
	const material = new MeshStandardMaterial({
		name: "floorPotion",
		color: "#8154b6",
		emissive: "#6e399c",
		emissiveIntensity: .22,
		roughness: .82
	});
	const bubbleMaterial = new MeshStandardMaterial({
		name: "potionBubble",
		color: "#c49be5",
		emissive: "#784da6",
		emissiveIntensity: .26,
		roughness: .34,
		metalness: .04
	});
	ownedMaterials.set(material, material);
	ownedMaterials.set(bubbleMaterial, bubbleMaterial);
	let surface;
	for (const batch of [...batches]) if (batch.m.name === "potion") {
		const matrices = batch.matrices.flatMap((m, i) => batch.ownerIds[i] === "cauldron" ? [m.clone().premultiply(transfer)] : []);
		if (!matrices.length) continue;
		batches.push({
			...batch,
			key: batch.key + "-floor",
			m: material,
			matrices,
			ownerIds: matrices.map(() => "floor-cauldron")
		});
		if (batch.g.type === "CircleGeometry") surface = matrices[0];
	}
	if (!surface) throw Error("Superfície da poção ausente.");
	const g = new SphereGeometry(1, 10, 6);
	geometries.push(g);
	const matrix = surface, center = new Vector3().setFromMatrixPosition(matrix);
	const sx = Math.hypot(matrix.elements[0], matrix.elements[1], matrix.elements[2]), sz = Math.hypot(matrix.elements[4], matrix.elements[5], matrix.elements[6]);
	const matrices = Array.from({ length: 12 }, (_, i) => {
		const angle = i * 2.399963, r = .309 * Math.sqrt((i + .5) / 12) * .68;
		const p = new Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0).applyMatrix4(matrix);
		p.y = center.y - .003;
		const radius = (.017 + i % 4 * .004) * Math.min(sx, sz);
		return new Matrix4().makeTranslation(p.x, p.y, p.z).multiply(new Matrix4().makeScale(radius, radius, radius));
	});
	batches.push({
		key: "floor-potion-bubbles",
		category: "furniture",
		g,
		m: bubbleMaterial,
		shadow: false,
		matrices,
		ownerIds: matrices.map(() => "floor-cauldron")
	});
}
//#endregion
//#region src/scenes/cabin/cabinAssetReplacements.ts
var furniture = {
	bed: "Bed_Twin1",
	"study-desk": "Workbench",
	"study-chair": "Chair_1",
	storage: "Cabinet",
	chest: "Chest_Wood",
	"alchemy-shelf-low": "Shelf_Simple",
	"alchemy-shelf-high": "Shelf_Simple"
};
function selectAssetReplacement(id, material) {
	if (fixtureModel(id)) return fixtureModel(id);
	if (id.startsWith("lamp-")) return null;
	if (furniture[id]) return id === "study-desk" && material === "leather" ? null : furniture[id];
	if (id === "cauldron" || id === "floor-cauldron") return material === "metal" ? "Cauldron" : null;
	if (/\/book-\d+$/.test(id)) return "Book_5";
	if (/\/book-stack-\d+$/.test(id)) return "Book_Stack_1";
	const bottle = id.match(/\/bottle-(\d+)$/);
	if (bottle) return [
		"Potion_1",
		"Potion_2",
		"Potion_4"
	][Number(bottle[1]) % 3];
	if (/\/candle-\d+$/.test(id) && material === "wax") return "Candle_2";
	return null;
}
function prepareAssetMaterial(source, name) {
	const m = source instanceof MeshStandardMaterial ? source.clone() : new MeshStandardMaterial();
	const cloth = name.includes("Cloth"), wood = name.includes("Furniture"), metal = name.includes("Metal");
	m.name = "asset/" + name;
	m.roughness = metal ? .9 : .98;
	m.metalness = metal ? .16 : 0;
	m.normalMap = m.roughnessMap = m.metalnessMap = m.aoMap = null;
	m.envMapIntensity = .14;
	m.userData = {
		...m.userData,
		assetSource: "Quaternius Fantasy Props MegaKit Standard",
		finish: "witchworld-hand-painted-matte"
	};
	m.onBeforeCompile = (shader) => {
		shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
      #ifdef USE_MAP
        ${cloth ? `if(vMapUv.x>.245 && vMapUv.x<.605 && vMapUv.y<.245){
          float wwBrush=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))*2.0+.55,.55,1.2);
          vec3 wwPlum=vec3(.15,.055,.125);
          diffuseColor.rgb=wwPlum*wwBrush;
        }else{diffuseColor.rgb*=vec3(.94,.84,.88);}` : wood ? `diffuseColor.rgb*=vec3(.83,.76,.78);` : metal ? `diffuseColor.rgb*=vec3(.88,.83,.91);` : `float wwValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(wwValue),diffuseColor.rgb,.83);`}
      #endif`);
	};
	m.customProgramCacheKey = () => `witchworld-quaternius-matte-v1-${cloth ? "cloth" : wood ? "wood" : metal ? "metal" : "props"}`;
	return m;
}
/** Swap visual buffers only: definitions and local transforms stay byte-for-byte
* compatible with exported v1/v2/v3 layouts. Imported pieces use the existing
* instanced renderer, editor owners, duplicates and selection bounds. */
function replaceCabinAssets(base, library) {
	library.updateMatrixWorld(true);
	const replacements = /* @__PURE__ */ new Map();
	for (const batch of base.batches) if (batch.category === "furniture") batch.ownerIds.forEach((id, index) => {
		if (!id) return;
		const fixtureId = id.split("/")[0], fixture = fixtureModel(fixtureId);
		const model = fixture ?? selectAssetReplacement(id, batch.m.name);
		if (!model) return;
		const targetId = fixture ? fixtureId : id;
		if (!replacements.has(targetId)) replacements.set(targetId, {
			id: targetId,
			model,
			bounds: new Box3(),
			pieces: []
		});
		const r = replacements.get(targetId);
		batch.g.computeBoundingBox();
		r.bounds.union(batch.g.boundingBox.clone().applyMatrix4(batch.matrices[index]));
		r.pieces.push({
			batch,
			index
		});
	});
	const removed = /* @__PURE__ */ new Map();
	for (const r of replacements.values()) for (const p of r.pieces) {
		if (!removed.has(p.batch)) removed.set(p.batch, /* @__PURE__ */ new Set());
		removed.get(p.batch).add(p.index);
	}
	const batches = base.batches.flatMap((batch) => {
		const omit = removed.get(batch);
		if (!omit) return [batch];
		const indices = batch.matrices.map((_, i) => i).filter((i) => !omit.has(i));
		return indices.length ? [{
			...batch,
			matrices: indices.map((i) => batch.matrices[i]),
			ownerIds: indices.map((i) => batch.ownerIds[i]),
			paintIndices: indices
		}] : [];
	});
	const geometries = [], materials = /* @__PURE__ */ new Map(), prepared = /* @__PURE__ */ new Map();
	const source = (name) => {
		if (prepared.has(name)) return prepared.get(name);
		const root = library.getObjectByName("Asset_" + name);
		if (!root) throw Error(`Asset ausente na biblioteca: ${name}`);
		const parts = [];
		root.traverse((object) => {
			if (!(object instanceof Mesh)) return;
			const g = object.geometry.clone(), p = g.attributes.position, point = new Vector3();
			if (object.isSkinnedMesh) {
				const skinned = object;
				skinned.skeleton.update();
				for (let i = 0; i < p.count; i++) {
					point.fromBufferAttribute(p, i);
					skinned.applyBoneTransform(i, point);
					p.setXYZ(i, point.x, point.y, point.z);
				}
			}
			g.applyMatrix4(object.matrixWorld);
			const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
			if (name === "Book_5") g.applyMatrix4(new Matrix4().makeRotationZ(Math.PI / 2));
			if (name === "Chair_1") g.applyMatrix4(new Matrix4().makeRotationY(Math.PI));
			const positions = g.attributes.position;
			if (name === "Bed_Twin1" && !sourceMaterial.name.includes("Cloth")) {
				for (let i = 0; i < positions.count; i++) if (positions.getZ(i) > .95 && positions.getY(i) > .3) positions.setY(i, .3 + (positions.getY(i) - .3) * .35);
			}
			if (name === "Bed_Twin1") g.computeVertexNormals();
			g.computeBoundingBox();
			geometries.push(g);
			if (!materials.has(sourceMaterial)) materials.set(sourceMaterial, prepareAssetMaterial(sourceMaterial, sourceMaterial.name));
			parts.push({
				g,
				m: materials.get(sourceMaterial),
				bounds: g.boundingBox.clone()
			});
		});
		prepared.set(name, parts);
		return parts;
	};
	const assetBatches = /* @__PURE__ */ new Map();
	for (const r of replacements.values()) {
		if (r.model === "Candle_2" && r.bounds.getSize(new Vector3()).y < .19) r.model = "Candle_1";
		const parts = source(r.model), bounds = new Box3();
		for (const p of parts) bounds.union(p.bounds);
		const target = r.bounds.clone();
		if (r.id === "bed") {
			target.min.y = .035;
			target.max.y = 1.04;
		}
		if (r.model === "Shelf_Simple") target.min.y = target.max.y - .27;
		const size = bounds.getSize(new Vector3()), scale = target.getSize(new Vector3()).divide(size);
		if (r.id === "floor-cauldron") scale.setScalar(.9 / Math.max(size.x, size.z));
		const isFixture = !!fixtureModel(r.id), pivot = base.objects.find((o) => o.id === r.id).position;
		const matrix = isFixture ? fixtureTransform(r.model, pivot) : new Matrix4().makeTranslation(target.min.x, target.min.y, target.min.z).multiply(new Matrix4().makeScale(scale.x, scale.y, scale.z)).multiply(new Matrix4().makeTranslation(-bounds.min.x, -bounds.min.y, -bounds.min.z));
		for (const part of parts) {
			if (!assetBatches.has(part.g)) assetBatches.set(part.g, {
				key: "asset-" + r.model + "-" + part.g.uuid,
				category: "furniture",
				g: part.g,
				m: part.m,
				shadow: true,
				matrices: [],
				ownerIds: [],
				uvMode: "authored"
			});
			const batch = assetBatches.get(part.g);
			batch.matrices.push(matrix.clone());
			batch.ownerIds.push(isFixture && part.m.name.includes("Props") ? `${r.id}/candle-001` : r.id);
		}
		if (isFixture) {
			const original = base.batches.find((b) => b.m.name === "flame");
			let flames = batches.find((b) => b.m.name === "flame");
			if (!flames) {
				flames = {
					...original,
					matrices: [],
					ownerIds: []
				};
				batches.push(flames);
			}
			if (flames === original) {
				flames = {
					...flames,
					matrices: [...flames.matrices],
					ownerIds: [...flames.ownerIds]
				};
				batches[batches.indexOf(original)] = flames;
			}
			const fixtureScale = new Vector3().setFromMatrixScale(matrix).x;
			for (const position of fixtureFlames(r.model, matrix)) {
				flames.matrices.push(new Matrix4().makeTranslation(...position.toArray()).multiply(new Matrix4().makeScale(.022 * fixtureScale, .055 * fixtureScale, .022 * fixtureScale)));
				flames.ownerIds.push(`${r.id}/candle-001`);
			}
		}
	}
	const bowl = [...assetBatches.values()].find((b) => b.ownerIds.includes("cauldron"));
	const liquid = batches.find((b) => b.m.name === "potion" && b.g.type === "CircleGeometry");
	if (bowl && liquid) {
		const mesh = new Mesh(bowl.g, bowl.m), index = bowl.ownerIds.indexOf("cauldron");
		mesh.matrixAutoUpdate = false;
		mesh.matrix.copy(bowl.matrices[index]);
		mesh.updateMatrixWorld(true);
		const center = new Vector3().setFromMatrixPosition(liquid.matrices[0]), ray = new Raycaster();
		const distance = (x, z) => {
			ray.set(center, new Vector3(x, 0, z));
			return ray.intersectObject(mesh)[0]?.distance;
		};
		const x = [distance(1, 0), distance(-1, 0)], z = [distance(0, 1), distance(0, -1)];
		if ([...x, ...z].every((n) => n !== void 0 && Number.isFinite(n) && n > .1)) {
			const sx = Math.min(...x) * .995 / .309, sz = Math.min(...z) * .995 / .309;
			const fit = new Matrix4().makeTranslation(center.x, center.y, center.z).multiply(new Matrix4().makeScale(sx, 1, sz)).multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
			for (const b of batches) if (b.m.name === "potion") b.matrices = b.matrices.map((m, i) => b.ownerIds[i] === "cauldron" ? m.clone().premultiply(fit) : m);
		} else throw Error("Não foi possível ajustar a poção à abertura do caldeirão.");
	}
	if (bowl) addFloorPotion(batches, bowl, geometries, materials);
	batches.push(...assetBatches.values());
	const allMaterials = {
		...base.materials,
		...Object.fromEntries([...materials.values()].map((m, i) => [m.name === "floorPotion" || m.name === "potionBubble" ? m.name : "asset-" + i, m]))
	};
	const metrics = {
		...base.metrics,
		meshes: batches.length,
		instances: 0,
		triangles: 0,
		geometries: base.geometries.length + geometries.length,
		materials: Object.keys(allMaterials).length
	};
	for (const b of batches) {
		metrics.instances += b.matrices.length;
		metrics.triangles += (b.g.index?.count ?? b.g.attributes.position.count) / 3 * b.matrices.length;
	}
	let disposed = false;
	return {
		...base,
		batches,
		materials: allMaterials,
		geometries: [...base.geometries, ...geometries],
		metrics,
		candleLights: candleLightSources(batches),
		replacements: [...replacements.values()].map((r) => ({
			id: r.id,
			model: r.model
		})),
		dispose() {
			if (disposed) return;
			disposed = true;
			base.dispose();
			geometries.forEach((g) => g.dispose());
			materials.forEach((m) => m.dispose());
		}
	};
}
//#endregion
//#region src/scenes/cabin/cabinSurfaceLibrary.ts
/** Original painted albedo art. No generated noise/height/roughness images. */
var PAINTED_ATLAS_PATHS = ["assets/painted/cabin-wood-art-v1.png", "assets/painted/cabin-surfaces-art-v1.png"];
/** Bottom-left UV origins. Inset keeps bilinear filtering inside each painting. */
function atlasCell(column, row, grid) {
	const inset = .006 / grid;
	return [
		column / grid + inset,
		1 - (row + 1) / grid + inset,
		1 / grid - inset * 2,
		1 / grid - inset * 2
	];
}
/** Loaded once by Drei/Suspense. Ownership stays with useTexture's cache. */
function createCabinSurfaceLibrary(atlases) {
	const owned = !atlases;
	const maps = atlases ?? {
		wood: new Texture(),
		surfaces: new Texture()
	};
	const textures = [maps.wood, maps.surfaces];
	for (const [index, map] of textures.entries()) {
		map.name = index === 0 ? "Cabin / painted wood atlas" : "Cabin / painted surfaces atlas";
		map.colorSpace = SRGBColorSpace;
		map.wrapS = map.wrapT = ClampToEdgeWrapping;
		map.minFilter = LinearMipmapLinearFilter;
		map.magFilter = LinearFilter;
		map.generateMipmaps = true;
		map.anisotropy = 4;
		map.userData.artSource = PAINTED_ATLAS_PATHS[index];
		map.needsUpdate = true;
	}
	const surfaces = {};
	const wood = [
		"chestnut",
		"walnut",
		"oak",
		"furniture"
	];
	const props = [
		"plum",
		"linen",
		"rug",
		"stone",
		"iron",
		"brass",
		"leather",
		"parchment",
		"glaze",
		"wax",
		"foliage",
		"soil",
		"potion",
		"crystal",
		"terracotta",
		"banner"
	];
	wood.forEach((kind, i) => {
		surfaces[kind] = {
			map: maps.wood,
			rect: atlasCell(i % 2, Math.floor(i / 2), 2)
		};
	});
	props.forEach((kind, i) => {
		surfaces[kind] = {
			map: maps.surfaces,
			rect: atlasCell(i % 4, Math.floor(i / 4), 4)
		};
	});
	let disposed = false;
	return {
		surfaces,
		textures,
		dispose() {
			if (disposed) return;
			disposed = true;
			if (owned) textures.forEach((map) => map.dispose());
		}
	};
}
//#endregion
//#region src/scenes/cabin/cabinMaterials.ts
var finishes = {
	wood: {
		surface: "chestnut",
		roughness: .88,
		wood: true,
		tint: "#dfcfc2"
	},
	plank: {
		surface: "furniture",
		roughness: .9,
		wood: true,
		tint: "#dbc5ae"
	},
	plankLight: {
		surface: "oak",
		roughness: .88,
		wood: true,
		tint: "#dccbb8"
	},
	beam: {
		surface: "walnut",
		roughness: .94,
		wood: true,
		tint: "#ddd2db"
	},
	wall: {
		surface: "chestnut",
		roughness: .92,
		wood: true,
		tint: "#c4b3a7"
	},
	bark: {
		surface: "walnut",
		roughness: .98,
		wood: true,
		tint: "#b4acb7"
	},
	cloth: {
		surface: "plum",
		roughness: .98
	},
	clothLight: {
		surface: "linen",
		roughness: .98,
		tint: "#e4d6de"
	},
	bedCloth: {
		surface: "plum",
		roughness: .98,
		crop: [
			.07,
			.14,
			.82,
			.26
		]
	},
	bedLinen: {
		surface: "linen",
		roughness: .98,
		tint: "#e4d6de",
		crop: [
			.1,
			.08,
			.78,
			.2
		]
	},
	rug: {
		surface: "rug",
		roughness: 1
	},
	roundRug: {
		surface: "rug",
		roughness: 1,
		crop: [
			.22,
			.22,
			.56,
			.56
		]
	},
	trim: {
		surface: "linen",
		roughness: .97,
		tint: "#c4a28e",
		recolor: 1.6
	},
	stitch: {
		surface: "linen",
		roughness: .96,
		tint: "#d6b58b",
		recolor: 1.7
	},
	stone: {
		surface: "stone",
		roughness: .98,
		tint: "#b4a9b6",
		crop: [
			.08,
			.08,
			.8,
			.8
		]
	},
	stoneLight: {
		surface: "stone",
		roughness: .96,
		tint: "#ded0d2",
		crop: [
			.15,
			.12,
			.8,
			.8
		]
	},
	metal: {
		surface: "iron",
		roughness: .9,
		metalness: .18,
		crop: [
			.21,
			.05,
			.74,
			.9
		]
	},
	brass: {
		surface: "brass",
		roughness: .8,
		metalness: .24
	},
	leather: {
		surface: "leather",
		roughness: .95,
		tint: "#b99287",
		crop: [
			.22,
			.22,
			.52,
			.5
		]
	},
	leatherLight: {
		surface: "parchment",
		roughness: .95,
		tint: "#b79370",
		recolor: 1.7
	},
	book: {
		surface: "leather",
		roughness: .94,
		tint: "#86618b",
		recolor: 4.2
	},
	bookRed: {
		surface: "leather",
		roughness: .94
	},
	bookBlue: {
		surface: "leather",
		roughness: .94,
		tint: "#607b9c",
		recolor: 4.2
	},
	bookGreen: {
		surface: "leather",
		roughness: .94,
		tint: "#687a51",
		recolor: 4.2
	},
	bookOchre: {
		surface: "leather",
		roughness: .94,
		tint: "#b2915c",
		recolor: 4.2
	},
	paper: {
		surface: "parchment",
		roughness: .98
	},
	ceramic: {
		surface: "glaze",
		roughness: .85,
		tint: "#bdc8c4"
	},
	bottleGlass: {
		surface: "glaze",
		roughness: .82,
		tint: "#a8b6cd"
	},
	bottleGlassGreen: {
		surface: "glaze",
		roughness: .84,
		tint: "#57806c",
		recolor: 4.1
	},
	terracotta: {
		surface: "terracotta",
		roughness: .96,
		tint: "#c7aa95"
	},
	wax: {
		surface: "wax",
		roughness: .92,
		tint: "#ead5a3"
	},
	leaf: {
		surface: "foliage",
		roughness: .98,
		tint: "#b1bc9b"
	},
	leafLight: {
		surface: "foliage",
		roughness: .98,
		tint: "#ded4a5"
	},
	leafDark: {
		surface: "foliage",
		roughness: .98,
		tint: "#829b8d"
	},
	herbDry: {
		surface: "foliage",
		roughness: 1,
		tint: "#d6b38e"
	},
	soil: {
		surface: "soil",
		roughness: 1,
		tint: "#aa9296"
	},
	soot: {
		surface: "stone",
		roughness: 1,
		tint: "#302836",
		recolor: 2.2
	},
	crystal: {
		surface: "crystal",
		roughness: .8,
		tint: "#c7afda"
	},
	potion: {
		surface: "potion",
		roughness: .82,
		tint: "#dac3ef"
	},
	floorPotion: {
		surface: "potion",
		roughness: .72,
		tint: "#dac3ef"
	},
	bone: {
		surface: "parchment",
		roughness: .97,
		tint: "#cbbab2"
	}
};
var paintedVertexPars = `
  uniform vec4 uCabinPaintRect;
  uniform float uCabinWood;
  attribute vec2 cabinUvX;
  attribute vec2 cabinUvY;
  attribute vec2 cabinUvZ;
  attribute vec4 cabinPaintCrop;
  attribute float cabinPaintAxis;
`;
var paintedUv = `
  #ifdef USE_MAP
    vec2 cabinUV = uv;
    #ifdef USE_INSTANCING
      if (uCabinWood > .5) cabinUV = cabinPaintAxis < .5 ? cabinUvX : (cabinPaintAxis < 1.5 ? cabinUvY : cabinUvZ);
      cabinUV = cabinPaintCrop.xy + cabinUV * cabinPaintCrop.zw;
    #endif
    vMapUv = uCabinPaintRect.xy + clamp(cabinUV,0.0,1.0) * uCabinPaintRect.zw;
  #endif
`;
var paintedMap = `
  #ifdef USE_MAP
    vec4 paintedTexel = texture2D(map,vMapUv);
    // Three uploads colour maps in SRGB8; the standard texture sample is already linear.
    if (uPaintRecolor > .0) paintedTexel.rgb=vec3(clamp(dot(paintedTexel.rgb,vec3(.2126,.7152,.0722))*uPaintRecolor,.06,1.25));
    diffuseColor *= paintedTexel;
  #endif
`;
var preparations = /* @__PURE__ */ new WeakMap();
function prepareCabinMaterials(materials, textures) {
	const existing = preparations.get(materials);
	if (existing) return existing;
	const library = createCabinSurfaceLibrary(textures);
	let disposed = false;
	const time = {
		value: 0,
		boil: { value: 0 },
		dispose() {
			if (disposed) return;
			disposed = true;
			library.dispose();
			preparations.delete(materials);
		}
	};
	preparations.set(materials, time);
	for (const [name, material] of Object.entries(materials)) {
		const finish = finishes[name];
		const isPotion = name === "potion" || name === "floorPotion";
		const animated = isPotion || name === "flame" || name === "potionBubble";
		if (!finish && !animated) continue;
		const surface = finish && library.surfaces[finish.surface];
		if (finish && surface) {
			material.color.set(finish.tint ?? "#ffffff");
			material.map = surface.map;
			material.normalMap = material.bumpMap = material.roughnessMap = material.metalnessMap = null;
			material.roughness = finish.roughness;
			material.metalness = finish.metalness ?? 0;
			material.envMapIntensity = .2;
			if ("clearcoat" in material) material.clearcoat = 0;
			if ([
				"leaf",
				"leafLight",
				"leafDark",
				"herbDry",
				"cloth",
				"clothLight",
				"bedCloth",
				"bedLinen"
			].includes(name)) material.side = DoubleSide;
			if (name === "crystal") material.emissiveIntensity = .035;
			if (isPotion) {
				material.emissive.set("#6e399c");
				material.emissiveIntensity = .22;
			}
			const rect = [...surface.rect];
			if (finish.crop) {
				rect[0] += finish.crop[0] * rect[2];
				rect[1] += finish.crop[1] * rect[3];
				rect[2] *= finish.crop[2];
				rect[3] *= finish.crop[3];
			}
			material.userData.cabinSurface = {
				kind: finish.surface,
				map: surface.map,
				rect,
				wood: !!finish.wood,
				style: "original-hand-painted-albedo",
				uv: "geometry-uv0",
				relief: 0
			};
		}
		material.onBeforeCompile = (shader) => {
			let vertexPars = "", fragmentPars = "", vertexBody = "";
			if (finish && surface) {
				Object.assign(shader.uniforms, {
					uCabinPaintRect: { value: new Vector4(...material.userData.cabinSurface.rect) },
					uCabinWood: { value: finish.wood ? 1 : 0 },
					uPaintRecolor: { value: finish.recolor ?? 0 }
				});
				vertexPars += paintedVertexPars;
				fragmentPars += "uniform float uPaintRecolor;\n";
				shader.vertexShader = shader.vertexShader.replace("#include <uv_vertex>", `#include <uv_vertex>\n${paintedUv}`);
				shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", paintedMap);
			}
			if (animated) {
				shader.uniforms.uCabinTime = name === "floorPotion" || name === "potionBubble" ? time.boil : time;
				vertexPars += "uniform float uCabinTime; varying vec3 vCabinWorld;\n";
				fragmentPars += "uniform float uCabinTime; varying vec3 vCabinWorld;\n";
				if (isPotion) {
					vertexPars += "varying vec2 vCabinPotionPlane;\n";
					fragmentPars += "varying vec2 vCabinPotionPlane;\n";
					vertexBody += "vCabinPotionPlane=position.xy; transformed.z += 0.0025*sin(position.x*18.0+uCabinTime*.7)*sin(position.y*14.0-uCabinTime*.5);";
				}
				if (name === "potionBubble") vertexBody += `float boilSeed=0.0;
          #ifdef USE_INSTANCING
            boilSeed=instanceMatrix[3].x*7.13+instanceMatrix[3].z*11.79;
          #endif
          float boilPhase=fract(uCabinTime*.58+boilSeed);
          transformed*=sin(3.14159265359*boilPhase);
          transformed.y+=boilPhase*1.4-.8;`;
				if (name === "flame") vertexBody += `float phase=0.0;
          #ifdef USE_INSTANCING
            phase=instanceMatrix[3].x*3.7+instanceMatrix[3].z*5.3;
          #endif
          transformed.x+=sin(uCabinTime*1.9+position.y*3.0+phase)*.10*max(position.y+.4,0.0);
          transformed.z+=sin(uCabinTime*1.4+position.y*4.0+phase)*.06*max(position.y+.4,0.0);`;
				vertexBody += `
          vec4 cabinWorld=vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            cabinWorld=instanceMatrix*cabinWorld;
          #endif
          vCabinWorld=(modelMatrix*cabinWorld).xyz;`;
				if (isPotion) shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
          vec2 p=vCabinPotionPlane;
          diffuseColor.rgb*=1.0-smoothstep(.22,.32,length(p))*.08;`);
				if (name === "flame") shader.fragmentShader = shader.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          totalEmissiveRadiance*=.94+.06*sin(uCabinTime*2.1+vCabinWorld.x*9.0+vCabinWorld.z*5.0);`);
			}
			shader.vertexShader = vertexPars + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${vertexBody}`);
			shader.fragmentShader = fragmentPars + shader.fragmentShader;
		};
		material.customProgramCacheKey = () => `cabin-painted-albedo-${animated ? name : "uv"}-art-pass-1`;
		material.needsUpdate = true;
	}
	return time;
}
//#endregion
//#region src/scenes/cabin/cabinReferenceRug.ts
var RUG_STAR_POINTS = Array.from({ length: 5 }, (_, i) => {
	const angle = Math.PI / 2 + i * 2 * Math.PI / 5;
	return { tip: [Math.cos(angle) * .74, Math.sin(angle) * .74] };
});
var vec = (p) => `vec2(${p.map((n) => n.toFixed(8)).join(",")})`;
var starSegments = RUG_STAR_POINTS.map((p, i) => `starDistance=min(starDistance,rugSegment(p,${vec(p.tip)},${vec(RUG_STAR_POINTS[(i + 2) % 5].tip)}));`).join("\n");
function prepareReferenceRug(materials) {
	const source = materials.rug, rect = source.userData.cabinSurface.rect;
	for (const name of [
		"roundRug",
		"rugEdge",
		"rugFringe",
		"rugFringeLight"
	]) {
		const m = materials[name], edge = name !== "roundRug";
		m.map = source.map;
		m.color.copy(source.color);
		m.roughness = source.roughness;
		m.metalness = source.metalness;
		m.envMapIntensity = source.envMapIntensity;
		m.normalMap = m.bumpMap = m.roughnessMap = m.metalnessMap = null;
		m.alphaTest = 0;
		m.transparent = false;
		m.userData.cabinSurface = {
			...source.userData.cabinSurface,
			rect: [...rect]
		};
		m.userData.artSource = "rectangular-rug-original-atlas";
		m.onBeforeCompile = (shader) => {
			shader.uniforms.uRugRect = { value: new Vector4(...rect) };
			shader.vertexShader = "varying vec2 vRugUv;\n" + shader.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvRugUv=uv;");
			shader.fragmentShader = `uniform vec4 uRugRect;
        varying vec2 vRugUv;
        float rugSegment(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;return length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.0,1.0));}
        ` + shader.fragmentShader;
			shader.fragmentShader = shader.fragmentShader.replace("#include <map_pars_fragment>", `#include <map_pars_fragment>
        vec4 rugPaint(vec2 uv){return texture2D(map,uRugRect.xy+uv*uRugRect.zw);}`);
			shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", edge ? `
        diffuseColor*=rugPaint(vec2(.22+vRugUv.x*.56,.78+vRugUv.y*.015));
      ` : `
        vec2 p=(vRugUv-.5)*2.0;
        float radius=length(p),aa=max(fwidth(p.x),fwidth(p.y));
        vec4 cloth=rugPaint(vec2(.22)+vRugUv*.56);
        // Roll the original two straight painted borders into concentric circles.
        vec4 border=rugPaint(vec2(.5+.28*sin(atan(p.y,p.x)),.965-(1.0-radius)*.60));
        cloth=mix(cloth,border,smoothstep(.80,.82,radius));
        float starDistance=10.0;
        ${starSegments}
        float starMask=1.0-smoothstep(.009-aa*.6,.009+aa*.6,starDistance);
        // One upright crescent, visually centered inside the central pentagon.
        // Horizontal cut offset keeps the horns vertical; no moons at the tips.
        float moonMask=(1.0-smoothstep(.160-aa,.160+aa,length(p-vec2(.051,0.0))))
          *smoothstep(.150-aa,.150+aa,length(p-vec2(.126,0.0)));
        // Pigment sampled from the rectangular rug's painted inner gold border.
        vec4 gold=rugPaint(vec2(.22+.56*vRugUv.x,.855));
        diffuseColor*=mix(cloth,gold,max(starMask,moonMask));
      `);
		};
		m.customProgramCacheKey = () => `witchworld-round-large-star-center-moon-v8-${edge ? "edge" : "surface"}`;
		m.needsUpdate = true;
	}
}
//#endregion
//#region src/scenes/cabin/cabinPaintedUv.ts
/** UV unwrap only: all positions, normals, triangles, instances and layout stay unchanged. */
function createPaintedBatchGeometry(batch, sourceIndices = batch.matrices.map((_, i) => i)) {
	if (batch.uvMode === "authored") return batch.g.clone();
	const geometry = batch.g.clone(), position = geometry.attributes.position, normal = geometry.attributes.normal;
	geometry.computeBoundingBox();
	const bounds = geometry.boundingBox, dimensions = bounds.getSize(new Vector3());
	const xUV = [], yUV = [], zUV = [], fallback = [];
	const unit = (value, min, span) => span > 1e-5 ? (value - min) / span : .5;
	for (let i = 0; i < position.count; i++) {
		const x = unit(position.getX(i), bounds.min.x, dimensions.x), y = unit(position.getY(i), bounds.min.y, dimensions.y), z = unit(position.getZ(i), bounds.min.z, dimensions.z);
		const n = [
			Math.abs(normal.getX(i)),
			Math.abs(normal.getY(i)),
			Math.abs(normal.getZ(i))
		], face = n.indexOf(Math.max(...n));
		xUV.push(face === 1 ? z : y, face === 0 ? z : x);
		yUV.push(face === 0 ? z : x, face === 1 ? z : y);
		zUV.push(face === 0 ? y : x, face === 2 ? y : z);
		fallback.push(x, y);
	}
	if (!geometry.getAttribute("uv")) geometry.setAttribute("uv", new Float32BufferAttribute(fallback, 2));
	else {
		const uv = geometry.getAttribute("uv");
		let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
		for (let i = 0; i < uv.count; i++) {
			minU = Math.min(minU, uv.getX(i));
			maxU = Math.max(maxU, uv.getX(i));
			minV = Math.min(minV, uv.getY(i));
			maxV = Math.max(maxV, uv.getY(i));
		}
		if (minU < 0 || minV < 0 || maxU > 1 || maxV > 1) for (let i = 0; i < uv.count; i++) uv.setXY(i, unit(uv.getX(i), minU, maxU - minU), unit(uv.getY(i), minV, maxV - minV));
	}
	geometry.setAttribute("cabinUvX", new Float32BufferAttribute(xUV, 2));
	geometry.setAttribute("cabinUvY", new Float32BufferAttribute(yUV, 2));
	geometry.setAttribute("cabinUvZ", new Float32BufferAttribute(zUV, 2));
	const crops = [], axes = [];
	const wood = [
		"wood",
		"plank",
		"plankLight",
		"beam",
		"wall",
		"bark"
	].includes(batch.m.name);
	sourceIndices.forEach((index) => {
		const e = batch.matrices[index].elements, paintIndex = batch.paintIndices?.[index] ?? index;
		const lengths = [
			Math.hypot(e[0], e[1], e[2]) * dimensions.x,
			Math.hypot(e[4], e[5], e[6]) * dimensions.y,
			Math.hypot(e[8], e[9], e[10]) * dimensions.z
		];
		axes.push(lengths.indexOf(Math.max(...lengths)));
		if (wood) {
			const variant = (paintIndex * 5 + Math.round(Math.abs(e[12] * 13 + e[14] * 7))) % 8, width = .22 + variant % 3 * .035;
			crops.push(variant / 7 * (1 - width), variant % 3 * .035, width, .9);
		} else crops.push(0, 0, 1, 1);
	});
	geometry.setAttribute("cabinPaintCrop", new InstancedBufferAttribute(new Float32Array(crops), 4));
	geometry.setAttribute("cabinPaintAxis", new InstancedBufferAttribute(new Float32Array(axes), 1));
	return geometry;
}
var MAX_LAYOUT_OBJECTS = 1024;
/** Copies keep their source mesh/paint identity in the layout, so history is complete. */
function resolveDefinitions(definitions, layout) {
	const catalog = new Map(definitions.map((o) => [o.id, o]));
	return [...definitions, ...Object.keys(layout).filter((id) => layout[id].copy).sort().map((id) => {
		const copy = layout[id].copy, source = catalog.get(copy.sourceId);
		return {
			...source,
			id,
			sourceId: source.id,
			parentId: copy.parentId,
			name: `${source.name} (cópia ${id.split("~copy-").at(-1)})`
		};
	})];
}
function canonicalLayout(layout, definitions) {
	return Object.fromEntries(resolveDefinitions(definitions, layout).map((o) => [o.id, layout[o.id]]));
}
function defaultLayout(definitions) {
	return Object.fromEntries(definitions.map((o) => [o.id, {
		position: [...o.position],
		rotationY: o.rotationY,
		scale: 1,
		visible: true,
		deleted: false
	}]));
}
function record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validTransform(value) {
	if (!record(value) || !Array.isArray(value.position) || value.position.length !== 3) return false;
	return value.position.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e4) && typeof value.rotationY === "number" && Number.isFinite(value.rotationY) && Math.abs(value.rotationY) <= 1e6 && typeof value.scale === "number" && Number.isFinite(value.scale) && value.scale >= .05 && value.scale <= 10;
}
function parseLayout(text, definitions) {
	if (new TextEncoder().encode(text).byteLength > 2097152) throw new Error("O layout excede o limite de 2 MB.");
	let doc;
	try {
		doc = JSON.parse(text);
	} catch {
		throw new Error("Arquivo JSON inválido.");
	}
	if (!record(doc) || doc.format !== "witchworld-cabin-layout" || ![
		1,
		2,
		3
	].includes(doc.version) || doc.scene !== "witchworld-cabin-artpass1-editor-v1" || !Array.isArray(doc.objects)) throw new Error("Formato ou versão incompatível com esta cabana.");
	if (doc.objects.length > 1024) throw new Error(`O limite é ${MAX_LAYOUT_OBJECTS} objetos, incluindo os originais.`);
	const legacy = doc.version !== 3;
	const catalog = new Map(definitions.map((o) => [o.id, o])), result = Object.create(null);
	for (const entry of doc.objects) {
		if (!record(entry) || typeof entry.id !== "string" || Object.hasOwn(result, entry.id)) throw new Error("Objeto desconhecido ou ID duplicado no layout.");
		const definition = catalog.get(entry.id);
		let copy;
		if (!definition) {
			if (legacy || !record(entry.copy) || typeof entry.copy.sourceId !== "string" || !catalog.has(entry.copy.sourceId) || !/^.+~copy-\d{4,}$/.test(entry.id) || entry.id !== `${entry.copy.sourceId}~copy-${entry.id.split("~copy-").at(-1)}` || entry.copy.parentId !== entry.parentId) throw new Error("Cópia ou objeto desconhecido no layout.");
			if (entry.parentId !== null && typeof entry.parentId !== "string") throw new Error("Conjunto inválido para a cópia.");
			copy = {
				sourceId: entry.copy.sourceId,
				parentId: entry.parentId
			};
		} else if (entry.copy !== void 0) throw new Error("Um objeto original não pode ser substituído por uma cópia.");
		const oldCurtain = legacy && entry.id === "curtains" && entry.parentId === null && definition?.parentId === "window";
		const transform = {
			position: entry.position,
			rotationY: entry.rotationY,
			scale: doc.version === 1 && entry.scale === void 0 ? 1 : entry.scale
		};
		if (definition && !oldCurtain && entry.parentId !== definition.parentId || !validTransform(transform) || typeof entry.visible !== "boolean" || typeof entry.deleted !== "boolean") throw new Error(`Dados inválidos para ${definition?.name ?? entry.id}.`);
		const position = [...transform.position];
		if (oldCurtain) {
			const origin = catalog.get("window").position;
			for (let i = 0; i < 3; i++) position[i] -= origin[i];
		}
		result[entry.id] = {
			position,
			rotationY: transform.rotationY,
			scale: transform.scale,
			visible: entry.visible,
			deleted: entry.deleted,
			...copy ? { copy } : {}
		};
	}
	const defaults = defaultLayout(definitions);
	for (const definition of definitions) if (!Object.hasOwn(result, definition.id)) {
		const newFixture = definition.id === "window" || /^lamp-(library|study|hearth|entry-left|entry-right)(\/candle-001)?$/.test(definition.id);
		if (definition.id !== "floor-cauldron" && (!legacy || !newFixture)) throw new Error("O arquivo deve conter todos os objetos originais desta cabana.");
		result[definition.id] = defaults[definition.id];
	}
	if (Object.keys(result).length > 1024) throw new Error(`O limite é ${MAX_LAYOUT_OBJECTS} objetos, incluindo os originais.`);
	const all = resolveDefinitions(definitions, result), expanded = new Map(all.map((o) => [o.id, o]));
	for (const o of all) if (o.sourceId) {
		const expected = catalog.get(o.sourceId).parentId, parent = o.parentId ? expanded.get(o.parentId) : null;
		if (o.parentId && !parent || (parent ? parent.sourceId ?? parent.id : null) !== expected) throw new Error("Hierarquia inválida para a cópia.");
		const seen = /* @__PURE__ */ new Set([o.id]);
		let ancestor = o.parentId;
		while (ancestor) {
			if (seen.has(ancestor)) throw new Error("O layout contém um ciclo.");
			seen.add(ancestor);
			ancestor = expanded.get(ancestor)?.parentId ?? null;
		}
	}
	return canonicalLayout(result, definitions);
}
//#endregion
//#region src/editor/editorRuntime.ts
var up = new Vector3(0, 1, 0);
var unit = new Vector3(1, 1, 1);
var CabinEditorRuntime = class {
	store;
	originals;
	resolved = [];
	catalog;
	defaults = /* @__PURE__ */ new Map();
	worlds = /* @__PURE__ */ new Map();
	bounds = /* @__PURE__ */ new Map();
	revision = -1;
	constructor(model, store) {
		this.store = store;
		this.originals = model.objects;
		this.catalog = new Map(model.objects.map((o) => [o.id, o]));
		const initial = (id) => {
			if (this.defaults.has(id)) return this.defaults.get(id);
			const o = this.catalog.get(id), m = new Matrix4().compose(new Vector3(...o.position), new Quaternion().setFromAxisAngle(up, o.rotationY), unit);
			if (o.parentId) m.premultiply(initial(o.parentId));
			this.defaults.set(id, m);
			return m;
		};
		for (const o of model.objects) initial(o.id);
		for (const batch of model.batches) {
			batch.g.computeBoundingBox();
			batch.ownerIds.forEach((id, i) => {
				if (!id) return;
				if (!this.bounds.has(id)) this.bounds.set(id, new Box3());
				this.bounds.get(id).union(batch.g.boundingBox.clone().applyMatrix4(batch.matrices[i]));
			});
		}
		const skull = this.defaults.get("library-skull");
		if (skull) this.bounds.set("library-skull", new Box3(new Vector3(-.16, 0, -.16), new Vector3(.16, .3, .16)).applyMatrix4(skull));
	}
	refresh() {
		const state = this.store.getState(), stamp = state.getRevision();
		if (stamp === this.revision) return;
		this.revision = stamp;
		this.worlds.clear();
		const layout = state.getLiveLayout();
		this.resolved = resolveDefinitions(this.originals, layout);
		this.catalog = new Map(this.resolved.map((o) => [o.id, o]));
		const build = (id) => {
			if (this.worlds.has(id)) return this.worlds.get(id);
			const definition = this.catalog.get(id), value = layout[id], parent = definition.parentId ? build(definition.parentId) : null;
			const matrix = new Matrix4().compose(new Vector3(...value.position), new Quaternion().setFromAxisAngle(up, value.rotationY), new Vector3().setScalar(value.scale));
			if (parent) matrix.premultiply(parent.matrix);
			const result = {
				matrix,
				delta: matrix.clone().multiply(this.defaults.get(definition.sourceId ?? id).clone().invert()),
				position: new Vector3().setFromMatrixPosition(matrix),
				rotationY: value.rotationY + (parent?.rotationY ?? 0),
				scale: value.scale * (parent?.scale ?? 1),
				visible: value.visible && !value.deleted && (parent?.visible ?? true)
			};
			this.worlds.set(id, result);
			return result;
		};
		for (const o of this.resolved) build(o.id);
	}
	get definitions() {
		this.refresh();
		return this.resolved;
	}
	get(id) {
		this.refresh();
		const result = this.worlds.get(id);
		if (!result) throw new Error("Objeto desconhecido.");
		return result;
	}
	localScale(id, worldScale) {
		this.refresh();
		const parentId = this.catalog.get(id).parentId;
		return worldScale / (parentId ? this.get(parentId).scale : 1);
	}
	toLocal(id, position, rotationY) {
		this.refresh();
		const parentId = this.catalog.get(id).parentId, parent = parentId ? this.get(parentId) : null;
		const local = position.clone();
		if (parent) local.applyMatrix4(parent.matrix.clone().invert());
		return {
			position: local.toArray(),
			rotationY: rotationY - (parent?.rotationY ?? 0)
		};
	}
	isDescendant(id, parentId) {
		this.refresh();
		let current = id;
		while (current) {
			if (current === parentId) return true;
			current = this.catalog.get(current)?.parentId ?? null;
		}
		return false;
	}
	selectionBounds(id, target) {
		target.makeEmpty();
		for (const o of this.definitions) {
			const bounds = this.bounds.get(o.sourceId ?? o.id);
			if (bounds && this.isDescendant(o.id, id) && this.get(o.id).visible) target.union(bounds.clone().applyMatrix4(this.get(o.id).delta));
		}
		return target;
	}
};
//#endregion
//#region src/editor/instanceCopies.ts
/** Every rendered instance retains its source UV crop and its own raycast owner. */
function expandBatchInstances(batch, definitions) {
	const copies = /* @__PURE__ */ new Map();
	for (const o of definitions) if (o.sourceId) {
		if (!copies.has(o.sourceId)) copies.set(o.sourceId, []);
		copies.get(o.sourceId).push(o.id);
	}
	return batch.ownerIds.flatMap((ownerId, sourceIndex) => [{
		sourceIndex,
		ownerId
	}, ...(ownerId ? copies.get(ownerId) ?? [] : []).map((id) => ({
		sourceIndex,
		ownerId: id
	}))]);
}
//#endregion
//#region src/systems/camera.ts
var ISO_TARGET = [
	0,
	1.05,
	.15
];
var ISO_POSITION = [
	10,
	14,
	20.15
];
var LAB_BOUNDS = {
	min: [
		-5.5,
		-.55,
		-4.55
	],
	max: [
		5.5,
		3.35,
		5.1
	]
};
/** Fit the same world bounds on landscape and portrait, without stretching. */
function fitIsometricCamera(camera, width, height) {
	const aspect = Math.max(width, 1) / Math.max(height, 1);
	camera.position.set(...ISO_POSITION);
	camera.lookAt(...ISO_TARGET);
	camera.updateMatrixWorld(true);
	let extentX = 0, extentY = 0;
	const point = new Vector3();
	for (const x of [LAB_BOUNDS.min[0], LAB_BOUNDS.max[0]]) for (const y of [LAB_BOUNDS.min[1], LAB_BOUNDS.max[1]]) for (const z of [LAB_BOUNDS.min[2], LAB_BOUNDS.max[2]]) {
		point.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
		extentX = Math.max(extentX, Math.abs(point.x));
		extentY = Math.max(extentY, Math.abs(point.y));
	}
	const halfHeight = Math.max(extentY, extentX / aspect) * 1.055;
	camera.left = -halfHeight * aspect;
	camera.right = halfHeight * aspect;
	camera.top = halfHeight;
	camera.bottom = -halfHeight;
	camera.near = .1;
	camera.far = 80;
	camera.zoom = 1;
	camera.updateProjectionMatrix();
}
//#endregion
//#region src/assets/labEnvironment.ts
/** Small local linear HDR environment. No remote preset/CDN, no scene capture loop. */
function createLabEnvironment() {
	const width = 64, height = 32;
	const data = /* @__PURE__ */ new Float32Array(8192);
	for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
		const u = x / width, v = y / 31;
		const moon = Math.exp(-((u - .72) ** 2 / .012 + (v - .32) ** 2 / .018));
		const warm = Math.exp(-((u - .23) ** 2 / .009 + (v - .56) ** 2 / .014));
		const i = (y * width + x) * 4;
		data[i] = .07 + moon * .5 + warm * 1.5;
		data[i + 1] = .09 + moon * .65 + warm * .52;
		data[i + 2] = .16 + moon * 1 + warm * .16;
		data[i + 3] = 1;
	}
	const texture = new DataTexture(data, width, height, RGBAFormat, FloatType);
	texture.mapping = EquirectangularReflectionMapping;
	texture.colorSpace = LinearSRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}
//#endregion
//#region game/buildPlayableCabin.ts
/** Approved scene data only. No React, editor UI, event handlers or render loop. */
function buildPlayableCabin(assets, skull, textures, layoutText) {
	const model = replaceCabinAssets(buildCabinLayout(), assets);
	const clock = prepareCabinMaterials(model.materials, textures);
	prepareReferenceRug(model.materials);
	const layout = parseLayout(layoutText, model.objects);
	const runtime = new CabinEditorRuntime(model, { getState: () => ({
		getRevision: () => 0,
		getLiveLayout: () => layout
	}) });
	const scene = new THREE.Scene();
	scene.name = "cabin-interior-approved-v14";
	scene.background = new THREE.Color("#10192b");
	const environment = createLabEnvironment();
	scene.environment = environment;
	scene.environmentIntensity = .15;
	const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, .1, 80);
	const collidable = /* @__PURE__ */ new Map(), matrix = new THREE.Matrix4(), geometries = [];
	const definitions = new Map(runtime.definitions.map((o) => [o.id, o]));
	for (const batch of model.batches) {
		const entries = expandBatchInstances(batch, runtime.definitions).filter((e) => !e.ownerId || runtime.get(e.ownerId).visible);
		if (!entries.length) continue;
		const geometry = createPaintedBatchGeometry(batch, entries.map((e) => e.sourceIndex));
		geometries.push(geometry);
		const mesh = new THREE.InstancedMesh(geometry, batch.m, entries.length);
		mesh.name = `cabin-${batch.category}-${batch.m.name}`;
		mesh.userData.ownerIds = entries.map((e) => e.ownerId);
		mesh.castShadow = batch.shadow;
		mesh.receiveShadow = true;
		batch.g.computeBoundingBox();
		entries.forEach((entry, i) => {
			matrix.copy(batch.matrices[entry.sourceIndex]);
			if (entry.ownerId) matrix.premultiply(runtime.get(entry.ownerId).delta);
			mesh.setMatrixAt(i, matrix);
			if (entry.ownerId) {
				const root = entry.ownerId;
				if (!collidable.has(root)) collidable.set(root, new THREE.Box3());
				collidable.get(root).union(batch.g.boundingBox.clone().applyMatrix4(matrix));
			}
		});
		mesh.computeBoundingBox();
		mesh.computeBoundingSphere();
		scene.add(mesh);
	}
	for (const o of runtime.definitions.filter((o) => (o.sourceId ?? o.id) === "library-skull" && runtime.get(o.id).visible)) {
		const root = skull.clone(true);
		root.getObjectByName("Cube")?.removeFromParent();
		root.traverse((n) => {
			if (n.isMesh) {
				n.castShadow = true;
				n.receiveShadow = true;
			}
		});
		const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3()), scale = .29 / Math.max(size.x, size.y, size.z);
		const normalize = new THREE.Group();
		normalize.scale.setScalar(scale);
		normalize.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
		normalize.add(root);
		const base = new THREE.Group();
		base.position.set(-2.12, 1.3, -3.38);
		base.rotation.y = .12;
		base.add(normalize);
		const owner = new THREE.Group();
		owner.matrixAutoUpdate = false;
		owner.matrix.copy(runtime.get(o.id).delta);
		owner.add(base);
		scene.add(owner);
	}
	scene.add(new THREE.HemisphereLight("#a3b2d0", "#3a2634", .3));
	const key = new THREE.SpotLight("#ffd0a0", 38, 16, .9, .82, 2);
	key.position.set(-2.6, 5.4, 4.1);
	key.target.position.set(-.9, 0, 1.1);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	key.shadow.camera.near = .5;
	key.shadow.camera.far = 18;
	key.shadow.normalBias = .035;
	key.shadow.bias = -15e-5;
	scene.add(key, key.target);
	const hearth = new THREE.PointLight("#ff9d51", 18, 4.3, 2);
	hearth.position.set(4.05, .8, -2.31);
	scene.add(hearth);
	const addPoint = (id, p, color, power, distance) => {
		const world = runtime.get(id);
		if (!world.visible) return;
		const light = new THREE.PointLight(color, power, distance * world.scale, 2);
		light.position.fromArray(p).applyMatrix4(world.delta);
		scene.add(light);
	};
	const maskData = /* @__PURE__ */ new Uint8Array(16384);
	for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
		const edge = Math.min(x, y, 63 - x, 63 - y);
		const value = Math.abs(x - 31.5) < 2 || Math.abs(y - 31.5) < 2 ? 16 : Math.min(255, Math.max(0, edge - 4) * 45);
		maskData.set([
			value,
			value,
			value,
			255
		], (y * 64 + x) * 4);
	}
	const windowMask = new THREE.DataTexture(maskData, 64, 64, THREE.RGBAFormat, THREE.UnsignedByteType);
	windowMask.needsUpdate = true;
	const points = new Map(model.candleLights.map((c) => [c.id, c]));
	for (const o of runtime.definitions) {
		const source = o.sourceId ?? o.id, c = points.get(source);
		if (c) addPoint(o.id, c.position, "#ffc27b", c.power, c.distance);
		if (source === "cauldron") addPoint(o.id, [
			4.08,
			1.92,
			-2.81
		], "#b78ce5", 1.5, 2.2);
		if (source === "window" && runtime.get(o.id).visible) {
			const world = runtime.get(o.id), light = new THREE.SpotLight("#829dff", 18.2, 10 * world.scale, .61, .45, 2);
			light.map = windowMask;
			light.position.set(-4.68, 2.18, -1.46).applyMatrix4(world.delta);
			light.target.position.set(-.65, .05, .1).applyMatrix4(world.delta);
			scene.add(light, light.target);
		}
	}
	const obstacles = [];
	for (const [id, bounds] of collidable) {
		const source = definitions.get(id)?.sourceId ?? id, size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
		if (/rug|window|curtain|banner/.test(source) || bounds.min.y > 1.35 || bounds.max.y < .12 || size.x < .22 || size.z < .22) continue;
		obstacles.push({
			kind: "box",
			name: id,
			position: center.toArray(),
			size: size.toArray()
		});
	}
	const spawn = new THREE.Vector3(0, .038, 3.15), exit = new THREE.Vector3(0, .038, 3.5);
	const pointsOfInterest = {
		study: {
			id: "veil-study",
			x: 0,
			z: -2.1
		},
		meditation: {
			id: "levitation-training",
			x: 1.44,
			z: .02
		},
		rest: {
			id: "witch-rest",
			x: -3.5,
			z: -1.5
		},
		storage: {
			id: "witch-storage",
			x: 4.12,
			z: 2.86
		}
	};
	scene.updateMatrixWorld(true);
	return {
		scene,
		camera,
		spawn,
		exit,
		points: pointsOfInterest,
		obstacles,
		setSize(w, h) {
			fitIsometricCamera(camera, w, h);
		},
		update(dt) {
			clock.boil.value += Math.min(Math.max(dt, 0), .1);
		},
		metrics() {
			return {
				...model.metrics,
				objects: Object.keys(layout).length,
				layoutVersion: 3,
				artVersion: 14,
				editorUI: false
			};
		},
		dispose() {
			clock.dispose();
			model.dispose();
			for (const g of geometries) g.dispose();
			environment.dispose();
			windowMask.dispose();
		}
	};
}
var approved_cabin_layout_v3_default = {
	format: "witchworld-cabin-layout",
	version: 3,
	scene: "witchworld-cabin-artpass1-editor-v1",
	objects: [
		{
			"id": "window",
			"parentId": null,
			"position": [
				-5.06,
				1.85,
				-1.46
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "curtains",
			"parentId": "window",
			"position": [
				.1299999999999999,
				0,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/plant-001",
			"parentId": null,
			"position": [
				-4.79,
				1.16,
				-1.08
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bed-rug",
			"parentId": null,
			"position": [
				-3.573390113353001,
				0,
				-1.3626705856833103
			],
			"rotationY": 0,
			"scale": 1.3093519809703278,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bed",
			"parentId": null,
			"position": [
				-3.4258232585425628,
				0,
				2.1884477776850826
			],
			"rotationY": 1.5528936639931463,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bedside",
			"parentId": null,
			"position": [
				-4.6162473885670146,
				0,
				3.81194278226271
			],
			"rotationY": 1.5783811762347133,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bedside/candle-001",
			"parentId": "bedside",
			"position": [
				-.14000000000000057,
				.86,
				.07000000000000028
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bedside/candle-002",
			"parentId": "bedside",
			"position": [
				.05999999999999961,
				.86,
				.14000000000000012
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bedside/book-stack-001",
			"parentId": "bedside",
			"position": [
				.08000000000000007,
				.86,
				-.1499999999999999
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf",
			"parentId": null,
			"position": [
				-3.765402511960658,
				0,
				-3.6953560943674546
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-001",
			"parentId": "bookshelf",
			"position": [
				-.8300000000000001,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-002",
			"parentId": "bookshelf",
			"position": [
				-.714,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-003",
			"parentId": "bookshelf",
			"position": [
				-.5869999999999997,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-004",
			"parentId": "bookshelf",
			"position": [
				-.45999999999999996,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-005",
			"parentId": "bookshelf",
			"position": [
				-.3330000000000002,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-006",
			"parentId": "bookshelf",
			"position": [
				-.19500000000000073,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-007",
			"parentId": "bookshelf",
			"position": [
				-.04600000000000071,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-008",
			"parentId": "bookshelf",
			"position": [
				.10299999999999931,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-009",
			"parentId": "bookshelf",
			"position": [
				.25199999999999934,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-010",
			"parentId": "bookshelf",
			"position": [
				.4119999999999995,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-011",
			"parentId": "bookshelf",
			"position": [
				.5829999999999995,
				.235,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-012",
			"parentId": "bookshelf",
			"position": [
				-.8080000000000003,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-013",
			"parentId": "bookshelf",
			"position": [
				-.6480000000000001,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-014",
			"parentId": "bookshelf",
			"position": [
				-.4770000000000003,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-015",
			"parentId": "bookshelf",
			"position": [
				-.3060000000000005,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-016",
			"parentId": "bookshelf",
			"position": [
				-.13500000000000068,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-017",
			"parentId": "bookshelf",
			"position": [
				.0029999999999992255,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-018",
			"parentId": "bookshelf",
			"position": [
				.10799999999999921,
				.745,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-stack-001",
			"parentId": "bookshelf",
			"position": [
				.5800000000000001,
				.745,
				.16000000000000014
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-019",
			"parentId": "bookshelf",
			"position": [
				-.8300000000000001,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-020",
			"parentId": "bookshelf",
			"position": [
				-.7250000000000001,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-021",
			"parentId": "bookshelf",
			"position": [
				-.609,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-022",
			"parentId": "bookshelf",
			"position": [
				-.4820000000000002,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-023",
			"parentId": "bookshelf",
			"position": [
				-.3550000000000004,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-024",
			"parentId": "bookshelf",
			"position": [
				-.22800000000000065,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-025",
			"parentId": "bookshelf",
			"position": [
				-.09000000000000119,
				1.255,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-026",
			"parentId": "bookshelf",
			"position": [
				-.8080000000000003,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-027",
			"parentId": "bookshelf",
			"position": [
				-.6590000000000003,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-028",
			"parentId": "bookshelf",
			"position": [
				-.4990000000000001,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-029",
			"parentId": "bookshelf",
			"position": [
				-.3280000000000003,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-030",
			"parentId": "bookshelf",
			"position": [
				-.15700000000000047,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-031",
			"parentId": "bookshelf",
			"position": [
				.013999999999999346,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-032",
			"parentId": "bookshelf",
			"position": [
				.15199999999999925,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-033",
			"parentId": "bookshelf",
			"position": [
				.25699999999999923,
				1.765,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/crystal-001",
			"parentId": "bookshelf",
			"position": [
				.6400000000000001,
				1.77,
				.18999999999999995
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/crystal-002",
			"parentId": "bookshelf",
			"position": [
				.8500000000000001,
				1.77,
				.18999999999999995
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-034",
			"parentId": "bookshelf",
			"position": [
				-.8300000000000001,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-035",
			"parentId": "bookshelf",
			"position": [
				-.7250000000000001,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-036",
			"parentId": "bookshelf",
			"position": [
				-.6200000000000001,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-037",
			"parentId": "bookshelf",
			"position": [
				-.504,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-038",
			"parentId": "bookshelf",
			"position": [
				-.3769999999999998,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-039",
			"parentId": "bookshelf",
			"position": [
				-.25,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-040",
			"parentId": "bookshelf",
			"position": [
				-.12300000000000022,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-041",
			"parentId": "bookshelf",
			"position": [
				.014999999999999236,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-042",
			"parentId": "bookshelf",
			"position": [
				.16399999999999926,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-043",
			"parentId": "bookshelf",
			"position": [
				.3129999999999993,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/book-044",
			"parentId": "bookshelf",
			"position": [
				.4619999999999993,
				2.2750000000000004,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/plant-001",
			"parentId": "bookshelf",
			"position": [
				-.81,
				2.35,
				.16999999999999993
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/candle-001",
			"parentId": "bookshelf",
			"position": [
				.680266700265431,
				2.27,
				.2586215323923331
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/ivy-001",
			"parentId": "bookshelf",
			"position": [
				-.9300000000000002,
				2.37,
				.3200000000000003
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bookshelf/ivy-002",
			"parentId": "bookshelf",
			"position": [
				1.8325179630630815,
				2.61,
				-.24655228903776027
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "library-ladder",
			"parentId": null,
			"position": [
				-2.553384644972415,
				0,
				-3.6730605715407223
			],
			"rotationY": 4.295012102643503,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk",
			"parentId": null,
			"position": [
				-4.5372005661168595,
				0,
				-1.6622091320423236
			],
			"rotationY": 1.5458675584136925,
			"scale": .7849234473618484,
			"visible": true,
			"deleted": false
		},
		{
			"id": "grimoire",
			"parentId": "study-desk",
			"position": [
				0,
				1.018,
				.05500000000000016
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/bottle-001",
			"parentId": "study-desk",
			"position": [
				-1.03,
				1.013,
				-.20999999999999996
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/bottle-002",
			"parentId": "study-desk",
			"position": [
				-.8500000000000001,
				1.013,
				-.20999999999999996
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/book-stack-001",
			"parentId": "study-desk",
			"position": [
				-1.02,
				1.013,
				.1599999999999997
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/crystal-001",
			"parentId": "study-desk",
			"position": [
				.99,
				1.013,
				-.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/candle-001",
			"parentId": "study-desk",
			"position": [
				.79,
				1.013,
				-.2200000000000002
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/candle-002",
			"parentId": "study-desk",
			"position": [
				1.12,
				1.013,
				.10999999999999988
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-notes",
			"parentId": "study-desk",
			"position": [
				.47,
				1.02,
				.18999999999999995
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-chair",
			"parentId": null,
			"position": [
				-4.06083961096085,
				0,
				-1.8780971653396583
			],
			"rotationY": 1.6201350668421113,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "study-desk/plant-001",
			"parentId": "study-desk",
			"position": [
				-1.2,
				1.014,
				-.26000000000000023
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "banner-left",
			"parentId": null,
			"position": [
				.818046973776966,
				1.9013438294389964,
				-4.08
			],
			"rotationY": 0,
			"scale": .7869807878645438,
			"visible": true,
			"deleted": false
		},
		{
			"id": "banner-right",
			"parentId": null,
			"position": [
				-4.875423554153492,
				2.09,
				3.0854118556949626
			],
			"rotationY": 1.57607551915719,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "cauldron",
			"parentId": null,
			"position": [
				4.068723525274459,
				1.25,
				-2.8043617626372295
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/candle-001",
			"parentId": null,
			"position": [
				2.2291830016384155,
				1.23,
				-3.222749864740472
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-low",
			"parentId": null,
			"position": [
				2.94,
				1.46,
				-4
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-low/bottle-001",
			"parentId": "alchemy-shelf-low",
			"position": [
				-.3700000000000001,
				.040000000000000036,
				.040000000000000036
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-low/bottle-002",
			"parentId": "alchemy-shelf-low",
			"position": [
				-.07000000000000028,
				.040000000000000036,
				.040000000000000036
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-low/bottle-003",
			"parentId": "alchemy-shelf-low",
			"position": [
				.22999999999999998,
				.040000000000000036,
				.040000000000000036
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-high",
			"parentId": null,
			"position": [
				2.94,
				2.02,
				-4
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-high/bottle-001",
			"parentId": "alchemy-shelf-high",
			"position": [
				-.3700000000000001,
				.040000000000000036,
				.040000000000000036
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-high/bottle-002",
			"parentId": "alchemy-shelf-high",
			"position": [
				-.07000000000000028,
				.040000000000000036,
				.040000000000000036
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-shelf-high/bottle-003",
			"parentId": "alchemy-shelf-high",
			"position": [
				.22999999999999998,
				.040000000000000036,
				.040000000000000036
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/plant-002",
			"parentId": null,
			"position": [
				2.8956976565629677,
				.037,
				-1.503412796718207
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "decor/ivy-001",
			"parentId": null,
			"position": [
				1.9717172685017497,
				2.65,
				-4.159346640185868
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "central-rug",
			"parentId": null,
			"position": [
				1.4439530279900818,
				0,
				.020389064855561134
			],
			"rotationY": 0,
			"scale": 1.3048819091105484,
			"visible": true,
			"deleted": false
		},
		{
			"id": "storage",
			"parentId": null,
			"position": [
				.07514780707230717,
				0,
				-3.7423982652724024
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "storage/plant-001",
			"parentId": "storage",
			"position": [
				.41999999999999993,
				.92,
				-.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "storage/bottle-001",
			"parentId": "storage",
			"position": [
				-.4114856685165029,
				.92,
				.22074934429167392
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "storage/book-stack-001",
			"parentId": "storage",
			"position": [
				-.16000000000000014,
				.92,
				-.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "chest",
			"parentId": null,
			"position": [
				-1.6040833691434555,
				0,
				2.3730671621427257
			],
			"rotationY": 1.6447528936229097,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "reading-chair",
			"parentId": null,
			"position": [
				-1.609662674338591,
				0,
				-3.6254097909446883
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "side-table",
			"parentId": null,
			"position": [
				-4.760573229211518,
				0,
				.04479388587254096
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "side-table/candle-001",
			"parentId": "side-table",
			"position": [
				0,
				.57,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/plant-003",
			"parentId": null,
			"position": [
				4.115500723404524,
				.032,
				-2.0762287410987192
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "decor/plant-004",
			"parentId": null,
			"position": [
				2.727423352736208,
				.032,
				-3.5201390747786783
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/plant-005",
			"parentId": null,
			"position": [
				-2.4934074728356626,
				.035,
				-3.5833288137492505
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/ivy-002",
			"parentId": null,
			"position": [
				-4.95,
				2.91,
				-2.65
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/ivy-003",
			"parentId": null,
			"position": [
				-4.95,
				2.62,
				-.32
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "decor/ivy-004",
			"parentId": null,
			"position": [
				4.795861818884582,
				2.53,
				-3.9766317748927684
			],
			"rotationY": -1.5623469775207315,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "hanging-herbs-1",
			"parentId": null,
			"position": [
				2.56,
				2.5,
				-3.96
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "hanging-herbs-2",
			"parentId": null,
			"position": [
				2.71,
				2.5,
				-3.96
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "hanging-herbs-3",
			"parentId": null,
			"position": [
				2.86,
				2.5,
				-3.96
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "hanging-herbs-4",
			"parentId": null,
			"position": [
				3.01,
				2.5,
				-3.96
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "hanging-herbs-5",
			"parentId": null,
			"position": [
				3.16,
				2.5,
				-3.96
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "lamp-library",
			"parentId": null,
			"position": [
				1.8244684336491157,
				3.2299797659280323,
				.9977715555953708
			],
			"rotationY": 0,
			"scale": 1.3310000000000004,
			"visible": true,
			"deleted": true
		},
		{
			"id": "lamp-library/candle-001",
			"parentId": "lamp-library",
			"position": [
				0,
				-.25,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "lamp-study",
			"parentId": null,
			"position": [
				-3.0633928974829048,
				2.9146406924387556,
				.2669402108397858
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "lamp-study/candle-001",
			"parentId": "lamp-study",
			"position": [
				0,
				-.25,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "lamp-hearth",
			"parentId": null,
			"position": [
				4.65,
				1.98,
				-3.18
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "lamp-hearth/candle-001",
			"parentId": "lamp-hearth",
			"position": [
				0,
				-.25,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "lamp-entry-left",
			"parentId": null,
			"position": [
				1.2844607739577456,
				1.38,
				3.802802163188199
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "lamp-entry-left/candle-001",
			"parentId": "lamp-entry-left",
			"position": [
				.02128460092758555,
				-.25,
				.04256920185517288
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "lamp-entry-right",
			"parentId": null,
			"position": [
				4.599729521459488,
				1.38,
				3.205073855923276
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "lamp-entry-right/candle-001",
			"parentId": "lamp-entry-right",
			"position": [
				0,
				-.25,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "floor-cushion",
			"parentId": null,
			"position": [
				2.2530563040051286,
				.3402735029616384,
				-3.39349422447395
			],
			"rotationY": 0,
			"scale": .6530794126859158,
			"visible": true,
			"deleted": false
		},
		{
			"id": "herb-pot--4.22",
			"parentId": null,
			"position": [
				3.628864528303531,
				1.5162176433040868,
				1.86210410085702
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "herb-pot-2.67",
			"parentId": null,
			"position": [
				1.091398135319718,
				.038,
				-1.9732023226765683
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true
		},
		{
			"id": "herb-pot-4.54",
			"parentId": "storage",
			"position": [
				.41999999999999993,
				.96,
				-.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf--4.24",
			"parentId": null,
			"position": [
				-1.1998700708828691,
				1.64,
				-4.163265860880456
			],
			"rotationY": -.03949448456480055,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf--4.24/bottle-001",
			"parentId": "wall-shelf--4.24",
			"position": [
				-.23000000000000043,
				.040000000000000036,
				.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf--4.24/bottle-002",
			"parentId": "wall-shelf--4.24",
			"position": [
				0,
				.040000000000000036,
				.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf--4.24/candle-001",
			"parentId": "wall-shelf--4.24",
			"position": [
				.23000000000000043,
				.040000000000000036,
				.04999999999999982
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf-2.68",
			"parentId": null,
			"position": [
				2.68,
				2.47,
				-3.91
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf-2.68/bottle-001",
			"parentId": "wall-shelf-2.68",
			"position": [
				-.22999999999999998,
				.040000000000000036,
				.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf-2.68/bottle-002",
			"parentId": "wall-shelf-2.68",
			"position": [
				0,
				.040000000000000036,
				.06000000000000005
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "wall-shelf-2.68/candle-001",
			"parentId": "wall-shelf-2.68",
			"position": [
				.22999999999999998,
				.040000000000000036,
				.04999999999999982
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "rolled-linen",
			"parentId": "storage",
			"position": [
				-.08999999999999986,
				.91,
				-.10999999999999988
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench",
			"parentId": null,
			"position": [
				2.0154724679091847,
				0,
				-3.4712113229380193
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench/book-stack-001",
			"parentId": "alchemy-bench",
			"position": [
				-.33000000000000007,
				.32,
				.1499999999999999
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench/bottle-001",
			"parentId": "alchemy-bench",
			"position": [
				-2.8585725224800016,
				.32,
				-.9345402316526301
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench/bottle-002",
			"parentId": "alchemy-bench",
			"position": [
				.2261993290606128,
				.98,
				-.14121896825106495
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench/bottle-003",
			"parentId": "alchemy-bench",
			"position": [
				.4249228543350698,
				.98,
				-.09558073088830144
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "mortar",
			"parentId": "alchemy-bench",
			"position": [
				-.22999999999999998,
				.98,
				.17999999999999972
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench/notes-001",
			"parentId": "alchemy-bench",
			"position": [
				.23999999999999977,
				.986,
				.2599999999999998
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "alchemy-bench/crystal-001",
			"parentId": "alchemy-bench",
			"position": [
				-.40000000000000036,
				.98,
				-.29000000000000004
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "library-skull",
			"parentId": "bookshelf",
			"position": [
				.3799999999999999,
				1.3,
				.28000000000000025
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false
		},
		{
			"id": "floor-cauldron",
			"parentId": null,
			"position": [
				4.360999226845104,
				0,
				3.530333924740119
			],
			"rotationY": 3.3673702698419348,
			"scale": 1.3176900000000007,
			"visible": true,
			"deleted": false
		},
		{
			"id": "bedside/candle-002~copy-0001",
			"parentId": "bedside",
			"position": [
				-.41144542214093693,
				.17898447633475545,
				9.469272583394476
			],
			"rotationY": 0,
			"scale": 1.4641000000000006,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "bedside/candle-002",
				"parentId": "bedside"
			}
		},
		{
			"id": "bedside/candle-002~copy-0002",
			"parentId": "bedside",
			"position": [
				-.44815114264789946,
				.17898447633475545,
				8.86431147748974
			],
			"rotationY": 0,
			"scale": 1.4641000000000006,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "bedside/candle-002",
				"parentId": "bedside"
			}
		},
		{
			"id": "decor/candle-001~copy-0001",
			"parentId": null,
			"position": [
				5.388914111654245,
				1.23,
				5.819551718001149
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "decor/candle-001",
				"parentId": null
			}
		},
		{
			"id": "decor/candle-001~copy-0002",
			"parentId": null,
			"position": [
				5.739620140698745,
				1.23,
				5.409801732116126
			],
			"rotationY": 0,
			"scale": 1.1,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "decor/candle-001",
				"parentId": null
			}
		},
		{
			"id": "decor/candle-001~copy-0003",
			"parentId": null,
			"position": [
				-.22590264058864395,
				1.23,
				-3.448404467748695
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "decor/candle-001",
				"parentId": null
			}
		},
		{
			"id": "lamp-library/candle-001~copy-0002",
			"parentId": "lamp-library~copy-0001",
			"position": [
				0,
				-.25,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "lamp-library/candle-001",
				"parentId": "lamp-library~copy-0001"
			}
		},
		{
			"id": "lamp-library~copy-0001",
			"parentId": null,
			"position": [
				4.616034546126034,
				3.3563953789237635,
				2.060775865817667
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true,
			"copy": {
				"sourceId": "lamp-library",
				"parentId": null
			}
		},
		{
			"id": "side-table/candle-001~copy-0002",
			"parentId": "side-table~copy-0001",
			"position": [
				0,
				.57,
				0
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": false,
			"copy": {
				"sourceId": "side-table/candle-001",
				"parentId": "side-table~copy-0001"
			}
		},
		{
			"id": "side-table~copy-0001",
			"parentId": null,
			"position": [
				4.756689411612223,
				0,
				2.314791390766909
			],
			"rotationY": 0,
			"scale": 1,
			"visible": true,
			"deleted": true,
			"copy": {
				"sourceId": "side-table",
				"parentId": null
			}
		}
	]
};
//#endregion
//#region game/cabin-interior.ts
async function createCabinInterior() {
	const base = new URL("./", "" + import.meta.url), textureLoader = new THREE.TextureLoader(), loader = new GLTFLoader();
	const [wood, surfaces, assets, skull] = await Promise.all([
		textureLoader.loadAsync(new URL("assets/painted/cabin-wood-art-v1.png", base).href),
		textureLoader.loadAsync(new URL("assets/painted/cabin-surfaces-art-v1.png", base).href),
		loader.loadAsync(new URL("assets/quaternius/cabin-props.glb", base).href),
		loader.loadAsync(new URL("assets/ritual-skull.glb", base).href)
	]);
	const cabin = buildPlayableCabin(assets.scene, skull.scene, {
		wood,
		surfaces
	}, JSON.stringify(approved_cabin_layout_v3_default));
	const support = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 8.4), new THREE.MeshBasicMaterial());
	support.rotation.x = -Math.PI / 2;
	support.position.y = .028;
	try {
		const navigation = await createGardenNavigation({
			surfaces: [support],
			obstacles: cabin.obstacles,
			outline: [
				[-5.1, -4.1],
				[5.1, -4.1],
				[5.1, 4.1],
				[-5.1, 4.1]
			],
			start: cabin.spawn,
			flatFloor: true
		});
		return {
			...cabin,
			navigation,
			metrics() {
				return {
					...cabin.metrics(),
					navigation: navigation.snapshot()
				};
			}
		};
	} catch (error) {
		cabin.dispose();
		wood.dispose();
		surfaces.dispose();
		throw error;
	} finally {
		support.geometry.dispose();
		support.material.dispose();
	}
}
//#endregion
export { createCabinInterior };
