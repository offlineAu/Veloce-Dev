"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeElements, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, RoundedBox } from "@react-three/drei";
import { LOGO_POLYGONS } from "@/components/brand/logo";
import { PHONE_SIZE, SCREEN_SIZE, drawPhone, drawScreen, preloadScreens } from "./screen";
import type { Bus, ShowStore, ShowcaseItem } from "./store";

/*
 * A MacBook-style laptop built from primitives (no model file, nothing fetched): a rounded aluminium base with a black
 * keyboard, speaker grilles and a glass trackpad, and a lid on a hinge whose display is a canvas texture (screen.ts).
 * Units: the base is 3 wide. The lid rotates about the hinge from 0 (closed) to OPEN.
 */
const BASE = { w: 3, h: 0.085, d: 2.06 };
const LID = { w: 3, h: 0.05, d: 2.02 };
const OPEN = 1.9; // ~109deg
const SCREEN = { w: 2.82, z: 1.04 };
const ALU = { color: "#e3e5e8", metalness: 0.92, roughness: 0.38 } as const;

/** Key rows in units of one key width; every row is 14.5 wide. Ids are what typing presses. */
const ROWS: [id: string, width: number, legend: string][][] = [
  [..."`1234567890-=".split("").map((c) => [c, 1, c] as [string, number, string]), ["Backspace", 1.5, "delete"]],
  [["Tab", 1.5, "tab"], ..."qwertyuiop[]\\".split("").map((c) => [c, 1, c.toUpperCase()] as [string, number, string])],
  [["CapsLock", 1.75, "caps lock"], ..."asdfghjkl;'".split("").map((c) => [c, 1, c.toUpperCase()] as [string, number, string]), ["Enter", 1.75, "return"]],
  [["ShiftLeft", 2.25, "shift"], ..."zxcvbnm,./".split("").map((c) => [c, 1, c.toUpperCase()] as [string, number, string]), ["ShiftRight", 2.25, "shift"]],
  [["fn", 1, "fn"], ["Control", 1, "control"], ["Alt", 1, "option"], ["MetaLeft", 1.25, "command"], [" ", 5, ""], ["MetaRight", 1.25, "command"], ["AltRight", 1, "option"], ["ArrowLeft", 1, "◀"], ["ArrowUpDown", 1, "▲▼"], ["ArrowRight", 1, "▶"]],
];
const SHIFTED: Record<string, string> = { "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0", _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/" };
const NAMED: Record<string, string> = { "\n": "Enter", Enter: "Enter", Backspace: "Backspace", Tab: "Tab", Shift: "ShiftLeft", Meta: "MetaLeft", Alt: "Alt", Control: "Control", CapsLock: "CapsLock", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", ArrowUp: "ArrowUpDown", ArrowDown: "ArrowUpDown" };

/** The keys a character (or a KeyboardEvent.key) presses: shifted characters press shift too. */
export function keysFor(char: string): string[] {
  if (NAMED[char]) return [NAMED[char]!];
  if (char === " ") return [" "];
  if (SHIFTED[char]) return ["ShiftLeft", SHIFTED[char]!];
  const lower = char.toLowerCase();
  if (char.length === 1 && lower !== char) return ["ShiftLeft", lower];
  return char.length === 1 ? [char] : [];
}

/** One small canvas texture per key legend, drawn locally (no font files). */
function legendTexture(text: string, aspect: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(128 * aspect);
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e9eaec";
  const word = text.length > 2;
  ctx.font = `500 ${word ? 30 : 52}px -apple-system, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = word ? "left" : "center";
  ctx.textBaseline = word ? "bottom" : "middle";
  ctx.fillText(text, word ? 14 : canvas.width / 2, word ? 116 : 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function grilleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#3a3d42";
  for (let y = 6; y < 512; y += 12) for (let x = 6; x < 64; x += 12) { ctx.beginPath(); ctx.arc(x + ((y / 12) % 2) * 6, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Keyboard({ busRef }: { busRef: RefObject<Bus> }) {
  const invalidate = useThree((state) => state.invalidate);
  const unit = 2.56 / 14.5;
  const gap = 0.024;
  const keyRefs = useRef(new Map<string, THREE.Object3D[]>());
  const pressed = useRef(new Map<string, number>());
  const keys = useMemo(() => {
    const out: { id: string; x: number; z: number; w: number; legend: string; i: number }[] = [];
    ROWS.forEach((row, r) => {
      let x = -14.5 * unit / 2;
      row.forEach(([id, width, legend]) => {
        out.push({ id, x: x + (width * unit) / 2, z: -0.82 + r * 0.19, w: width * unit - gap, legend, i: out.length });
        x += width * unit;
      });
    });
    return out;
  }, [unit]);
  const textures = useMemo(() => keys.map((k) => (k.legend ? legendTexture(k.legend, k.w / 0.165) : null)), [keys]);
  useEffect(() => () => textures.forEach((t) => t?.dispose()), [textures]);

  useEffect(() => {
    const bus = busRef.current;
    const keysDown = pressed.current;
    bus.press = (char: string) => {
      const until = performance.now() + 110;
      for (const id of keysFor(char)) keysDown.set(id, until);
      invalidate();
    };
    return () => { bus.press = null; };
  }, [busRef, invalidate]);

  useFrame((_, delta) => {
    const now = performance.now();
    let moving = false;
    keyRefs.current.forEach((objects, id) => {
      const target = (pressed.current.get(id) ?? 0) > now ? -0.009 : 0;
      for (const o of objects) {
        o.position.y = THREE.MathUtils.damp(o.position.y, target, 40, delta);
        if (Math.abs(o.position.y - target) > 0.0002 || target !== 0) moving = true;
      }
    });
    if (moving) invalidate();
  });

  const register = (id: string) => (o: THREE.Object3D | null) => {
    if (!o) return;
    const list = keyRefs.current.get(id) ?? [];
    if (!list.includes(o)) list.push(o);
    keyRefs.current.set(id, list);
  };

  return (
    <group position={[0, BASE.h, 0]}>
      {/* The recess the keys sit in. */}
      <mesh position={[0, 0.0012, -0.44]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.62, 0.98]} />
        <meshStandardMaterial color="#26282c" roughness={0.8} />
      </mesh>
      {keys.map((k) => (
        <group key={`${k.id}-${k.i}`} position={[k.x, 0, k.z]}>
          <group ref={register(k.id)}>
            <RoundedBox args={[k.w, 0.02, 0.165]} radius={0.009} smoothness={2} position={[0, 0.006, 0]}>
              <meshStandardMaterial color="#17181b" roughness={0.55} metalness={0.15} />
            </RoundedBox>
            {textures[k.i] ? (
              <mesh position={[0, 0.0165, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[k.w, 0.165]} />
                <meshBasicMaterial map={textures[k.i]!} transparent toneMapped={false} />
              </mesh>
            ) : null}
          </group>
        </group>
      ))}
    </group>
  );
}

function Trackpad({ store, busRef }: { store: ShowStore; busRef: RefObject<Bus> }) {
  const ref = useRef<THREE.Mesh>(null);
  const size = { w: 1.3, d: 0.78 };
  const move = (e: ThreeEvent<PointerEvent>) => {
    if (!ref.current) return;
    const p = ref.current.worldToLocal(e.point.clone());
    store.set({ cursor: { x: THREE.MathUtils.clamp(p.x / size.w + 0.5, 0, 0.96), y: THREE.MathUtils.clamp(p.z / size.d + 0.5, 0, 0.94) } });
  };
  return (
    <mesh
      ref={ref}
      position={[0, BASE.h + 0.0015, 0.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={move}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; store.set({ cursor: null }); }}
      onClick={(e) => { e.stopPropagation(); if (store.get().phase === "site") busRef.current.open?.(); }}
    >
      <planeGeometry args={[size.w, size.d]} />
      <meshPhysicalMaterial color="#c8cbd0" metalness={0.55} roughness={0.22} clearcoat={0.6} clearcoatRoughness={0.3} />
    </mesh>
  );
}

function LogoMark() {
  const geometry = useMemo(() => {
    const shapes = LOGO_POLYGONS.map((poly) => {
      const pts = poly.split(" ").map((pair) => pair.split(",").map(Number) as [number, number]);
      return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x - 48.4, 50 - y)));
    });
    return new THREE.ShapeGeometry(shapes);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // On the outside of the lid, readable when the laptop is closed and seen from the front.
  return (
    <mesh geometry={geometry} position={[0, LID.h + 0.0012, LID.d / 2]} rotation={[-Math.PI / 2, 0, 0]} scale={0.0042}>
      <meshPhysicalMaterial color="#eef0f2" metalness={1} roughness={0.12} clearcoat={1} />
    </mesh>
  );
}

type Draw = typeof drawScreen;

/**
 * A display: a canvas texture that `draw` paints, redrawn only when the build moves on (and every frame while the site
 * fades in or out, or the caret blinks). Returns the ref for the screen's material.
 */
function useScreenTexture(store: ShowStore, items: ShowcaseItem[], size: { width: number; height: number }, draw: Draw) {
  const invalidate = useThree((state) => state.invalidate);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const surface = useRef<{ ctx: CanvasRenderingContext2D; texture: THREE.CanvasTexture } | null>(null);
  const dirty = useRef(true);
  const caret = useRef(false);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    surface.current = { ctx: canvas.getContext("2d", { willReadFrequently: draw !== drawScreen })!, texture };
    if (material.current) { material.current.map = texture; material.current.color.set("#ffffff"); material.current.needsUpdate = true; }
    dirty.current = true;
    return () => { texture.dispose(); surface.current = null; };
  }, [size.width, size.height, draw]);
  const mix = useRef(store.get().phase === "site" ? 1 : 0);
  const fonts = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    return { mono: css.getPropertyValue("--font-mono").trim() || "ui-monospace, Menlo, monospace", sans: css.getPropertyValue("--font-body").trim() || "system-ui, sans-serif" };
  }, []);
  useEffect(() => {
    preloadScreens(items, () => { dirty.current = true; invalidate(); });
    return store.subscribe(() => { dirty.current = true; });
  }, [store, items, invalidate]);

  useFrame((_, delta) => {
    const s = store.get();
    const target = s.phase === "site" ? 1 : 0;
    const settled = Math.abs(mix.current - target) < 0.002;
    mix.current = settled ? target : THREE.MathUtils.damp(mix.current, target, 5, delta);
    if (!settled) invalidate();
    const blink = s.phase === "code" && Math.floor(performance.now() / 500) % 2 === 0;
    if (blink !== caret.current) { caret.current = blink; dirty.current = true; }
    const target2d = surface.current;
    if (!target2d || (!dirty.current && settled)) return;
    dirty.current = false;
    const item = items[s.active] ?? items[0];
    if (!item) return;
    draw(target2d.ctx, s, item, mix.current, fonts, () => { dirty.current = true; invalidate(); });
    target2d.texture.needsUpdate = true;
  });
  return material;
}

/** Opens the sample when its finished site is on screen (and the lid is up). */
const openSample = (store: ShowStore, busRef: RefObject<Bus>) => (e: ThreeEvent<MouseEvent>) => {
  if (store.get().phase === "site" && store.get().lid) { e.stopPropagation(); busRef.current.open?.(); }
};

function Display({ store, busRef, items }: { store: ShowStore; busRef: RefObject<Bus>; items: ShowcaseItem[] }) {
  const material = useScreenTexture(store, items, SCREEN_SIZE, drawScreen);
  return (
    <mesh position={[0, -0.0025, SCREEN.z]} rotation={[Math.PI / 2, 0, 0]} onClick={openSample(store, busRef)}>
      <planeGeometry args={[SCREEN.w, SCREEN.w / 1.6]} />
      <meshBasicMaterial ref={material} color="#08090b" toneMapped={false} />
    </mesh>
  );
}

/*
 * A phone with rounded corners: an extruded rounded rectangle (RoundedBox rounds every edge alike, which would make
 * the corners as tight as the phone is thin), glass on the front, and the display as a texture (drawPhone).
 */
const PHONE = { w: 0.76, h: 1.56, d: 0.08, r: 0.12, bevel: 0.016 };

function roundedRect(w: number, h: number, r: number) {
  const shape = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/** A flat rounded rectangle whose UVs span 0..1, so a texture fills it. */
function panel(w: number, h: number, r: number) {
  const geometry = new THREE.ShapeGeometry(roundedRect(w, h, r), 16);
  const pos = geometry.attributes.position!;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / w + 0.5; uv[i * 2 + 1] = pos.getY(i) / h + 0.5; }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function Phone({ store, busRef, items, ...props }: { store: ShowStore; busRef: RefObject<Bus>; items: ShowcaseItem[] } & ThreeElements["group"]) {
  const material = useScreenTexture(store, items, PHONE_SIZE, drawPhone);
  const { body, glass, screen } = useMemo(() => {
    const b = PHONE.bevel;
    const body = new THREE.ExtrudeGeometry(roundedRect(PHONE.w - b * 2, PHONE.h - b * 2, PHONE.r - b), { depth: PHONE.d - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 6, curveSegments: 24 });
    body.translate(0, 0, -(PHONE.d - b * 2) / 2);
    return { body, glass: panel(PHONE.w - 0.012, PHONE.h - 0.012, PHONE.r - 0.006), screen: panel(PHONE.w - 0.06, PHONE.h - 0.06, PHONE.r - 0.03) };
  }, []);
  useEffect(() => () => { body.dispose(); glass.dispose(); screen.dispose(); }, [body, glass, screen]);
  const front = PHONE.d / 2;
  return (
    <group {...props}>
      <mesh geometry={body} castShadow>
        <meshPhysicalMaterial {...ALU} clearcoat={0.3} />
      </mesh>
      <mesh geometry={glass} position={[0, 0, front + 0.0006]}>
        <meshPhysicalMaterial color="#060607" roughness={0.1} metalness={0.2} clearcoat={1} />
      </mesh>
      <mesh geometry={screen} position={[0, 0, front + 0.0012]} onClick={openSample(store, busRef)}>
        <meshBasicMaterial ref={material} color="#08090b" toneMapped={false} />
      </mesh>
      {/* Side buttons: action and volume on the left, power on the right. */}
      {[[-1, 0.42, 0.07], [-1, 0.26, 0.12], [-1, 0.1, 0.12], [1, 0.22, 0.2]].map(([side, y, len], i) => (
        <RoundedBox key={i} args={[0.014, len!, 0.03]} radius={0.006} smoothness={2} position={[side! * (PHONE.w / 2 + 0.004), y!, 0]}>
          <meshPhysicalMaterial {...ALU} />
        </RoundedBox>
      ))}
    </group>
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** The lid takes this long to swing fully open or shut; shorter swings take proportionally less. */
const LID_MS = 1600;

function Laptop({ store, busRef, items, ...props }: { store: ShowStore; busRef: RefObject<Bus>; items: ShowcaseItem[] } & ThreeElements["group"]) {
  const invalidate = useThree((state) => state.invalidate);
  const lid = useRef<THREE.Group>(null);
  const start = store.get().lid ? OPEN : 0;
  // The lid eases between where it was and where it is heading, slow out of the hinge and slow into place.
  const swing = useRef({ from: start, to: start, at: 0 });
  const grille = useMemo(() => grilleTexture(), []);
  useEffect(() => () => grille.dispose(), [grille]);

  useFrame(() => {
    const target = store.get().lid ? OPEN : 0;
    const now = performance.now();
    let sw = swing.current;
    if (target !== sw.to) {
      const t = Math.min(1, (now - sw.at) / Math.max(1, (LID_MS * Math.abs(sw.to - sw.from)) / OPEN));
      sw = swing.current = { from: sw.from + (sw.to - sw.from) * easeInOut(t), to: target, at: now };
    }
    const t = Math.min(1, (now - sw.at) / Math.max(1, (LID_MS * Math.abs(sw.to - sw.from)) / OPEN));
    if (lid.current) lid.current.rotation.x = -(sw.from + (sw.to - sw.from) * easeInOut(t));
    if (t < 1) invalidate();
  });

  const openIfClosed = (e: ThreeEvent<MouseEvent>) => { if (!store.get().lid) { e.stopPropagation(); store.set({ lid: true }); } };

  return (
    <group {...props} onClick={openIfClosed}>
      {/* Base */}
      <RoundedBox args={[BASE.w, BASE.h, BASE.d]} radius={0.04} smoothness={5} position={[0, BASE.h / 2, 0]} castShadow>
        <meshPhysicalMaterial {...ALU} clearcoat={0.15} />
      </RoundedBox>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.38, BASE.h + 0.001, -0.44]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.13, 0.98]} />
          <meshStandardMaterial map={grille} transparent opacity={0.85} roughness={0.6} />
        </mesh>
      ))}
      <Keyboard busRef={busRef} />
      <Trackpad store={store} busRef={busRef} />
      {/* Hinge */}
      <mesh position={[0, BASE.h, -BASE.d / 2 + 0.03]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.032, 2.5, 24]} />
        <meshStandardMaterial color="#2c2e32" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Lid, pivoting at the hinge; modelled closed, display facing down. */}
      <group ref={lid} position={[0, BASE.h + 0.004, -BASE.d / 2 + 0.03]}>
        {/* Radius stays under half the thickness, or RoundedBox bulges past its faces and hides the glass. */}
        <RoundedBox args={[LID.w, LID.h, LID.d]} radius={0.022} smoothness={5} position={[0, LID.h / 2, LID.d / 2]} castShadow>
          <meshPhysicalMaterial {...ALU} clearcoat={0.2} />
        </RoundedBox>
        <LogoMark />
        <mesh position={[0, -0.0008, LID.d / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LID.w - 0.05, LID.d - 0.05]} />
          <meshPhysicalMaterial color="#060607" roughness={0.12} metalness={0.2} clearcoat={1} />
        </mesh>
        <mesh position={[0, -0.0016, LID.d - 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.012, 16]} />
          <meshStandardMaterial color="#1c2a33" roughness={0.2} />
        </mesh>
        <Display store={store} busRef={busRef} items={items} />
      </group>
    </group>
  );
}

/** Renders on demand: a frame when the build state changes, and a few a second while the caret blinks. */
function Driver({ store, busRef }: { store: ShowStore; busRef: RefObject<Bus> }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const bus = busRef.current;
    bus.invalidate = invalidate;
    const off = store.subscribe(invalidate);
    const blink = setInterval(() => { if (store.get().phase === "code") invalidate(); }, 250);
    return () => { off(); clearInterval(blink); bus.invalidate = null; };
  }, [store, busRef, invalidate]);
  return null;
}

/**
 * The laptop and the phone together. They rise into place once when the scene appears, then lean a little towards the
 * pointer. Both settle where they start, so nothing swings round on load.
 */
function Desk({ store, busRef, items, rise: rises }: { store: ShowStore; busRef: RefObject<Bus>; items: ShowcaseItem[]; rise: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const group = useRef<THREE.Group>(null);
  const born = useRef(0);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const now = performance.now();
    born.current ||= now;
    const rise = rises ? Math.min(1, (now - born.current) / 1100) : 1;
    g.position.y = -0.18 * (1 - easeInOut(rise));
    const tilt = busRef.current.pointer;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, tilt.x * 0.3, 4, delta);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, tilt.y * 0.1, 4, delta);
    if (rise < 1 || Math.abs(g.rotation.y - tilt.x * 0.3) > 0.001 || Math.abs(g.rotation.x - tilt.y * 0.1) > 0.001) invalidate();
  });
  return (
    <group ref={group} position={[0, rises ? -0.18 : 0, 0]}>
      <Laptop store={store} busRef={busRef} items={items} position={[0.3, 0, -0.2]} rotation={[0, -0.5, 0]} />
      {/* Inside the group, so the shadow (drawn once) rises and leans with what casts it. */}
      <ContactShadows position={[0, -0.001, 0]} opacity={0.45} scale={9} blur={2.6} far={2.2} resolution={512} frames={1} />
      {/* Standing in front of the laptop, leaning back a touch, turned to the viewer. */}
      <group position={[-1.55, 0, 1.05]} rotation={[0, 0.28, 0]}>
        <Phone store={store} busRef={busRef} items={items} position={[0, PHONE.h / 2 - 0.004, 0]} rotation={[-0.09, 0, 0]} />
      </group>
    </group>
  );
}

/** Frames the laptop and phone for the container's shape: further back on narrow screens. */
function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const narrow = size.width / size.height < 1.15;
    camera.position.set(0.15, narrow ? 3.1 : 2.8, narrow ? 8.4 : 7.3);
    camera.lookAt(0.15, 0.62, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

/** The lazy-loaded WebGL scene. `active`: draw frames (off when the stage is off screen). `rise`: play the intro. */
export default function LaptopScene({ store, busRef, items, active, rise, onReady }: { store: ShowStore; busRef: RefObject<Bus>; items: ShowcaseItem[]; active: boolean; rise: boolean; onReady: () => void }) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={active ? "demand" : "never"}
      camera={{ fov: 32, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={() => onReady()}
      style={{ touchAction: "pan-y" }}
      aria-hidden
    >
      <Rig />
      <Driver store={store} busRef={busRef} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 6, 4]} intensity={1.6} />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} />
      {/* A studio made of light panels: reflections for the aluminium, rendered locally. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 5, 2]} scale={[10, 3, 1]} rotation={[Math.PI / 2, 0, 0]} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 2, 1]} scale={[2, 6, 1]} rotation={[0, Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={1.4} position={[5, 2, 1]} scale={[2, 6, 1]} rotation={[0, -Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={0.6} position={[0, 1, -5]} scale={[10, 2, 1]} />
        {/* A big soft key light ahead of and above the laptop: the silver deck and lid edges reflect it. */}
        <Lightformer form="rect" intensity={2.6} position={[0, 4, 6]} scale={[14, 8, 1]} rotation={[-0.6, 0, 0]} />
        <Lightformer form="ring" intensity={1.2} position={[-3, 3, 4]} scale={2.5} /> 
      </Environment>
      <Desk store={store} busRef={busRef} items={items} rise={rise} />
    </Canvas>
  );
}
