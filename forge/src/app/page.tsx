"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { motion, useScroll } from "framer-motion";
import * as THREE from "three";

// --- Premium Procedural Geometries (Centered at 0,0,0) ---

function randomOnRect(w: number, h: number, z: number, axis: 'x' | 'y' | 'z') {
  const a = (Math.random() - 0.5) * w;
  const b = (Math.random() - 0.5) * h;
  if (axis === 'z') return [a, b, z];
  if (axis === 'y') return [a, z, b];
  return [z, a, b];
}

function getDataCorePoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (r < 0.4) {
      // Dense central sphere (core)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rad = Math.cbrt(Math.random()) * 1.0; // Scaled down from 1.8
      points[i*3] = rad * Math.sin(phi) * Math.cos(theta);
      points[i*3+1] = rad * Math.sin(phi) * Math.sin(theta);
      points[i*3+2] = rad * Math.cos(phi);
    } else {
      // Intricate orbital rings
      const ringId = Math.floor(Math.random() * 8); // 8 rings
      const theta = Math.random() * Math.PI * 2;
      const rad = 1.3 + ringId * 0.25 + (Math.random() * 0.05); // Scaled down from 2.2
      
      let bx = Math.cos(theta) * rad;
      let by = (Math.random() - 0.5) * 0.15; // thick rings
      let bz = Math.sin(theta) * rad;
      
      // Tilt ring
      const tilt = (ringId / 8) * Math.PI;
      points[i*3] = bx * Math.cos(tilt) - by * Math.sin(tilt);
      points[i*3+1] = bx * Math.sin(tilt) + by * Math.cos(tilt);
      points[i*3+2] = bz;
    }
  }
  return points;
}

function getServerGridPoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // 10x10 Cityscape / Server Rack Grid (Tighter, scaled down)
    const gx = Math.floor(Math.random() * 10) - 5;
    const gz = Math.floor(Math.random() * 10) - 5;
    
    // Gaussian distribution: Taller buildings in the center, lower on the edges
    const distFromCenter = Math.sqrt(gx*gx + gz*gz);
    const maxH = 4.0;
    const height = maxH * Math.exp(-distFromCenter * 0.4) + Math.random() * 0.5;
    
    const px = gx * 0.45; // Tight spacing
    const pz = gz * 0.45;
    const w = 0.3; // Thinner pillars
    
    let x, y, z;
    const face = Math.random();
    if (face < 0.2) { x = px + (Math.random()-0.5)*w; y = height; z = pz + (Math.random()-0.5)*w; } // Top
    else if (face < 0.4) { x = px + (Math.random()-0.5)*w; y = Math.random()*height; z = pz + w/2; } // Front
    else if (face < 0.6) { x = px + (Math.random()-0.5)*w; y = Math.random()*height; z = pz - w/2; } // Back
    else if (face < 0.8) { x = px + w/2; y = Math.random()*height; z = pz + (Math.random()-0.5)*w; } // Right
    else { x = px - w/2; y = Math.random()*height; z = pz + (Math.random()-0.5)*w; } // Left
    
    // Isometric tilt
    const ty = Math.PI / 4;
    let rx = x * Math.cos(ty) - z * Math.sin(ty);
    let rz = x * Math.sin(ty) + z * Math.cos(ty);
    
    const tx = Math.PI / 6;
    let ry = y * Math.cos(tx) - rz * Math.sin(tx);
    rz = y * Math.sin(tx) + rz * Math.cos(tx);
    
    points[i*3] = rx;
    points[i*3+1] = ry;
    points[i*3+2] = rz;
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
    let bx = x * Math.cos(bank) - y * Math.sin(bank);
    let by = x * Math.sin(bank) + y * Math.cos(bank);

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
    let rx = x * Math.cos(ty) - z * Math.sin(ty);
    let rz = x * Math.sin(ty) + z * Math.cos(ty);
    
    const tx = Math.PI / 6;
    let ry = y * Math.cos(tx) - rz * Math.sin(tx);
    rz = y * Math.sin(tx) + rz * Math.cos(tx);

    points[i*3] = rx;
    points[i*3+1] = ry;
    points[i*3+2] = rz;
  }
  return points;
}

