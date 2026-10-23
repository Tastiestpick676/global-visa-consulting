// components/landing/ConsularGlobe.tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

const CONSULAR_HUBS = [
  { code: "BOG", lat: 4.711, lng: -74.0721, isPrimary: true }, // Bogotá
  { code: "MDE", lat: 6.2442, lng: -75.5812, isPrimary: true }, // Medellín
  { code: "IAD", lat: 38.9072, lng: -77.0369, isPrimary: true }, // Washington D.C.
  { code: "MIA", lat: 25.7617, lng: -80.1918, isPrimary: true }, // Miami
  { code: "JFK", lat: 40.7128, lng: -74.006, isPrimary: true }, // New York
  { code: "LAX", lat: 34.0522, lng: -118.2437, isPrimary: false }, // Los Angeles
  { code: "NRT", lat: 35.6762, lng: 139.6503, isPrimary: true }, // Tokio
  { code: "KIX", lat: 34.6937, lng: 135.5023, isPrimary: true }, // Osaka
  { code: "YYZ", lat: 43.6532, lng: -79.3832, isPrimary: false }, // Toronto
  { code: "LHR", lat: 51.5072, lng: -0.1276, isPrimary: false }, // Londres
  { code: "MAD", lat: 40.4168, lng: -3.7038, isPrimary: false }, // Madrid
  { code: "SYD", lat: -33.8688, lng: 151.2093, isPrimary: false }, // Sídney
];

const VISA_CORRIDORS: [number, number][] = [
  [0, 2], // Bogotá -> Washington D.C.
  [0, 3], // Bogotá -> Miami
  [0, 4], // Bogotá -> New York
  [1, 3], // Medellín -> Miami
  [0, 5], // Bogotá -> Los Angeles
  [0, 6], // Bogotá -> Tokio
  [0, 7], // Bogotá -> Osaka
  [2, 6], // Washington -> Tokio
  [0, 8], // Bogotá -> Toronto
  [0, 9], // Bogotá -> Londres
  [0, 10], // Bogotá -> Madrid
  [6, 11], // Tokio -> Sídney
];

const CONTINENT_REGIONS = [
  { latMin: 18, latMax: 68, lngMin: -128, lngMax: -62 }, // Norteamérica
  { latMin: 7, latMax: 18, lngMin: -92, lngMax: -77 }, // Centroamérica
  { latMin: -54, latMax: 12, lngMin: -81, lngMax: -35 }, // Sudamérica
  { latMin: 36, latMax: 70, lngMin: -10, lngMax: 42 }, // Europa
  { latMin: -34, latMax: 36, lngMin: -17, lngMax: 51 }, // África
  { latMin: 12, latMax: 68, lngMin: 42, lngMax: 130 }, // Asia
  { latMin: 30, latMax: 45, lngMin: 129, lngMax: 146 }, // Japón
  { latMin: -39, latMax: -12, lngMin: 113, lngMax: 154 }, // Australia
];

function isLand(lat: number, lng: number): boolean {
  return CONTINENT_REGIONS.some(
    (r) =>
      lat >= r.latMin && lat <= r.latMax && lng >= r.lngMin && lng <= r.lngMax
  );
}

