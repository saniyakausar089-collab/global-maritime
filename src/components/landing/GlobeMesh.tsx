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
          color="#08182E"
          roughness={0.4}
          metalness={0.6}
          emissive="#22D3EE"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Specular ocean layer */}
      <mesh>
        <sphereGeometry args={[radius + 0.03, 48, 48]} />
        <meshBasicMaterial
          color="#22D3EE"
          wireframe
          transparent
          opacity={0.06}
        />
      </mesh>
    </group>
  );
}

function InnerGlobeMesh({ radius = 10, rotationSpeed = 0.0008, isAngledView = false }: GlobeMeshProps) {
  const globeGroupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

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
          float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 3.2);
          
          // Gradient from deep ocean blue (inner) to electric cyan (outer rim)
          vec3 deepGlow = vec3(0.04, 0.22, 0.55);
          vec3 rimCyan = vec3(0.13, 0.83, 0.93);
          vec3 finalColor = mix(deepGlow, rimCyan, fresnel * 0.9);
          
          float alpha = smoothstep(0.05, 0.85, fresnel) * 0.92;
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
      // Orbit clouds slightly faster than earth rotation
      cloudsRef.current.rotation.y += delta * (rotationSpeed * 1.35);
    }
  });

  return (
    <group ref={globeGroupRef}>
      {/* 1. Main Earth Sphere (NASA Black Marble Night Earth with City Lights) */}
      <mesh receiveShadow castShadow>
        <sphereGeometry args={[radius, 80, 80]} />
        <meshStandardMaterial
          map={nightTexture || null}
          bumpMap={bumpTexture || null}
          bumpScale={0.10}
          roughnessMap={specularTexture || null}
          roughness={0.45}
          metalness={0.5}
          color="#08152B"
          emissiveMap={nightTexture || null}
          emissive="#FFDF9E"
          emissiveIntensity={0.7}
        />
      </mesh>

      {/* 2. Specular Ocean Water Rim Layer */}
      <mesh>
        <sphereGeometry args={[radius + 0.018, 64, 64]} />
        <meshPhysicalMaterial
          roughnessMap={specularTexture || null}
          roughness={0.12}
          metalness={0.85}
          clearcoat={0.95}
          clearcoatRoughness={0.08}
          color="#041224"
          transparent
          opacity={0.35}
          blending={THREE.NormalBlending}
        />
      </mesh>

      {/* 3. Subtle Cloud Layer for Earth-from-Space realism */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[radius + 0.05, 64, 64]} />
        <meshStandardMaterial
          color="#7AB4DE"
          transparent
          opacity={0.07}
          roughness={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Luminous Atmospheric Rim Shell */}
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