function getRingPoints(count: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    const R = 3.5; 
    const r = Math.random() * 0.8; 
    points[i * 3] = (R + r * Math.cos(v)) * Math.cos(u);
    points[i * 3 + 1] = (R + r * Math.cos(v)) * Math.sin(u);
    points[i * 3 + 2] = r * Math.sin(v);
  }
  return points;
}

// --- Custom GLSL Vertex Shader ---

const vertexShader = `
uniform float uProgress;
uniform float uTime;
uniform float uSpawnTime;
uniform vec3 uOffsets[5]; // Global offsets for the 5 shapes

attribute vec3 position1;
attribute vec3 position2;
attribute vec3 position3;
attribute vec3 position4;
attribute vec3 position5;

// Hash & Noise
float hash(vec3 p) {
  p  = fract( p*0.3183099+.1 );
  p *= 17.0;
  return fract( p.x*p.y*p.z*(p.x+p.y+p.z) );
}

float noise(in vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix(mix(mix( hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)),f.x),
                   mix( hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix( hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)),f.x),
                   mix( hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}

// Curl noise for fluid smoke effects during morphs
vec3 curlNoise(vec3 p) {
    float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    
    float x = noise(p + dy) - noise(p - dy) - noise(p + dz) + noise(p - dz);
    float y = noise(p + dz) - noise(p - dz) - noise(p + dx) + noise(p - dx);
    float z = noise(p + dx) - noise(p - dx) - noise(p + dy) + noise(p - dy);
    
    return normalize(vec3(x, y, z)) * 2.0;
}

void main() {
  // DEDICATED SHAPE ANIMATIONS (applied in local space before offset)
  
  // 1. Data Core: Rings orbit the center at different speeds based on distance
  vec3 p1 = position1;
  float dist1 = length(p1.xz);
  float angle1 = uTime * (1.0 / (dist1 + 0.5));
  float tmpX1 = p1.x * cos(angle1) - p1.z * sin(angle1);
  float tmpZ1 = p1.x * sin(angle1) + p1.z * cos(angle1);
  p1.x = tmpX1; p1.z = tmpZ1;
  
  // 2. Server Grid: Sine wave pulses of electricity moving across the grid
  vec3 p2 = position2;
  p2.y += sin(p2.x * 2.0 + p2.z * 1.5 + uTime * 4.0) * 0.15;
  
  // 3. Delta Jet: Smooth hover banking and violent thruster exhaust
  vec3 p3 = position3;
  p3.y += sin(uTime * 2.0) * 0.3; // Hover
  if (p3.z > 3.0) { // Thrusters at the back
      p3.x += (hash(p3 + uTime) - 0.5) * 0.15;
      p3.y += (hash(p3 + uTime + 1.0) - 0.5) * 0.15;
  }
  
  // 4. Microchip: Energy pulses shooting down the pins
  vec3 p4 = position4;
  p4.y += max(0.0, sin(p4.x * 4.0 + p4.z * 4.0 - uTime * 5.0)) * 0.1;
  
  // 5. Ring: Slow majestic spin
  vec3 p5 = position5;
  float angle5 = uTime * 0.5;
  float tmpX5 = p5.x * cos(angle5) - p5.y * sin(angle5);
  float tmpY5 = p5.x * sin(angle5) + p5.y * cos(angle5);
  p5.x = tmpX5; p5.y = tmpY5;

  // Apply world offsets
  vec3 w1 = p1 + uOffsets[0];
  vec3 w2 = p2 + uOffsets[1];
  vec3 w3 = p3 + uOffsets[2];
  vec3 w4 = p4 + uOffsets[3];
  vec3 w5 = p5 + uOffsets[4];

  // INTERPOLATION & TRANSITION
  vec3 target;
  
  // Use smoothstep to "linger" on fully formed objects at the top and bottom of scrolls
  float t = fract(uProgress);
  float easedT = smoothstep(0.3, 0.7, t); 
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
    float lastT = smoothstep(0.3, 0.7, max(0.0, min(1.0, uProgress - 3.0)));
    target = mix(w4, w5, lastT);
    transitionState = lastT;
  }
  
  // Apply Curl Noise fluid dynamics only during morphing.
  // Because transitionState is eased, sin(PI) is exactly 0 when lingering!
  float noiseIntensity = sin(transitionState * 3.14159) * 2.5;
  vec3 curl = curlNoise(target * 0.5 + uTime * 0.2) * noiseIntensity;
  vec3 finalPos = target + curl;

  // SPAWN ANIMATION (Big Bang)
  float spawnEase = 1.0 - pow(1.0 - uSpawnTime, 4.0); 
  vec3 origin = uOffsets[0]; // Explode from Hero position
  finalPos = mix(origin, finalPos, spawnEase);
  
  vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  gl_PointSize = max(2.0, 50.0 / -mvPosition.z) * (1.0 + noiseIntensity * 0.5) * spawnEase;
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

const PARTICLE_COUNT = 50000;

function ParticleSwarm({ scrollYProgress }: { scrollYProgress: any }) {
  const shaderRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const { viewport } = useThree();
  
  const mountTime = useRef(Date.now());

  // Generate centered buffers
  const buffers = useMemo(() => ({
    pos1: getDataCorePoints(PARTICLE_COUNT),
    pos2: getServerGridPoints(PARTICLE_COUNT),
    pos3: getJetPoints(PARTICLE_COUNT),
    pos4: getMicrochipPoints(PARTICLE_COUNT),
    pos5: getRingPoints(PARTICLE_COUNT) 
  }), []);

  // Define global spatial offsets mapping to DOM
  const offsets = useMemo(() => {
    const vh = viewport.height;
    return [
      new THREE.Vector3(3.0, 0, 0),             // Hero: Right
      new THREE.Vector3(2.5, -vh - 1.0, 0),     // Section 2: Right
      new THREE.Vector3(-2.5, -vh * 2, 0),      // Section 3: Left
      new THREE.Vector3(2.5, -vh * 3, 0),       // Section 4: Right
      new THREE.Vector3(0, -vh * 4 - 0.5, 0),   // Section 5: Center
    ];
  }, [viewport.height]);

  const uniforms = useMemo(() => ({
    uProgress: { value: 0 },
    uTime: { value: 0 },
    uSpawnTime: { value: 0 },
    uOffsets: { value: offsets }
  }), [offsets]);

  useFrame((state) => {
    if (!shaderRef.current || !pointsRef.current) return;
    
    const time = state.clock.getElapsedTime();
    const progress = scrollYProgress.get(); 
    
    const elapsedSpawn = (Date.now() - mountTime.current) / 2500;
    
    shaderRef.current.uniforms.uTime.value = time;
    shaderRef.current.uniforms.uProgress.value = progress * 4.0;
    shaderRef.current.uniforms.uSpawnTime.value = Math.min(1.0, elapsedSpawn);

    // Sync WebGL swarm vertically with native DOM scroll
    pointsRef.current.position.y = progress * (viewport.height * 4.0);
    
    // NOTE: Removed pointsRef.current.rotation to eliminate erratic spinning!
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={buffers.pos1} itemSize={3} />
        <bufferAttribute attach="attributes-position1" count={PARTICLE_COUNT} array={buffers.pos1} itemSize={3} />
        <bufferAttribute attach="attributes-position2" count={PARTICLE_COUNT} array={buffers.pos2} itemSize={3} />
        <bufferAttribute attach="attributes-position3" count={PARTICLE_COUNT} array={buffers.pos3} itemSize={3} />
        <bufferAttribute attach="attributes-position4" count={PARTICLE_COUNT} array={buffers.pos4} itemSize={3} />
        <bufferAttribute attach="attributes-position5" count={PARTICLE_COUNT} array={buffers.pos5} itemSize={3} />
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

// --- The Minimalist DOM Overlay ---

function MinimalDOM() {
  return (
    <div className="w-full text-[#111]">
      <section className="h-screen w-full flex items-center px-6 md:px-24 pointer-events-none">
        <div className="max-w-[700px]">
          <h1 className="sans-text text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-8 leading-[0.9]">
            Clarity over<br/>intuition.
          </h1>
          <p className="sans-text text-xl md:text-2xl font-medium text-[#6B6B6B]">
            We ingest 30 days of raw PostHog data and algorithmically map the friction points breaking your architecture.
          </p>
        </div>
      </section>

      <section className="h-screen w-full flex items-start pt-[20vh] px-6 md:px-24 pointer-events-none">
        <div className="max-w-[500px]">
          <h2 className="sans-text text-5xl md:text-7xl font-bold tracking-tight mb-6">The Audit.</h2>
          <p className="sans-text text-xl md:text-2xl text-[#6B6B6B]">
            A website isn't art. It's a conversion engine. We don't guess what's wrong—we mathematically map your entire user journey to isolate where revenue is bleeding.
          </p>
        </div>
      </section>

      <section className="h-screen w-full flex items-start justify-end pt-[20vh] px-6 md:px-24 text-right pointer-events-none">
        <div className="max-w-[500px]">
          <h2 className="sans-text text-5xl md:text-7xl font-bold tracking-tight mb-6">The Aerodynamics.</h2>
          <p className="sans-text text-xl md:text-2xl text-[#6B6B6B]">
            Once the leaks are isolated, we provide the precise code-level patches needed to remove drag and lift your conversion rates to the stratosphere.
          </p>
        </div>
      </section>

      <section className="h-screen w-full flex items-start pt-[20vh] px-6 md:px-24 pointer-events-none">
        <div className="max-w-[500px]">
          <h2 className="sans-text text-5xl md:text-7xl font-bold tracking-tight mb-6">The Engine.</h2>
          <p className="sans-text text-xl md:text-2xl text-[#6B6B6B]">
            We don't deal in generic best practices. Every UI intervention is backed by pure certainty extracted exclusively from your own traffic.
          </p>
        </div>
      </section>

      <section className="h-screen w-full flex flex-col items-center justify-center text-center px-6">
        <h2 className="sans-text text-5xl md:text-8xl font-bold tracking-tighter mb-12 pointer-events-none">
          Ready to Forge?
        </h2>
        <button className="bg-[#111] text-white px-12 py-6 rounded-full sans-text text-2xl font-bold shadow-2xl hover:scale-105 transition-transform pointer-events-auto">
          Start the Audit
        </button>
      </section>
    </div>
  );
}

// --- Main Application ---

export default function Home() {
  const { scrollYProgress } = useScroll();

  return (
    <main className="relative w-full bg-[#FAFAF8] text-[#111]">
      <header className="fixed top-0 left-0 w-full px-6 py-8 flex items-center justify-between z-50 pointer-events-none">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-[#111]" />
          <span className="text-xl font-bold tracking-tight text-[#111] sans-text">Forge</span>
        </div>
        <div className="sans-text font-bold tracking-widest uppercase text-xs text-[#6B6B6B]">
          Precision Engineering
        </div>
      </header>

      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <Canvas camera={{ position: [0, 0, 10], fov: 45 }}>
          <ambientLight intensity={1} />
          <Environment preset="city" />
          <ParticleSwarm scrollYProgress={scrollYProgress} />
        </Canvas>
      </div>

      <div className="relative z-10 w-full">
        <MinimalDOM />
      </div>
    </main>
  );
}
