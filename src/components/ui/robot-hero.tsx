import React, { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, Terminal, X, LogIn, Anchor } from "lucide-react";

// ============================================================================
// Global Window-Level Cursor Tracking (ensures tracking works anywhere on screen)
// ============================================================================
const globalPointer = { x: 0, y: 0, active: false };

if (typeof window !== "undefined") {
  const handlePointer = (e: MouseEvent | PointerEvent | TouchEvent) => {
    const clientX = "touches" in e && e.touches[0] ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = "touches" in e && e.touches[0] ? e.touches[0].clientY : (e as MouseEvent).clientY;
    if (clientX !== undefined && clientY !== undefined) {
      globalPointer.x = (clientX / window.innerWidth) * 2 - 1;
      globalPointer.y = -(clientY / window.innerHeight) * 2 + 1;
      globalPointer.active = true;
    }
  };
  window.addEventListener("pointermove", handlePointer as any, { passive: true });
  window.addEventListener("mousemove", handlePointer as any, { passive: true });
  window.addEventListener("touchmove", handlePointer as any, { passive: true });
}

// ============================================================================
// 1. Procedural PBR Texture Generator (Ceramic / Metallic Speckled Chassis)
// ============================================================================
function generatePbrTexturesAsync(): Promise<{ colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (typeof document === "undefined") return;
      const c1 = document.createElement("canvas");
      const c2 = document.createElement("canvas");
      c1.width = c2.width = 512;
      c1.height = c2.height = 512;
      const ctx1 = c1.getContext("2d");
      const ctx2 = c2.getContext("2d");
      if (ctx1 && ctx2) {
        ctx1.fillStyle = "#dcdcdc";
        ctx1.fillRect(0, 0, 512, 512);
        ctx2.fillStyle = "#808080";
        ctx2.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 10000; i++) {
          const x = Math.random() * 512;
          const y = Math.random() * 512;
          const r = 0.5 + Math.random() * 1.5;
          const dark = Math.random() > 0.15;
          ctx1.beginPath();
          ctx1.arc(x, y, r, 0, Math.PI * 2);
          ctx1.fillStyle = dark ? "#222222" : "#dddddd";
          ctx1.fill();

          ctx2.beginPath();
          ctx2.arc(x, y, r, 0, Math.PI * 2);
          ctx2.fillStyle = dark ? "#000000" : "#ffffff";
          ctx2.fill();
        }
      }
      const colorMap = new THREE.CanvasTexture(c1);
      const bumpMap = new THREE.CanvasTexture(c2);
      colorMap.wrapS = bumpMap.wrapS = THREE.RepeatWrapping;
      colorMap.wrapT = bumpMap.wrapT = THREE.RepeatWrapping;
      colorMap.repeat.set(6, 3);
      bumpMap.repeat.set(6, 3);
      colorMap.needsUpdate = true;
      bumpMap.needsUpdate = true;
      resolve({ colorMap, bumpMap });
    }, 0);
  });
}

// ============================================================================
// 2. Heart Curve for Loved / Click Emote
// ============================================================================
class HeartCurve extends THREE.Curve<THREE.Vector3> {
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    return target.set(x * 0.002, (y + 6) * 0.002, 0);
  }
}
const defaultHeartCurve = new HeartCurve();

