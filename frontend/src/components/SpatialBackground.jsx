import React, { useEffect, useRef } from 'react';

/**
 * SpatialBackground component.
 *
 * Renders a GPU-accelerated 3D spatial particle constellation in a fixed background canvas.
 * - Simulates true 3D coordinate space (x, y, z) with perspective projection.
 * - Smooth spring-damped rotational inertia responding to mouse velocity.
 * - Translucent depth layers with subtle connecting tactical grid lines.
 * - Pauses execution when tab is hidden or when prefers-reduced-motion is active.
 * - Zero CPU waste, display-synced requestAnimationFrame clock.
 */
export default function SpatialBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // 3D Scene Settings
    const FOV = 450;
    const NUM_PARTICLES = 75;
    const particles = [];

    // Mouse tracking with spring inertia
    let mouseTargetX = 0;
    let mouseTargetY = 0;
    let mouseCurrentX = 0;
    let mouseCurrentY = 0;

    // Initialize 3D particle points
    for (let i = 0; i < NUM_PARTICLES; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        z: Math.random() * 800 + 200,
        vz: (Math.random() * 0.4 + 0.15) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 1.5 + 1,
      });
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e) => {
      // Normalize mouse to [-1, 1]
      mouseTargetX = (e.clientX / width - 0.5) * 2;
      mouseTargetY = (e.clientY / height - 0.5) * 2;
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    let isVisible = true;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Spring damping on mouse position (Emil Kowalski / Apple physics)
      mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.04;
      mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.04;

      const rotY = mouseCurrentX * 0.25;
      const rotX = -mouseCurrentY * 0.2;
      const cx = width / 2;
      const cy = height / 2;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Projected points container for line drawing
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Animate slow depth drift
        p.z += p.vz;
        if (p.z < 150) p.z = 1000;
        if (p.z > 1000) p.z = 150;

        // 3D rotation around Y then X
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        if (z2 <= 20) continue;

        // Perspective projection
        const scale = FOV / z2;
        const px = cx + x1 * scale;
        const py = cy + y2 * scale;

        // Depth-based opacity & size
        const depthAlpha = Math.min(Math.max((1 - z2 / 1000) * 0.45, 0.04), 0.5);
        const radius = Math.max(p.size * scale * 0.6, 0.6);

        projected.push({ x: px, y: py, alpha: depthAlpha });

        // Draw particle node
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(16, 185, 129, ${depthAlpha * 0.75})`;
        ctx.fill();
      }

      // Draw subtle tactical coordinate lines between proximal nodes
      ctx.lineWidth = 0.6;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < 14400) { // 120px distance
            const lineAlpha = (1 - Math.sqrt(distSq) / 120) * 0.12 * Math.min(projected[i].alpha, projected[j].alpha);
            ctx.strokeStyle = `rgba(110, 231, 183, ${lineAlpha})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-70"
    />
  );
}
