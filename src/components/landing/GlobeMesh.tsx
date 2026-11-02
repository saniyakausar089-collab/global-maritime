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
    console.warn("[GlobeMesh] Texture/Asset error, using fallback procedural globe:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function GlobeFallback({ radius = 10, rotationSpeed = 0.001 }: GlobeMeshProps) {
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
          color="#061830"
          roughness={0.65}
          metalness={0.4}
          emissive="#00e5ff"
          emissiveIntensity={0.08}
        />
      </mesh>
      {/* Specular ocean layer */}
      <mesh>
        <sphereGeometry args={[radius + 0.02, 48, 48]} />
        <meshBasicMaterial
          color="#00e5ff"
          wireframe
          transparent
          opacity={0.07}
        />
      </mesh>
    </group>
  );
}

function InnerGlobeMesh({ radius = 10, rotationSpeed = 0.001, isAngledView = false }: GlobeMeshProps) {
  const globeGroupRef = useRef<THREE.Group>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Load NASA Black Marble textures
  const textures = useTexture([
    "/textures/earth-night.jpg",
    "/textures/earth-topology.png",
    "/textures/earth-specular.png",
  ]) as THREE.Texture[];

  const nightTexture = textures?.[0];
  const bumpTexture = textures?.[1];
  const specularTexture = textures?.[2];

  useMemo(() => {
    if (nightTexture) {
      nightTexture.wrapS = THREE.RepeatWrapping;
      nightTexture.wrapT = THREE.ClampToEdgeWrapping;
      nightTexture.colorSpace = THREE.SRGBColorSpace;
      nightTexture.generateMipmaps = true;
    }

    if (bumpTexture) {
      bumpTexture.wrapS = THREE.RepeatWrapping;
      bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
    }

    if (specularTexture) {
      specularTexture.wrapS = THREE.RepeatWrapping;
      specularTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
  }, [nightTexture, bumpTexture, specularTexture]);

  // Thin teal Fresnel atmosphere shader
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
        uniform vec3 uColor;
        void main() {
          vec3 viewDir = normalize(-vPosition);
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.4);
          float alpha = smoothstep(0.0, 0.9, fresnel) * 0.95;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      uniforms: {
        uColor: { value: new THREE.Color("#00e5ff") },
      },
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
  });

  return (
    <group ref={globeGroupRef}>
      {/* 1. Main Earth Sphere (NASA Black Marble PBR) */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[radius, 72, 72]} />
        <meshStandardMaterial
          map={nightTexture || null}
          bumpMap={bumpTexture || null}
          bumpScale={0.12}
          roughnessMap={specularTexture || null}
          roughness={0.65}
          metalness={0.4}
          color="#061830"
          emissiveMap={nightTexture || null}
          emissive="#ffffff"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* 2. Specular Ocean Water Rim Layer */}
      <mesh>
        <sphereGeometry args={[radius + 0.015, 64, 64]} />
        <meshPhysicalMaterial
          roughnessMap={specularTexture || null}
          roughness={0.18}
          metalness={0.8}
          clearcoat={0.9}
          clearcoatRoughness={0.1}
          color="#020d20"
          transparent
          opacity={0.3}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {/* 3. Thin Teal Fresnel Atmosphere Shell */}
      <mesh ref={atmosphereRef} scale={[1.055, 1.055, 1.055]}>
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