export default function ConsularGlobe() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 640;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5.6);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const RADIUS = 1.42;

    // 1. Esfera interior blanca sólida
    const innerCoreGeo = new THREE.SphereGeometry(RADIUS * 0.97, 36, 36);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    globeGroup.add(new THREE.Mesh(innerCoreGeo, innerCoreMat));

    // 2. Malla Geodésica en escala de grises
    const wireGeo = new THREE.SphereGeometry(RADIUS * 0.995, 24, 18);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xd1d5db,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    globeGroup.add(new THREE.Mesh(wireGeo, wireMat));

    // 3. Anillo Ecuatorial Técnico
    const orbitGeo = new THREE.RingGeometry(RADIUS * 1.12, RADIUS * 1.126, 96);
    const orbitMat = new THREE.MeshBasicMaterial({
      color: 0x9ca3af,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
    orbitMesh.rotation.x = Math.PI / 2.25;
    orbitMesh.rotation.y = -0.2;
    globeGroup.add(orbitMesh);

    // 4. Puntos Continentales en Escala de Grises
    const landCoords: number[] = [];
    for (let lat = -56; lat <= 70; lat += 2.5) {
      const cosLat = Math.max(0.25, Math.cos((lat * Math.PI) / 180));
      const lngStep = 2.5 / cosLat;
      for (let lng = -175; lng <= 175; lng += lngStep) {
        if (isLand(lat, lng)) {
          const pt = latLngToVector3(lat, lng, RADIUS * 1.003);
          landCoords.push(pt.x, pt.y, pt.z);
        }
      }
    }

    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(landCoords, 3)
    );
    const landMat = new THREE.PointsMaterial({
      color: 0x4b5563,
      size: 0.025,
      transparent: true,
      opacity: 0.55,
    });
    globeGroup.add(new THREE.Points(landGeo, landMat));

    // 5. Puntos Consulares en Rojo (#E11D48)
    const hubVectors = CONSULAR_HUBS.map((h) =>
      latLngToVector3(h.lat, h.lng, RADIUS * 1.01)
    );

    const hubSphereGeo = new THREE.SphereGeometry(0.032, 12, 12);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xe11d48 });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x111315 });
    const pulseRingGeo = new THREE.RingGeometry(0.042, 0.062, 24);
    const pulseRings: THREE.Mesh[] = [];

    hubVectors.forEach((vec, idx) => {
      const isPrimary = CONSULAR_HUBS[idx].isPrimary;
      const dot = new THREE.Mesh(hubSphereGeo, isPrimary ? redMat : darkMat);
      dot.position.copy(vec);
      globeGroup.add(dot);

      if (isPrimary) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xe11d48,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        });
        const ring = new THREE.Mesh(pulseRingGeo, ringMat);
        ring.position.copy(vec.clone().multiplyScalar(1.004));
        ring.lookAt(new THREE.Vector3(0, 0, 0));
        globeGroup.add(ring);
        pulseRings.push(ring);
      }
    });

    // 6. Arcos Parabólicos en Rojo (#E11D48)
    const curves: THREE.QuadraticBezierCurve3[] = [];
    const arcLineMat = new THREE.LineBasicMaterial({
      color: 0xe11d48,
      transparent: true,
      opacity: 0.8,
    });

    VISA_CORRIDORS.forEach(([fromIdx, toIdx]) => {
      const start = hubVectors[fromIdx];
      const end = hubVectors[toIdx];
      const dist = start.distanceTo(end);

      const mid = start
        .clone()
        .add(end)
        .multiplyScalar(0.5)
        .normalize()
        .multiplyScalar(RADIUS + dist * 0.24);

      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      curves.push(curve);

      const pts = curve.getPoints(44);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      globeGroup.add(new THREE.Line(lineGeo, arcLineMat));
    });

    const travelerGeo = new THREE.SphereGeometry(0.024, 10, 10);
    const travelers = curves.map((curve, i) => {
      const mesh = new THREE.Mesh(travelerGeo, redMat);
      globeGroup.add(mesh);
      return {
        mesh,
        curve,
        progress: (i * 0.19) % 1,
        speed: 0.0035 + (i % 3) * 0.0008,
      };
    });

    // Escala inicial en el Hero: 1.24x más grande. Al bajar a la 1ra sección regresa a 1.0x
    const HERO_SCALE = 1.24;
    const SCROLLED_SCALE = 1.0;

    let targetRotY = -1.25;
    let targetRotX = 0.22;
    let targetScale = HERO_SCALE;
    let currentScale = HERO_SCALE;

    globeGroup.rotation.y = targetRotY;
    globeGroup.rotation.x = targetRotX;
    globeGroup.scale.set(currentScale, currentScale, currentScale);

    const handleScroll = () => {
      const scrollY = window.scrollY || 0;
      const maxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const progress = Math.min(1, Math.max(0, scrollY / maxScroll));

      // Transición progresiva de escala durante los primeros 450px de scroll (del Hero a la 1ra sección)
      const heroTransition = Math.min(1, Math.max(0, scrollY / 450));
      targetScale =
        HERO_SCALE - heroTransition * (HERO_SCALE - SCROLLED_SCALE);

      targetRotY = -1.25 + progress * Math.PI * 1.6;
      targetRotX = 0.22 + Math.sin(progress * Math.PI) * 0.16;
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    let reqId: number;
    let clock = 0;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      clock += 0.0018;

      const desiredY = targetRotY + clock;
      globeGroup.rotation.y += (desiredY - globeGroup.rotation.y) * 0.06;
      globeGroup.rotation.x += (targetRotX - globeGroup.rotation.x) * 0.06;

      // Interpolación suave de escala (grande en el Hero -> tamaño estándar al bajar)
      currentScale += (targetScale - currentScale) * 0.08;
      globeGroup.scale.set(currentScale, currentScale, currentScale);

      travelers.forEach((t) => {
        t.progress += t.speed;
        if (t.progress > 1) t.progress = 0;
        t.mesh.position.copy(t.curve.getPoint(t.progress));
      });

      const scale = 1 + 0.3 * Math.sin(clock * 20);
      pulseRings.forEach((r) => r.scale.set(scale, scale, 1));

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 640;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="w-full h-full select-none pointer-events-none"
    />
  );
}