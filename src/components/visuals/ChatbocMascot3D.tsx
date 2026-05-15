import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

import { CHATBOC_AGENT_AVATAR } from "@/utils/brandAssets";
import { cn } from "@/lib/utils";

type ChatbocMascot3DProps = {
  className?: string;
  ariaLabel?: string;
  decorative?: boolean;
  intensity?: "nav" | "hero";
};

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reducedMotion;
}

const blueMaterial = new THREE.MeshStandardMaterial({
  color: "#0b56f4",
  metalness: 0.72,
  roughness: 0.28,
});

const blueDarkMaterial = new THREE.MeshStandardMaterial({
  color: "#08248c",
  metalness: 0.82,
  roughness: 0.24,
});

const shellMaterial = new THREE.MeshStandardMaterial({
  color: "#f8fbff",
  metalness: 0.28,
  roughness: 0.34,
});

const visorMaterial = new THREE.MeshStandardMaterial({
  color: "#051445",
  emissive: "#0ea5ff",
  emissiveIntensity: 0.52,
  metalness: 0.5,
  roughness: 0.18,
});

const glowMaterial = new THREE.MeshStandardMaterial({
  color: "#2dd4bf",
  emissive: "#2dd4bf",
  emissiveIntensity: 1.85,
  metalness: 0.2,
  roughness: 0.2,
});

const eyeMaterial = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  emissive: "#dff8ff",
  emissiveIntensity: 1.1,
  roughness: 0.12,
});

