import React, { Component, useMemo, useRef, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";

interface GlobeMeshProps {
  radius?: number;
  rotationSpeed?: number;
  isAngledView?: boolean;
}

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class GlobeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("[GlobeMesh] Texture error, using procedural fallback:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function GlobeFallback({ radius = 10, rotationSpeed = 0.0008 }: GlobeMeshProps) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * rotationSpeed;
    }
  });

  return (
    <group ref={ref}>
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          color="#1e3a5f"
          roughness={0.3}
          metalness={0.2}
          emissive="#22D3EE"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Specular ocean layer */}
      <mesh>
        <sphereGeometry args={[radius + 0.04, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.12}
        />
      </mesh>
    </group>
  );
}

function InnerGlobeMesh({ radius = 10, rotationSpeed = 0.0008, isAngledView = false }: GlobeMeshProps) {
  const globeGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Load NASA High-Resolution Photorealistic Earth Textures
  const textures = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-clouds.png",
    "/textures/earth-normal.jpg",
    "/textures/earth-specular-map.jpg",
    "/textures/earth-night.jpg",
  ]) as THREE.Texture[];

  const [dayTexture, cloudsTexture, normalTexture, specularTexture, nightTexture] = textures ?? [];

  useMemo(() => {
    if (dayTexture) {
      dayTexture.wrapS = THREE.RepeatWrapping;
      dayTexture.wrapT = THREE.ClampToEdgeWrapping;
      dayTexture.colorSpace = THREE.SRGBColorSpace;
      dayTexture.generateMipmaps = true;
    }
    if (cloudsTexture) {
      cloudsTexture.wrapS = THREE.RepeatWrapping;
      cloudsTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (normalTexture) {
      normalTexture.wrapS = THREE.RepeatWrapping;
      normalTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (specularTexture) {
      specularTexture.wrapS = THREE.RepeatWrapping;
      specularTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (nightTexture) {
      nightTexture.wrapS = THREE.RepeatWrapping;
      nightTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [dayTexture, cloudsTexture, normalTexture, specularTexture, nightTexture]);

  // Deep Blue & Electric Cyan Atmospheric Rim Shader
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.8);
          
          // Realistic Rayleigh atmospheric gradient: Deep blue -> Sky cyan -> High halo
          vec3 deepGlow = vec3(0.08, 0.32, 0.85);
          vec3 rimCyan = vec3(0.25, 0.82, 0.98);
          vec3 finalColor = mix(deepGlow, rimCyan, fresnel);
          
          float alpha = smoothstep(0.02, 0.85, fresnel) * 0.95;
          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  useFrame((_, delta) => {
    if (globeGroupRef.current && !isAngledView) {
      globeGroupRef.current.rotation.y += delta * rotationSpeed;
    }
    if (cloudsRef.current) {
      // Orbit clouds slightly faster than earth rotation for dynamic atmospheric movement
      cloudsRef.current.rotation.y += delta * (rotationSpeed * 1.4);
    }
  });

  return (
    <group ref={globeGroupRef}>
      {/* 1. Main Earth Sphere (NASA Blue Marble with Real Continents & Specular Oceans) */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[radius, 96, 96]} />
        <meshStandardMaterial
          map={dayTexture || null}
          normalMap={normalTexture || null}
          normalScale={new THREE.Vector2(0.85, 0.85)}
          roughnessMap={specularTexture || null}
          roughness={0.42}
          metalness={0.12}
          emissiveMap={nightTexture || null}
          emissive="#FFDF9E"
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* 2. Specular Ocean Water Sheen Layer */}
      <mesh>
        <sphereGeometry args={[radius + 0.025, 80, 80]} />
        <meshPhysicalMaterial
          roughnessMap={specularTexture || null}
          roughness={0.08}
          metalness={0.2}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          color="#0a2a50"
          transparent
          opacity={0.28}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {/* 3. Volumetric Photorealistic Cloud Layer with Realistic Shadows & Drift */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius + 0.09, 80, 80]} />
        <meshStandardMaterial
          map={cloudsTexture || null}
          color="#FFFFFF"
          transparent
          opacity={0.48}
          roughness={0.95}
          metalness={0.05}
          blending={THREE.NormalBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Atmospheric Haze Shell (Rayleigh scattering) */}
      <mesh scale={[1.045, 1.045, 1.045]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <primitive object={atmosphereMaterial} attach="material" />
      </mesh>
    </group>
  );
}

export function GlobeMesh(props: GlobeMeshProps) {
  const fallback = <GlobeFallback radius={props.radius} rotationSpeed={props.rotationSpeed} />;
  return (
    <GlobeErrorBoundary fallback={fallback}>
      <React.Suspense fallback={fallback}>
        <InnerGlobeMesh {...props} />
      </React.Suspense>
    </GlobeErrorBoundary>
  );
}