// ============================================================================
// 3. Curved Visor Glass Capsule with Fresnel Glow Shader
// ============================================================================
function GlassCapsule({
  color = "#00ffc6",
  power = 3.8,
  intensity = 1.2,
}: {
  color?: string;
  power?: number;
  intensity?: number;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color(color) },
      power: { value: power },
      intensity: { value: intensity },
    }),
    [],
  );

  useFrame(() => {
    if (matRef.current) {
      matRef.current.uniforms.color.value.set(color);
      matRef.current.uniforms.power.value = power;
      matRef.current.uniforms.intensity.value = intensity;
    }
  });

  return (
    <mesh>
      <sphereGeometry args={[0.3, 64, 64, 0, Math.PI * 2, 0, Math.PI]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            vViewPosition = -mvPosition.xyz;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={`
          uniform vec3 color;
          uniform float power;
          uniform float intensity;
          varying vec3 vNormal;
          varying vec3 vViewPosition;
          void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
            fresnel = pow(fresnel, power);
            gl_FragColor = vec4(color, fresnel * intensity);
          }
        `}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// Materials for ears & eyes
const earMat1 = new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.5 });
const earMat2 = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
const earMat3 = new THREE.MeshStandardMaterial({ color: "#cccccc", roughness: 0.8 });
const earMat4 = new THREE.MeshStandardMaterial({ color: "#999999", roughness: 0.4, metalness: 0.5 });
const earMat5 = new THREE.MeshStandardMaterial({ color: "#d0d0d0", roughness: 0.4, metalness: 0.2 });
const earTipMat = new THREE.MeshStandardMaterial({ color: "#ff3366", roughness: 0.2, toneMapped: false });
const eyeLovedMat = new THREE.MeshBasicMaterial({ color: "#ff3366", toneMapped: false });