function MascotModel({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = React.useRef<THREE.Group>(null);
  const leftArmRef = React.useRef<THREE.Group>(null);
  const rightArmRef = React.useRef<THREE.Group>(null);
  const eyeRef = React.useRef<THREE.Mesh>(null);

  useFrame(({ clock, pointer }) => {
    if (!groupRef.current || reducedMotion) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.42) * 0.12 + pointer.x * 0.08;
    groupRef.current.rotation.x = Math.sin(t * 0.38) * 0.025 - pointer.y * 0.025;
    groupRef.current.position.y = Math.sin(t * 1.2) * 0.035;
    if (leftArmRef.current) leftArmRef.current.rotation.z = -0.42 + Math.sin(t * 1.7) * 0.05;
    if (rightArmRef.current) rightArmRef.current.rotation.z = 0.48 + Math.sin(t * 1.55 + 0.6) * 0.06;
    if (eyeRef.current) eyeRef.current.scale.y = 1 + Math.sin(t * 2.3) * 0.05;
  });

  return (
    <Float speed={reducedMotion ? 0 : 1.4} rotationIntensity={reducedMotion ? 0 : 0.16} floatIntensity={reducedMotion ? 0 : 0.26}>
      <group ref={groupRef} position={[0, -0.08, 0]} scale={0.86}>
        <mesh position={[0, 0.86, 0]}>
          <sphereGeometry args={[0.72, 48, 32]} />
          <primitive object={shellMaterial} attach="material" />
        </mesh>

        <mesh position={[0, 0.78, 0.5]} scale={[1.18, 0.46, 0.22]}>
          <sphereGeometry args={[0.48, 48, 24]} />
          <primitive object={visorMaterial} attach="material" />
        </mesh>

        <mesh ref={eyeRef} position={[-0.22, 0.86, 0.66]} scale={[1, 1.05, 1]}>
          <sphereGeometry args={[0.095, 24, 16]} />
          <primitive object={eyeMaterial} attach="material" />
        </mesh>
        <mesh position={[0.24, 0.86, 0.66]}>
          <sphereGeometry args={[0.095, 24, 16]} />
          <primitive object={eyeMaterial} attach="material" />
        </mesh>
        <mesh position={[-0.17, 0.98, 0.71]} scale={[0.42, 0.38, 0.3]}>
          <sphereGeometry args={[0.035, 16, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </mesh>
        <mesh position={[0.29, 0.98, 0.71]} scale={[0.42, 0.38, 0.3]}>
          <sphereGeometry args={[0.03, 16, 10]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
        </mesh>

        <mesh position={[0, 0.42, 0]} scale={[0.84, 0.74, 0.74]}>
          <capsuleGeometry args={[0.48, 0.55, 18, 36]} />
          <primitive object={blueMaterial} attach="material" />
        </mesh>
        <mesh position={[0, 0.44, 0.48]} scale={[0.6, 0.2, 0.08]}>
          <sphereGeometry args={[0.2, 32, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.22} />
        </mesh>

        <group position={[-0.77, 0.76, 0]} rotation={[0, 0, 0.12]}>
          <mesh>
            <torusGeometry args={[0.24, 0.08, 16, 32]} />
            <primitive object={blueDarkMaterial} attach="material" />
          </mesh>
          <mesh position={[-0.06, 0, 0]}>
            <sphereGeometry args={[0.2, 24, 16]} />
            <primitive object={blueMaterial} attach="material" />
          </mesh>
        </group>
        <group position={[0.77, 0.76, 0]} rotation={[0, 0, -0.12]}>
          <mesh>
            <torusGeometry args={[0.24, 0.08, 16, 32]} />
            <primitive object={blueDarkMaterial} attach="material" />
          </mesh>
          <mesh position={[0.06, 0, 0]}>
            <sphereGeometry args={[0.2, 24, 16]} />
            <primitive object={blueMaterial} attach="material" />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-0.56, 0.42, 0.02]} rotation={[0.1, 0, -0.42]}>
          <mesh position={[-0.25, -0.05, 0]}>
            <capsuleGeometry args={[0.11, 0.54, 12, 20]} />
            <primitive object={blueMaterial} attach="material" />
          </mesh>
          <mesh position={[-0.55, -0.17, 0.06]}>
            <sphereGeometry args={[0.14, 24, 16]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
        </group>
        <group ref={rightArmRef} position={[0.56, 0.42, 0.02]} rotation={[0.08, 0, 0.48]}>
          <mesh position={[0.25, -0.05, 0]}>
            <capsuleGeometry args={[0.11, 0.54, 12, 20]} />
            <primitive object={blueMaterial} attach="material" />
          </mesh>
          <mesh position={[0.55, -0.17, 0.06]}>
            <sphereGeometry args={[0.14, 24, 16]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
        </group>

        <group position={[-0.28, -0.08, 0.02]} rotation={[0, 0, 0.08]}>
          <mesh>
            <capsuleGeometry args={[0.12, 0.36, 12, 20]} />
            <primitive object={blueDarkMaterial} attach="material" />
          </mesh>
          <mesh position={[0, -0.33, 0.08]} scale={[1.2, 0.55, 0.92]}>
            <sphereGeometry args={[0.17, 24, 16]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
        </group>
        <group position={[0.28, -0.08, 0.02]} rotation={[0, 0, -0.08]}>
          <mesh>
            <capsuleGeometry args={[0.12, 0.36, 12, 20]} />
            <primitive object={blueDarkMaterial} attach="material" />
          </mesh>
          <mesh position={[0, -0.33, 0.08]} scale={[1.2, 0.55, 0.92]}>
            <sphereGeometry args={[0.17, 24, 16]} />
            <primitive object={shellMaterial} attach="material" />
          </mesh>
        </group>

        <mesh position={[0.48, 0.2, 0.5]} rotation={[0.1, -0.18, -0.2]}>
          <torusGeometry args={[0.16, 0.026, 10, 32]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>
        <mesh position={[0.52, 0.36, 0.58]}>
          <sphereGeometry args={[0.055, 18, 12]} />
          <primitive object={glowMaterial} attach="material" />
        </mesh>

        <mesh position={[0, -0.53, -0.05]} rotation={[Math.PI / 2, 0, 0]} scale={[1.2, 1.2, 1]}>
          <torusGeometry args={[0.68, 0.018, 10, 96]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.42} />
        </mesh>
      </group>
    </Float>
  );
}

export default function ChatbocMascot3D({
  className,
  ariaLabel = "Chatboc agente IA 3D",
  decorative = false,
  intensity = "hero",
}: ChatbocMascot3DProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [ready, setReady] = React.useState(false);
  const pixelRatio = intensity === "nav" ? [1, 1.25] : [1, 1.65];

  return (
    <span
      className={cn("chatboc-mascot-3d", ready && "chatboc-mascot-3d--ready", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? true : undefined}
    >
      <img className="chatboc-mascot-3d__fallback" src={CHATBOC_AGENT_AVATAR} alt="" draggable={false} />
      <Canvas
        className="chatboc-mascot-3d__canvas"
        camera={{ position: [0, 0.4, 4.65], fov: 36 }}
        dpr={pixelRatio as [number, number]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        frameloop={reducedMotion ? "demand" : "always"}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          setReady(true);
        }}
      >
        <ambientLight intensity={1.75} />
        <directionalLight position={[3.2, 4.8, 4.2]} intensity={2.4} color="#ffffff" />
        <pointLight position={[-2.6, 1.6, 3]} intensity={3.2} color="#38bdf8" />
        <pointLight position={[2.4, 1.2, 2.6]} intensity={1.6} color="#2dd4bf" />
        <React.Suspense fallback={null}>
          <MascotModel reducedMotion={reducedMotion} />
          <ContactShadows
            position={[0, -0.92, 0]}
            opacity={0.32}
            scale={3.1}
            blur={2.4}
            far={1.8}
            resolution={256}
          />
        </React.Suspense>
      </Canvas>
    </span>
  );
}
