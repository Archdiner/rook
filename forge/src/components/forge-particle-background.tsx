"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// --- Premium Procedural Geometries (Centered at 0,0,0) ---

function getSpawnPoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Scatter across screen-space: moderate X and Y, shallow Z to prevent them from being too spread out
    const x = (Math.random() - 0.5) * 40;
    const y = (Math.random() - 0.5) * 40;
    const z = (Math.random() - 0.5) * 20 - 5;
    points[i*3] = x;
    points[i*3+1] = y;
    points[i*3+2] = z;
  }
  return points;
}

function getDataCorePoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.15) {
      // Inner Dense Nucleus
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = Math.cbrt(Math.random()) * 0.4;
      points[i*3] = rad * Math.sin(phi) * Math.cos(theta);
      points[i*3+1] = rad * Math.sin(phi) * Math.sin(theta);
      points[i*3+2] = rad * Math.cos(phi);
    } else if (r < 0.35) {
      // Outer Spherical Shell
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = 0.9 + (Math.random() * 0.05);
      points[i*3] = rad * Math.sin(phi) * Math.cos(theta);
      points[i*3+1] = rad * Math.sin(phi) * Math.sin(theta);
      points[i*3+2] = rad * Math.cos(phi);
    } else {
      // Omni-Directional Orbital Rings
      const ringId = Math.floor(Math.random() * 12);
      const theta = Math.random() * Math.PI * 2;
      const rad = 1.3 + (ringId % 4) * 0.25 + (Math.random() * 0.05);
      
      const bx = Math.cos(theta) * rad;
      const by = Math.sin(theta) * rad;
      const bz = (Math.random() - 0.5) * 0.15;
      
      const rotX = (ringId * 13.1) % (Math.PI * 2);
      const rotY = (ringId * 7.7) % (Math.PI * 2);
      const rotZ = (ringId * 19.3) % (Math.PI * 2);
      
      const y1 = by * Math.cos(rotX) - bz * Math.sin(rotX);
      const z1 = by * Math.sin(rotX) + bz * Math.cos(rotX);
      const x2 = bx * Math.cos(rotY) + z1 * Math.sin(rotY);
      const z2 = -bx * Math.sin(rotY) + z1 * Math.cos(rotY);
      const x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ);
      const y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ);
      
      points[i*3] = x3;
      points[i*3+1] = y3;
      points[i*3+2] = z2;
    }
  }
  return points;
}

function getDNAPoints(count: number) {
  const points = new Float32Array(count * 3);
  const height = 11.0;
  const radius = 2.0;
  const turns = 2.5;
  const numSteps = 40; // Horizontal rungs

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const t = Math.random() - 0.5; // -0.5 to 0.5 (bottom to top)
    const y = t * height;
    const angle = t * Math.PI * 2 * turns;
    
    if (r < 0.3) {
      // Backbone 1
      const noiseX = (Math.random() - 0.5) * 0.3;
      const noiseZ = (Math.random() - 0.5) * 0.3;
      points[i*3] = Math.cos(angle) * radius + noiseX;
      points[i*3+1] = y + (Math.random() - 0.5) * 0.2;
      points[i*3+2] = Math.sin(angle) * radius + noiseZ;
    } else if (r < 0.6) {
      // Backbone 2 (180 degrees offset)
      const noiseX = (Math.random() - 0.5) * 0.3;
      const noiseZ = (Math.random() - 0.5) * 0.3;
      points[i*3] = Math.cos(angle + Math.PI) * radius + noiseX;
      points[i*3+1] = y + (Math.random() - 0.5) * 0.2;
      points[i*3+2] = Math.sin(angle + Math.PI) * radius + noiseZ;
    } else {
      // Connecting rungs
      const stepT = (Math.floor((t + 0.5) * numSteps) / numSteps) - 0.5;
      const stepY = stepT * height;
      const stepAngle = stepT * Math.PI * 2 * turns;
      
      const bridgeT = Math.random(); // 0 to 1 across the rung
      const x1 = Math.cos(stepAngle) * radius;
      const z1 = Math.sin(stepAngle) * radius;
      const x2 = Math.cos(stepAngle + Math.PI) * radius;
      const z2 = Math.sin(stepAngle + Math.PI) * radius;
      
      points[i*3] = x1 * (1 - bridgeT) + x2 * bridgeT + (Math.random() - 0.5) * 0.2;
      points[i*3+1] = stepY + (Math.random() - 0.5) * 0.2;
      points[i*3+2] = z1 * (1 - bridgeT) + z2 * bridgeT + (Math.random() - 0.5) * 0.2;
    }
    
    // Tilt the whole DNA strand slightly for a cinematic angle
    const tilt = Math.PI / 8;
    const px = points[i*3];
    const py = points[i*3+1];
    points[i*3] = px * Math.cos(tilt) - py * Math.sin(tilt);
    points[i*3+1] = px * Math.sin(tilt) + py * Math.cos(tilt);
  }
  return points;
}

function getJetPoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let x = 0, y = 0, z = 0;
    
    if (r < 0.35) {
      // Fuselage: Cylinder with aerodynamic nose and tail cones
      const theta = Math.random() * Math.PI * 2;
      const t = Math.random(); // 0 (front) to 1 (back)
      const length = 7.0;
      z = (t - 0.5) * length;
      
      let radius = 0.4;
      if (t < 0.15) radius = 0.4 * Math.sin((t / 0.15) * (Math.PI / 2)); // Nose curve
      else if (t > 0.8) radius = 0.4 * Math.sin(((1.0 - t) / 0.2) * (Math.PI / 2)); // Tail curve
      
      x = Math.cos(theta) * radius;
      y = Math.sin(theta) * radius;
    } else if (r < 0.65) {
      // Main Wings: Classic swept-back commercial wings
      const side = Math.random() > 0.5 ? 1 : -1;
      const span = Math.random() * 4.0; // wing length
      const chord = 1.2 * (1.0 - span / 4.0) + Math.random() * 0.4; // tapers at end
      x = side * (0.3 + span);
      y = 0;
      z = -0.5 + span * 0.6 + (Math.random() - 0.5) * chord; // Swept back
    } else if (r < 0.8) {
      // Horizontal Stabilizers (Rear small wings)
      const side = Math.random() > 0.5 ? 1 : -1;
      const span = Math.random() * 1.5;
      x = side * (0.2 + span);
      y = 0;
      z = 2.8 + span * 0.5 + (Math.random() - 0.5) * 0.6;
    } else if (r < 0.9) {
      // Vertical Tail Fin
      const h = Math.random() * 1.8;
      x = 0;
      y = 0.3 + h;
      z = 2.8 + h * 0.6 + (Math.random() - 0.5) * 0.6;
    } else {
      // Under-wing Engines
      const side = Math.random() > 0.5 ? 1 : -1;
      const theta = Math.random() * Math.PI * 2;
      const rad = 0.18;
      x = side * 1.2 + Math.cos(theta) * rad;
      y = -0.2 + Math.sin(theta) * rad;
      z = 0.2 + (Math.random() - 0.5) * 0.8;
    }
    
    // Bank angle
    const bank = -Math.PI / 10;
    const bx = x * Math.cos(bank) - y * Math.sin(bank);
    const by = x * Math.sin(bank) + y * Math.cos(bank);

    points[i*3] = bx;
    points[i*3+1] = by;
    points[i*3+2] = z;
  }
  return points;
}

function getMicrochipPoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    let x, y, z;
    if (r < 0.3) {
      // Central Die (Raised)
      const s = 2.0;
      const face = Math.random();
      if (face < 0.2) { x = (Math.random()-0.5)*s; y = 0.4; z = (Math.random()-0.5)*s; } 
      else if (face < 0.4) { x = (Math.random()-0.5)*s; y = Math.random()*0.4; z = s/2; } 
      else if (face < 0.6) { x = (Math.random()-0.5)*s; y = Math.random()*0.4; z = -s/2; } 
      else if (face < 0.8) { x = s/2; y = Math.random()*0.4; z = (Math.random()-0.5)*s; } 
      else { x = -s/2; y = Math.random()*0.4; z = (Math.random()-0.5)*s; } 
    } else if (r < 0.5) {
      // Flat Substrate base
      const s = 6.0;
      x = (Math.random() - 0.5) * s;
      y = 0;
      z = (Math.random() - 0.5) * s;
    } else {
      // Circuit Pins
      const s = 6.0;
      const side = Math.floor(Math.random() * 4);
      const pos = (Math.random() - 0.5) * s; 
      const pinLength = Math.random() * 0.8 + 0.2; 
      const pinDrop = Math.random() * 0.6; 
      
      const part = Math.random();
      if (side === 0) { 
        if (part < 0.5) { x = pos; y = 0; z = -s/2 - pinLength * Math.random(); }
        else { x = pos; y = -pinDrop * Math.random(); z = -s/2 - pinLength; }
      } else if (side === 1) { 
        if (part < 0.5) { x = pos; y = 0; z = s/2 + pinLength * Math.random(); }
        else { x = pos; y = -pinDrop * Math.random(); z = s/2 + pinLength; }
      } else if (side === 2) { 
        if (part < 0.5) { x = s/2 + pinLength * Math.random(); y = 0; z = pos; }
        else { x = s/2 + pinLength; y = -pinDrop * Math.random(); z = pos; }
      } else { 
        if (part < 0.5) { x = -s/2 - pinLength * Math.random(); y = 0; z = pos; }
        else { x = -s/2 - pinLength; y = -pinDrop * Math.random(); z = pos; }
      }
    }
    
    // Isometric Tilt
    const ty = Math.PI / 4;
    const rx = x * Math.cos(ty) - z * Math.sin(ty);
    let rz = x * Math.sin(ty) + z * Math.cos(ty);
    
    const tx = Math.PI / 6;
    const ry = y * Math.cos(tx) - rz * Math.sin(tx);
    rz = y * Math.sin(tx) + rz * Math.cos(tx);

    points[i*3] = rx;
    points[i*3+1] = ry;
    points[i*3+2] = rz;
  }
  return points;
}

function getSilkWavePoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // Generate an incredibly wide, deep plane
    const x = (Math.random() - 0.5) * 40; // Spread wide
    const z = (Math.random() - 0.5) * 30; // Spread deep
    
    // Baseline structural curve (adds volume to the flat plane)
    const y = Math.sin(x * 0.15) * 2.0 + Math.cos(z * 0.15) * 2.0;
    
    points[i * 3] = x;
    points[i * 3 + 1] = y - 4.0; // Offset down to sit behind the CTA button
    points[i * 3 + 2] = z;
  }
  return points;
}

// --- Custom GLSL Vertex Shader ---