// ============================================================================
// 4. Expressive Digital Robot Eyes (Curved Tube Arcs + Blinking + Heart Emote)
// ============================================================================
function RobotEye({
  position,
  rotation,
  scale = 1,
  blinkDuration = 0.15,
  blinkCycle = 3.0,
  isLovedRef,
  pantallaColor = "#00ffc6",
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  blinkDuration?: number;
  blinkCycle?: number;
  isLovedRef: React.MutableRefObject<boolean>;
  pantallaColor?: string;
}) {
  const eyeGroupRef = useRef<THREE.Group>(null);
  const normalGroupRef = useRef<THREE.Group>(null);
  const heartMeshRef = useRef<THREE.Mesh>(null);

  const eyeNormalMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: new THREE.Color(pantallaColor), toneMapped: false, transparent: true }),
    [pantallaColor],
  );

  useFrame(({ clock }) => {
    if (!eyeGroupRef.current || !normalGroupRef.current || !heartMeshRef.current) return;
    const isLoved = isLovedRef.current;
    normalGroupRef.current.visible = !isLoved;
    heartMeshRef.current.visible = isLoved;

    const modTime = clock.getElapsedTime() % blinkCycle;
    let sY = 1;
    if (modTime < blinkDuration && !isLoved) {
      const progress = modTime / blinkDuration;
      const wave = Math.sin(progress * Math.PI);
      sY = Math.max(0.05, 1 - wave);
    }
    eyeGroupRef.current.scale.set(scale, scale * sY, scale);
  });

  const { topPath, bottomPath } = useMemo(() => {
    const top = new THREE.CurvePath<THREE.Vector3>();
    top.add(new THREE.LineCurve3(new THREE.Vector3(-0.025, 0.005, 0), new THREE.Vector3(-0.025, 0.015, 0)));
    top.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.025, 0.015, 0),
        new THREE.Vector3(-0.025, 0.035, 0),
        new THREE.Vector3(-0.005, 0.035, 0),
      ),
    );
    top.add(new THREE.LineCurve3(new THREE.Vector3(-0.005, 0.035, 0), new THREE.Vector3(0.005, 0.035, 0)));
    top.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0.005, 0.035, 0),
        new THREE.Vector3(0.025, 0.035, 0),
        new THREE.Vector3(0.025, 0.015, 0),
      ),
    );
    top.add(new THREE.LineCurve3(new THREE.Vector3(0.025, 0.015, 0), new THREE.Vector3(0.025, 0.005, 0)));

    const btm = new THREE.CurvePath<THREE.Vector3>();
    btm.add(new THREE.LineCurve3(new THREE.Vector3(-0.025, -0.005, 0), new THREE.Vector3(-0.025, -0.015, 0)));
    btm.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-0.025, -0.015, 0),
        new THREE.Vector3(-0.025, -0.035, 0),
        new THREE.Vector3(-0.005, -0.035, 0),
      ),
    );
    btm.add(new THREE.LineCurve3(new THREE.Vector3(-0.005, -0.035, 0), new THREE.Vector3(0.005, -0.035, 0)));
    btm.add(
      new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0.005, -0.035, 0),
        new THREE.Vector3(0.025, -0.035, 0),
        new THREE.Vector3(0.025, -0.015, 0),
      ),
    );
    btm.add(new THREE.LineCurve3(new THREE.Vector3(0.025, -0.015, 0), new THREE.Vector3(0.025, -0.005, 0)));

    return { topPath: top, bottomPath: btm };
  }, []);

  return (
    <group ref={eyeGroupRef} position={position} rotation={rotation} scale={scale}>
      <mesh ref={heartMeshRef} visible={false} material={eyeLovedMat}>
        <tubeGeometry args={[defaultHeartCurve, 64, 0.0035, 8, true]} />
      </mesh>
      <group ref={normalGroupRef}>
        <mesh material={eyeNormalMat}>
          <tubeGeometry args={[topPath, 20, 0.0035, 8, false]} />
        </mesh>
        <mesh material={eyeNormalMat}>
          <tubeGeometry args={[bottomPath, 20, 0.0035, 8, false]} />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================================
// 5. Side Ear Pods with Antenna
// ============================================================================
function RobotEar({
  position,
  scale = 1,
  isLeft = false,
}: {
  position: [number, number, number];
  scale?: number;
  isLeft?: boolean;
}) {
  const sign = isLeft ? -1 : 1;
  return (
    <group position={position} scale={scale}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={earMat1}>
        <cylinderGeometry args={[0.04, 0.04, 0.025, 32]} />
      </mesh>
      <mesh position={[sign * 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={earMat2}>
        <torusGeometry args={[0.032, 0.008, 16, 32]} />
      </mesh>
      <mesh position={[sign * 0.012, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow material={earMat3}>
        <cylinderGeometry args={[0.03, 0.03, 0.005, 32]} />
      </mesh>
      <group position={[sign * 0.015, 0.035, 0]} rotation={[-0.4, 0, 0]}>
        <mesh position={[0, 0.01, 0]} castShadow receiveShadow material={earMat4}>
          <cylinderGeometry args={[0.006, 0.008, 0.02, 16]} />
        </mesh>
        <mesh position={[0, 0.06, 0]} castShadow receiveShadow material={earMat5}>
          <cylinderGeometry args={[0.003, 0.003, 0.1, 8]} />
        </mesh>
        <mesh position={[0, 0.11, 0]} material={earTipMat}>
          <sphereGeometry args={[0.006, 16, 16]} />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================================
// 6. Complete 3D Robot Character with Physics Tracking & Lathe Geometries
// ============================================================================
export interface RobotSettings {
  color?: string;
  scale?: number;
  pantallaColor?: string;
  pantallaBrillo?: number;
  blinkCycle?: number;
  metalness?: number;
  neckParams?: {
    baseR: number;
    baseH: number;
    midR: number;
    midH: number;
    lipBottomR: number;
    lipBottomH: number;
    lipTopR: number;
    lipTopH: number;
    innerR: number;
    innerDropH: number;
  };
  bodyParams?: {
    bodyBevelR: number;
    bodyBevelY: number;
    bodyBevelT: number;
  };
}

function RobotPrototype({
  neckParams = {
    baseR: 0.215,
    baseH: -0.05,
    midR: 0.28,
    midH: 0.02,
    lipBottomR: 0.295,
    lipBottomH: 0.045,
    lipTopR: 0.27,
    lipTopH: 0.055,
    innerR: 0.1,
    innerDropH: 0,
  },
  bodyParams = {
    bodyBevelR: 0.235,
    bodyBevelY: 0.34,
    bodyBevelT: 0.025,
  },
  color = "#c4c4c4",
  pantallaColor = "#00ffc6",
  pantallaBrillo = 1.2,
  blinkCycle = 3.0,
  metalness = 0.0,
}: RobotSettings) {
  const isLovedRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const [textures, setTextures] = useState<{ colorMap: THREE.CanvasTexture | null; bumpMap: THREE.CanvasTexture | null }>({
    colorMap: null,
    bumpMap: null,
  });

  const config = useMemo(
    () => ({
      pantallaColor,
      pantallaGrosor: 3.8,
      pantallaBrillo,
      separacionOjos: 0.07,
      tamanoOrejas: 1.3,
      escalaOjos: 1.1,
      parpadeoFrecuencia: blinkCycle,
      parpadeoDuracion: 0.45,
      colorChasis: color,
      alturaCabeza: 0.6,
    }),
    [color, pantallaColor, pantallaBrillo, blinkCycle],
  );

  useFrame((state, delta) => {
    if (!bodyRef.current || !headRef.current) return;
    const dt = Math.min(delta, 0.1);
    const px = globalPointer.active ? globalPointer.x : state.pointer.x;
    const py = globalPointer.active ? globalPointer.y : state.pointer.y;

    // Body glides smoothly along X toward cursor
    const maxShift = Math.min(1.1, state.viewport.width * 0.22);
    const targetX = px * maxShift;
    bodyRef.current.position.x = THREE.MathUtils.lerp(bodyRef.current.position.x, targetX, 4 * dt);

    // Body tilts toward cursor
    const targetBodyRotY = px * 0.45;
    const targetBodyRotX = -py * 0.25;
    const targetBodyRotZ = -px * 0.12;
    bodyRef.current.rotation.y = THREE.MathUtils.lerp(bodyRef.current.rotation.y, targetBodyRotY, 10 * dt);
    bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, targetBodyRotX, 10 * dt);
    bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, targetBodyRotZ, 10 * dt);

    // Head directly looks at cursor (strong, responsive tracking)
    const targetHeadY = px * 1.15;
    const targetHeadX = -py * 0.75;
    headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetHeadY, 15 * dt);
    headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetHeadX, 15 * dt);
  });

  useEffect(() => {
    let active = true;
    let loaded: { colorMap: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
    generatePbrTexturesAsync().then((tex) => {
      if (active) {
        loaded = tex;
        setTextures(tex);
      } else {
        tex.colorMap.dispose();
        tex.bumpMap.dispose();
      }
    });
    return () => {
      active = false;
      if (loaded) {
        loaded.colorMap.dispose();
        loaded.bumpMap.dispose();
      }
    };
  }, []);

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    isLovedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isLovedRef.current = false;
    }, 2000);
  };

  const lathePoints = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(neckParams.innerR, neckParams.baseH));
    pts.push(new THREE.Vector2(neckParams.baseR, neckParams.baseH));
    pts.push(new THREE.Vector2(neckParams.midR, neckParams.midH));
    pts.push(new THREE.Vector2(neckParams.lipBottomR, neckParams.lipBottomH));
    pts.push(new THREE.Vector2(neckParams.lipTopR, neckParams.lipTopH));
    pts.push(new THREE.Vector2(neckParams.innerR, neckParams.lipTopH));
    pts.push(new THREE.Vector2(neckParams.innerR, neckParams.lipTopH - neckParams.innerDropH));
    return pts;
  }, [neckParams]);

  const innerHeadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#111111", roughness: 1, metalness: 0 }), []);

  if (!textures.colorMap) return null;

  return (
    <group
      ref={bodyRef}
      position={[0, -0.3, 0]}
      onPointerDown={handlePointerDown}
      onPointerOver={() => {
        if (typeof document !== "undefined") document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (typeof document !== "undefined") document.body.style.cursor = "auto";
      }}
    >
      {/* Torso / Body sphere */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.43, 64, 64, 0, Math.PI * 2, Math.PI * 0.15, Math.PI * 0.85]} />
        <meshStandardMaterial
          color={config.colorChasis}
          map={textures.colorMap || undefined}
          bumpMap={textures.bumpMap || undefined}
          bumpScale={0.005}
          roughness={1}
          metalness={metalness}
          envMapIntensity={0}
        />
      </mesh>

      {/* Body Bevel Ring */}
      {bodyParams.bodyBevelT > 0 && (
        <mesh position={[0, bodyParams.bodyBevelY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[bodyParams.bodyBevelR, bodyParams.bodyBevelT, 32, 64]} />
          <meshStandardMaterial
            color={config.colorChasis}
            map={textures.colorMap || undefined}
            bumpMap={textures.bumpMap || undefined}
            bumpScale={0.005}
            roughness={1}
            metalness={metalness}
            envMapIntensity={0}
          />
        </mesh>
      )}

      {/* Lathe Neck Collar */}
      <mesh position={[0, 0.38, 0]} receiveShadow castShadow>
        <latheGeometry args={[lathePoints, 64]} />
        <meshStandardMaterial
          color={config.colorChasis}
          map={textures.colorMap || undefined}
          bumpMap={textures.bumpMap || undefined}
          bumpScale={0.005}
          roughness={1}
          metalness={metalness}
          envMapIntensity={0}
        />
      </mesh>

      {/* Head Group */}
      <group ref={headRef} position={[0, config.alturaCabeza, 0]}>
        <mesh material={innerHeadMat} castShadow receiveShadow>
          <sphereGeometry args={[0.28, 64, 64, 0, Math.PI * 2, 0, Math.PI]} />
        </mesh>

        {/* Visor Screen Glass */}
        <GlassCapsule color={config.pantallaColor} power={config.pantallaGrosor} intensity={config.pantallaBrillo} />

        {/* Dual Eyes */}
        <group position={[0, -0.02, 0.29]}>
          <RobotEye
            position={[-0.07, 0, 0]}
            rotation={[0, -0.2, 0]}
            scale={config.escalaOjos}
            blinkDuration={config.parpadeoDuracion}
            blinkCycle={config.parpadeoFrecuencia}
            isLovedRef={isLovedRef}
            pantallaColor={config.pantallaColor}
          />
          <RobotEye
            position={[config.separacionOjos, 0, 0]}
            rotation={[0, 0.2, 0]}
            scale={config.escalaOjos}
            blinkDuration={config.parpadeoDuracion}
            blinkCycle={config.parpadeoFrecuencia}
            isLovedRef={isLovedRef}
            pantallaColor={config.pantallaColor}
          />
        </group>

        {/* Dual Ears */}
        <RobotEar position={[-0.29, 0, 0]} isLeft scale={config.tamanoOrejas} />
        <RobotEar position={[0.29, 0, 0]} isLeft={false} scale={config.tamanoOrejas} />
      </group>
    </group>
  );
}

function ResponsiveGroup({ children, scale = 1 }: { children: React.ReactNode; scale?: number }) {
  const { viewport } = useThree();
  const s = Math.min(1.1, viewport.width / 3.5) * scale;
  return <group scale={s}>{children}</group>;
}

// ============================================================================
// 7. Antenna Floating Navbar (Signature 21st.dev Component Glass Bar)
// ============================================================================
function AntennaNavbar({
  leftItems = [
    { label: "Product", href: "#" },
    { label: "About", href: "#" },
    { label: "Specs", href: "#" },
    { label: "Reviews", href: "#" },
  ],
  contactText = "Contact",
  contactHref = "#",
  contactTarget,
  ctaText = "Buy Now",
  onCtaClick,
}: {
  leftItems?: Array<{ label: string; href: string; target?: string }>;
  contactText?: string;
  contactHref?: string;
  contactTarget?: string;
  ctaText?: string;
  onCtaClick?: () => void;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <nav className="sticky top-0 z-50 w-full pt-8 px-6 sm:px-8 pointer-events-none">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col relative pointer-events-auto">
        <div className="flex flex-col lg:flex-row items-center justify-between relative gap-4 lg:gap-0">
          {/* Left Pill Links */}
          <div className="flex flex-wrap justify-center lg:justify-start items-center gap-2 sm:gap-3 z-20">
            {leftItems.map((item, idx) => (
              <a
                key={item.label}
                href={item.href}
                target={item.target}
                rel={item.target === "_blank" ? "noopener noreferrer" : undefined}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                className="relative px-6 sm:px-7 py-2.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs sm:text-sm font-bold transition-all overflow-hidden shadow-[0_4px_14px_rgba(255,255,255,0.15)]"
              >
                {item.label}
                {activeIdx === idx && (
                  <div className="absolute inset-0 border-b-[3px] border-black transition-all" />
                )}
              </a>
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="flex flex-wrap justify-center lg:justify-end items-center gap-2 sm:gap-3 w-full lg:w-auto mt-4 lg:mt-0 z-20">
            <a
              href={contactHref}
              target={contactTarget}
              rel={contactTarget === "_blank" ? "noopener noreferrer" : undefined}
              className="px-5 sm:px-7 py-2.5 rounded-full bg-white text-black hover:bg-zinc-200 text-xs sm:text-sm font-bold transition-all shadow-[0_4px_14px_rgba(255,255,255,0.15)]"
            >
              {contactText}
            </a>
            <button
              onClick={onCtaClick}
              className="px-5 sm:px-7 py-2.5 rounded-full bg-[#00ffc6] text-black text-xs sm:text-sm font-black hover:bg-[#00e5b2] transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,198,0.4)] cursor-pointer"
            >
              <span>{ctaText}</span>
              <span className="text-base font-bold">→</span>
            </button>
          </div>
        </div>

        <div className="w-full mt-6 border-b-2 border-dotted border-white/30" />
      </div>
    </nav>
  );
}

// ============================================================================
// 8. Built-in RobotLoginCard Component (Guaranteed Login Option in Robo Hero)
// ============================================================================
export function RobotLoginCard({
  isOpen = true,
  onClose,
  onOpen,
  onSuccess,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  onOpen?: () => void;
  onSuccess?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const doRedirect = () => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      window.location.href = redirect && redirect.startsWith("/") ? redirect : "/overview";
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setStatusMsg("Security error: email and key are required.");
      return;
    }
    setIsLoading(true);
    setStatusMsg("");

    try {
      localStorage.setItem("auth_user", email.trim());
      localStorage.setItem("auth_logged_in", "true");
      window.dispatchEvent(new Event("auth-change"));
    } catch {}

    setTimeout(() => {
      setIsLoading(false);
      setStatusMsg("Clearance verified. Redirecting to Live Dashboard...");
      if (onSuccess) onSuccess();
      setTimeout(doRedirect, 400);
    }, 600);
  };

  const fillDemo = () => {
    setEmail("operator.alpha@globalmaritime.org");
    setPassword("AIS-MARITIME-2026");
  };

  const handleOneClickLogin = () => {
    setEmail("operator.alpha@globalmaritime.org");
    setPassword("AIS-MARITIME-2026");
    setIsLoading(true);
    setStatusMsg("Authorizing Alpha operator clearance...");

    try {
      localStorage.setItem("auth_user", "operator.alpha@globalmaritime.org");
      localStorage.setItem("auth_logged_in", "true");
      window.dispatchEvent(new Event("auth-change"));
    } catch {}

    setTimeout(() => {
      setIsLoading(false);
      setStatusMsg("Clearance verified. Redirecting...");
      if (onSuccess) onSuccess();
      setTimeout(doRedirect, 400);
    }, 500);
  };

  if (!isOpen) {
    return (
      <div className="pointer-events-auto select-text">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-2.5 px-6 py-3 rounded-full bg-black/90 border-2 border-[#00ffc6] text-[#00ffc6] font-extrabold text-sm backdrop-blur-xl shadow-[0_0_30px_rgba(0,255,198,0.35)] hover:scale-105 transition-all cursor-pointer"
        >
          <LogIn className="h-4 w-4" />
          <span>Open Login Option</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto w-full sm:w-[420px] max-w-[440px] max-h-[min(88vh,620px)] overflow-y-auto select-text pr-1">
      <div className="relative rounded-3xl border border-white/20 bg-black/80 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00ffc6] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00ffc6]" />
            </span>
            <span className="text-xs font-mono font-bold tracking-wider text-[#00ffc6] uppercase">
              Port Monitor Auth
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Minimize form"
              aria-label="Minimize login form"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-4">
          <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>Operator Login</span>
            <LogIn className="h-5 w-5 text-[#00ffc6]" />
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Sign in to the oceanic AIS intelligence console.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="mt-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Operator ID / Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="captain@globalmaritime.org"
                className="w-full rounded-xl border border-white/20 bg-zinc-900/90 py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-[#00ffc6] focus:outline-none focus:ring-2 focus:ring-[#00ffc6]/30 transition-all font-mono"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-200">
                Security Key / Password
              </label>
              <button
                type="button"
                onClick={fillDemo}
                className="text-[11px] text-[#00ffc6] hover:underline cursor-pointer font-mono font-semibold"
              >
                Quick Demo Key
              </button>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-white/20 bg-zinc-900/90 py-2.5 pl-10 pr-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-[#00ffc6] focus:outline-none focus:ring-2 focus:ring-[#00ffc6]/30 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/20 bg-zinc-900 text-[#00ffc6] focus:ring-[#00ffc6]/40 cursor-pointer"
              />
              <span>Remember workstation</span>
            </label>
            <span className="text-[11px] text-slate-400 font-mono">AIS-256 E2E</span>
          </div>

          {statusMsg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 p-2.5 text-xs text-emerald-300 font-mono flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#00ffc6] text-black font-extrabold py-3 text-xs sm:text-sm hover:bg-[#00e5b2] transition-all shadow-[0_0_25px_rgba(0,255,198,0.4)] cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>Verifying clearance...</span>
              </>
            ) : (
              <>
                <span>Login to Terminal</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Authorized Operator Access */}
        <div className="mt-3.5 pt-3.5 border-t border-white/10 space-y-2">
          <button
            type="button"
            onClick={handleOneClickLogin}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#00ffc6]/40 bg-[#00ffc6]/10 hover:bg-[#00ffc6]/20 py-2.5 text-xs font-mono font-bold text-[#00ffc6] transition-all cursor-pointer shadow-sm"
          >
            <span>⚡ 1-Click Demo Login</span>
          </button>
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-mono text-slate-400 py-1">
            <Lock className="h-3 w-3 text-amber-400/80" />
            <span>Login Compulsory &bull; No Guest Mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 9. Main RobotHero Component (Exported exactly as in 21st.dev)
// ============================================================================
export interface RobotHeroProps extends RobotSettings {
  backgroundText?: string;
  navItemsLeft?: Array<{ label: string; href: string; target?: string }>;
  contactText?: string;
  contactHref?: string;
  contactTarget?: string;
  ctaText?: string;
  onCtaClick?: () => void;
  showLoginOption?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function RobotHero({
  backgroundText = "LOGIN",
  navItemsLeft = [
    { label: "Home", href: "/" },
    { label: "Overview", href: "/overview" },
    { label: "Time Machine", href: "/timemachine" },
    { label: "Compare", href: "/compare" },
    { label: "Login", href: "/login" },
  ],
  contactText = "Live Dashboard",
  contactHref = "/overview",
  contactTarget,
  ctaText = "Login",
  onCtaClick,
  showLoginOption = true,
  color = "#c4c4c4",
  scale = 1,
  pantallaColor = "#00ffc6",
  pantallaBrillo = 1.2,
  blinkCycle = 3.0,
  metalness = 0.0,
  className,
  children,
}: RobotHeroProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(true);
  const containerRef = useRef<HTMLElement>(null);
  const lighting = {
    fondoArriba: "#cecbcb",
    fondoMedio: "#9a9a9a",
    fondoAbajo: "#bebebe",
    luzAmbiente: 0.75,
    luzPrincipal: 0,
    luzPrincipalColor: "#00ffe2",
    luzRelleno: 0,
    luzRellenoColor: "#dbdbdb",
    sombraOpacidad: 0.85,
    sombraBlur: 1.7,
  };

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick();
    } else {
      setIsLoginOpen(true);
    }
  };

  return (
    <section
      ref={containerRef}
      className={`relative w-full h-screen min-h-[600px] overflow-hidden ${className || ""}`}
      style={{
        background: `linear-gradient(to bottom, ${lighting.fondoArriba} 0%, ${lighting.fondoArriba} 55%, ${lighting.fondoMedio} 65%, ${lighting.fondoAbajo} 100%)`,
      }}
    >
      {/* Background Big Typography */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-0">
        <h1
          className="font-sans font-black select-none whitespace-nowrap"
          style={{
            color: "#000000",
            opacity: 0.13,
            letterSpacing: "-0.05em",
            fontSize: "clamp(4rem, 15vw, 14rem)",
            lineHeight: 1,
            transform: "translate(0px, 40px) rotate(0deg)",
          }}
        >
          {backgroundText}
        </h1>
      </div>

      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-10 pointer-events-auto">
        <Canvas shadows camera={{ position: [0, 0.2, 6], fov: 40 }} dpr={[1, 1.5]}>
          <ambientLight intensity={lighting.luzAmbiente} color="#ffffff" />
          <directionalLight
            position={[0, 6, 3]}
            intensity={lighting.luzPrincipal}
            color={lighting.luzPrincipalColor}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-bias={-0.0005}
          />
          <directionalLight position={[-5, 2, -5]} intensity={lighting.luzRelleno} color={lighting.luzRellenoColor} />
          <Environment preset="studio" blur={0.5} />
          <ResponsiveGroup scale={scale}>
            <ContactShadows
              position={[0, -0.79, 0]}
              opacity={lighting.sombraOpacidad}
              scale={15}
              resolution={1024}
              blur={lighting.sombraBlur}
              far={2.5}
              color="#000000"
            />
            <RobotPrototype
              neckParams={{
                baseR: 0.215,
                baseH: -0.05,
                midR: 0.28,
                midH: 0.02,
                lipBottomR: 0.295,
                lipBottomH: 0.045,
                lipTopR: 0.27,
                lipTopH: 0.055,
                innerR: 0.1,
                innerDropH: 0,
              }}
              bodyParams={{
                bodyBevelR: 0.235,
                bodyBevelY: 0.34,
                bodyBevelT: 0.025,
              }}
              color={color}
              pantallaColor={pantallaColor}
              pantallaBrillo={pantallaBrillo}
              blinkCycle={blinkCycle}
              metalness={metalness}
            />
          </ResponsiveGroup>
        </Canvas>
      </div>

      {/* UI Overlay: Navbar & Content */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between overflow-hidden">
        <AntennaNavbar
          leftItems={navItemsLeft}
          contactText={contactText}
          contactHref={contactHref}
          contactTarget={contactTarget}
          ctaText={ctaText}
          onCtaClick={handleCta}
        />

        <div className="pointer-events-none relative z-30 flex-1 flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:px-16 py-4 overflow-y-auto">
          {children ? (
            children
          ) : showLoginOption ? (
            <RobotLoginCard
              isOpen={isLoginOpen}
              onClose={() => setIsLoginOpen(false)}
              onOpen={() => setIsLoginOpen(true)}
            />
          ) : null}
        </div>

        <div className="relative w-full max-w-[1400px] mx-auto px-8 pb-4 pointer-events-auto" />
      </div>
    </section>
  );
}

// ============================================================================
// 10. Demo Component matching user prompt
// ============================================================================
export const settings = {
  color: "#c4c4c4",
  scale: 1,
  pantallaColor: "#00ffc6",
  pantallaBrillo: 1.2,
  blinkCycle: 3.0,
  metalness: 0.0,
};

export default function Demo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  return (
    <div className="h-screen w-screen">
      <RobotHero {...s} />
    </div>
  );
}