const vertexShader = `
  attribute vec3 spawnPos;
  attribute vec3 position1;
  attribute vec3 position2;
  attribute vec3 position3;
  attribute vec3 position4;
  attribute vec3 position5;

  uniform float uTime;
  uniform float uProgress;
  uniform float uSpawnTime;
  uniform float uScale;
  uniform float uMobile;
  uniform vec3 uOffsets[5];

// Hash & Noise
float hash(vec3 p) {
  p  = fract( p*0.3183099+.1 );
  p *= 17.0;
  return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}

// Cheaper turbulence to replace expensive curl noise
vec3 cheapTurbulence(vec3 p) {
    float x = sin(p.y * 3.0) + cos(p.z * 2.0);
    float y = sin(p.z * 3.0) + cos(p.x * 2.0);
    float z = sin(p.x * 3.0) + cos(p.y * 2.0);
    return vec3(x, y, z) * 0.5;
}

void main() {
  // 1. Data Core: Rings orbit the center at different speeds
  vec3 p1 = position1 * uScale;
  float dist1 = length(p1.xz);
  float angle1 = uTime * (0.4 / (dist1 + 0.5));
  float tmpX1 = p1.x * cos(angle1) - p1.z * sin(angle1);
  float tmpZ1 = p1.x * sin(angle1) + p1.z * cos(angle1);
  p1.x = tmpX1; p1.z = tmpZ1;

  // 2. DNA Helix: Majestic slow rotation around Y-axis
  vec3 p2 = position2 * uScale;
  float dnaAngle = uTime * 0.2;
  float tmpX2 = p2.x * cos(dnaAngle) - p2.z * sin(dnaAngle);
  float tmpZ2 = p2.x * sin(dnaAngle) + p2.z * cos(dnaAngle);
  p2.x = tmpX2; p2.z = tmpZ2;
  
  // 3. Jet: Smooth hover and thruster exhaust
  vec3 p3 = position3 * uScale;
  p3.y += sin(uTime * 1.5) * 0.3 * uScale;
  if (p3.z > 3.0 * uScale) {
      float thrusterIntensity = 0.15 * (1.0 - uMobile * 0.5);
      p3.x += (hash(p3 + uTime) - 0.5) * thrusterIntensity;
      p3.y += (hash(p3 + uTime + 1.0) - 0.5) * thrusterIntensity;
  }
  
  // 4. Microchip: Energy pulses
  vec3 p4 = position4 * uScale;
  p4.y += max(0.0, sin(p4.x * 4.0 + p4.z * 4.0 - uTime * 3.0)) * 0.1 * uScale; 
  
  // 5. Silk Wave: Ocean-like undulation
  vec3 p5 = position5 * uScale;
  float waveIntensity = 1.0 - uMobile * 0.4;
  p5.y += (sin(p5.x * 0.3 + uTime * 0.6) * 1.2 + cos(p5.z * 0.4 + uTime * 0.4) * 0.8) * waveIntensity;

  // Apply world offsets
  vec3 w1 = p1 + uOffsets[0];
  vec3 w2 = p2 + uOffsets[1];
  vec3 w3 = p3 + uOffsets[2];
  vec3 w4 = p4 + uOffsets[3];
  vec3 w5 = p5 + uOffsets[4];

  // INTERPOLATION & TRANSITION
  vec3 target;
  
  // Use smoothstep to "linger" on fully formed objects, but widened (0.1 to 0.9) to make morphing slower and more fluid
  float t = fract(uProgress);
  float easedT = smoothstep(0.1, 0.9, t); 
  float transitionState = 0.0;
  
  if (uProgress < 1.0) {
    target = mix(w1, w2, easedT);
    transitionState = easedT;
  } else if (uProgress < 2.0) {
    target = mix(w2, w3, easedT);
    transitionState = easedT;
  } else if (uProgress < 3.0) {
    target = mix(w3, w4, easedT);
    transitionState = easedT;
  } else {
    float lastT = smoothstep(0.1, 0.9, max(0.0, min(1.0, uProgress - 3.0)));
    target = mix(w4, w5, lastT);
    transitionState = lastT;
  }
  
  // Apply cheaper turbulence fluid dynamics only during morphing.
  // On mobile, reduce intensity significantly for performance
  float curlScale = 1.2 * (1.0 - uMobile * 0.6);
  float noiseIntensity = sin(transitionState * 3.14159) * curlScale;
  // Drive turbulence partially by scroll progress so it feels physically connected to scrolling
  vec3 curl = cheapTurbulence(target * 0.5 + vec3(0.0, uProgress * 2.0, uTime * 0.2)) * noiseIntensity;
  vec3 finalPos = target + curl;

  // SPAWN ANIMATION (Chaotic Coalescence)
  float spawnEase = 1.0 - pow(1.0 - uSpawnTime, 4.0); 
  
  // Particles start fully scattered from the dedicated spawnPos buffer
  vec3 chaoticStart = spawnPos;
  
  // Add extreme turbulence during the spawn phase so they take curved, flowing paths inward
  float spawnTurbulence = (1.0 - spawnEase) * 4.0; 
  vec3 spawnCurl = cheapTurbulence(chaoticStart * 0.1 + uTime) * spawnTurbulence;
  chaoticStart += spawnCurl;
  
  finalPos = mix(chaoticStart, finalPos, spawnEase);
  
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  gl_PointSize = max(1.0, (50.0 - uMobile * 20.0) / -mvPosition.z) * (1.0 + noiseIntensity * 0.3) * spawnEase;
}
`;

const fragmentShader = `
void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.3, dist) * 0.8;
  gl_FragColor = vec4(0.066, 0.066, 0.066, alpha); // #111111
}
`;

// --- The GPU Particle Swarm ---

const PARTICLE_COUNT_DESKTOP = 50000;
const PARTICLE_COUNT_MOBILE = 30000;

function ParticleSwarm() {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport, size } = useThree();
  
  const isMobile = size.width < 768;
  const PARTICLE_COUNT = isMobile ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
  const shapeScale = isMobile ? 0.75 : 1.0;
  
  const mountTimeRef = useRef<number | null>(null);

  // Generate centered buffers
  const buffers = useMemo(() => ({
    spawn: getSpawnPoints(PARTICLE_COUNT),
    pos1: getDataCorePoints(PARTICLE_COUNT),
    pos2: getDNAPoints(PARTICLE_COUNT),
    pos3: getJetPoints(PARTICLE_COUNT),
    pos4: getMicrochipPoints(PARTICLE_COUNT),
    pos5: getSilkWavePoints(PARTICLE_COUNT) 
   
  }), [PARTICLE_COUNT]);

  // Define global spatial offsets mapping to DOM — responsive
  const offsets = useMemo(() => {
    const vh = viewport.height;
    if (isMobile) {
      // Per-shape offsets tuned to each shape's actual geometry
      // Data Core: compact (~2.5u radius). Sits just above center
      // DNA: VERY tall (11u). Must be pushed far up so bottom doesn't cover text
      // Jet: long but not tall (~2u height). Moderate offset
      // Microchip: wide, flat (~3u height). Moderate offset
      // Silk Wave: huge, flat. Centered for CTA
      return [
        new THREE.Vector3(0, vh * 0.08, -1),                    // Hero: Data Core just above center
        new THREE.Vector3(0, -vh + vh * 0.35, -1),              // Section 2: DNA pushed HIGH
        new THREE.Vector3(0, -vh * 2 + vh * 0.12, -1),          // Section 3: Jet moderate
        new THREE.Vector3(0, -vh * 3 + vh * 0.12, -1),          // Section 4: Microchip moderate
        new THREE.Vector3(0, -vh * 4 - 0.5, -1),                // Section 5: Silk wave CTA
      ];
    }
    return [
      new THREE.Vector3(3.0, 0, 0),             // Hero: Right
      new THREE.Vector3(2.5, -vh - 1.0, 0),     // Section 2: Right
      new THREE.Vector3(-2.5, -vh * 2, 0),      // Section 3: Left
      new THREE.Vector3(2.5, -vh * 3, 0),       // Section 4: Right
      new THREE.Vector3(0, -vh * 4 - 0.5, 0),   // Section 5: Center
    ];
  }, [viewport.height, isMobile]);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uSpawnTime: { value: 0 },
    uScale: { value: shapeScale },
    uMobile: { value: isMobile ? 1.0 : 0.0 },
    uOffsets: { value: offsets }
   
  }), [offsets, shapeScale, isMobile]);

  useFrame((state) => {
    if (!shaderRef.current || !pointsRef.current) return;
    
    const time = state.clock.getElapsedTime();
    
    // Use native scroll for zero-latency syncing
    // Clamp scrollY to prevent negative values (overscroll bounce on Mac/iOS)
    const scrollY = Math.max(0, window.scrollY);
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = scrollY / maxScroll;
    
    // Slower spawn: 3 seconds on desktop, 1.5 seconds on mobile for snappier feel
    const spawnDuration = isMobile ? 1500 : 3000;
    if (mountTimeRef.current === null) {
      mountTimeRef.current = Date.now();
    }
    const elapsedSpawn = (Date.now() - mountTimeRef.current) / spawnDuration;
    
    shaderRef.current.uniforms.uTime.value = time;
    shaderRef.current.uniforms.uProgress.value = progress * 4.0;
    shaderRef.current.uniforms.uSpawnTime.value = Math.min(1.0, elapsedSpawn);

    // Sync WebGL swarm vertically with native DOM scroll
    pointsRef.current.position.y = progress * (viewport.height * 4.0);
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.pos1, 3]} />
        <bufferAttribute attach="attributes-spawnPos" args={[buffers.spawn, 3]} />
        <bufferAttribute attach="attributes-position1" args={[buffers.pos1, 3]} />
        <bufferAttribute attach="attributes-position2" args={[buffers.pos2, 3]} />
        <bufferAttribute attach="attributes-position3" args={[buffers.pos3, 3]} />
        <bufferAttribute attach="attributes-position4" args={[buffers.pos4, 3]} />
        <bufferAttribute attach="attributes-position5" args={[buffers.pos5, 3]} />
      </bufferGeometry>
      <shaderMaterial
        ref={shaderRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
}

/** Same GPU black-particle field as the homepage — fixed behind content. */
export function ForgeParticleCanvas() {
  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
      <Canvas camera={{ position: [0, 0, 10], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={1} />
        <ParticleSwarm />
      </Canvas>
    </div>
  );
}
