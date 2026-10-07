import React, { useEffect, useRef } from 'react';

/**
 * SpatialBackground component for DeepQR Shield.
 *
 * Implements an interactive security network field:
 * - Subtle, small data nodes distributed across the backdrop.
 * - Local pointer interaction field: points pull slightly toward the cursor,
 *   connecting with fine lines and forming temporary geometric triangles.
 * - Living analysis scroll trail: connections progressively travel as the user scrolls,
 *   fading naturally behind while forming ahead.
 * - Section-aware intensity calibration: Hero (full presence), Upload (restrained),
 *   Results (very subtle), Footer (minimal residual activity).
 * - Preserves the subtle green pointer-following ambient spotlight underneath.
 * - GPU-accelerated canvas with high-DPI scaling, RAF clock, tab visibility suspension,
 *   and full prefers-reduced-motion accessibility compliance.
 * - Zero em-dashes and zero en-dashes throughout.
 */
export default function SpatialBackground() {
  const canvasRef = useRef(null);
  const spotlightRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const isMobile = width < 768 || 'ontouchstart' in window;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    // Node Field Configuration
    const NODE_COUNT = isMobile ? 36 : 76;
    const CONNECT_DIST = isMobile ? 95 : 125;
    const TRIANGLE_MAX_DIST = isMobile ? 80 : 105;
    const MOUSE_RADIUS = isMobile ? 0 : 185;

    // Initialize small security data nodes
    const nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const bx = Math.random() * width;
      const by = Math.random() * height;
      nodes.push({
        baseX: bx,
        baseY: by,
        x: bx,
        y: by,
        vx: (Math.random() - 0.5) * 0.12, // subtle resting drift
        vy: (Math.random() - 0.5) * 0.12,
        radius: Math.random() * 0.5 + 1.1, // 1.1px to 1.6px small nodes
        baseAlpha: Math.random() * 0.06 + 0.11, // quiet resting opacity
        pulseAlpha: 0,
        scrollExcite: 0,
        driftPhase: Math.random() * Math.PI * 2,
      });
    }

    // Pointer state with spring interpolation
    let mouseTargetX = -1000;
    let mouseTargetY = -1000;
    let mouseCurrentX = -1000;
    let mouseCurrentY = -1000;
    let isMousePresent = false;

    const handleMouseMove = (e) => {
      mouseTargetX = e.clientX;
      mouseTargetY = e.clientY;
      isMousePresent = true;

      // Update ambient spotlight position directly without React re-render
      if (spotlightRef.current) {
        spotlightRef.current.style.transform = `translate(${e.clientX - 325}px, ${e.clientY - 325}px)`;
        spotlightRef.current.style.opacity = '1';
      }
    };

    const handleMouseLeave = () => {
      mouseTargetX = -1000;
      mouseTargetY = -1000;
      isMousePresent = false;
      if (spotlightRef.current) {
        spotlightRef.current.style.opacity = '0';
      }
    };

    // Scroll state tracking for the living analysis trail
    let lastScrollY = window.scrollY;
    let currentScrollY = window.scrollY;
    let scrollDelta = 0;

    const handleScroll = () => {
      currentScrollY = window.scrollY;
      const delta = Math.abs(currentScrollY - lastScrollY);
      scrollDelta = Math.max(scrollDelta, delta);
      lastScrollY = currentScrollY;
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });

    let isVisible = true;
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let tick = 0;

    const render = () => {
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, width, height);
      tick += 1;

      // Calculate section-aware intensity multiplier based on scroll position
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        1
      );
      const scrollFraction = Math.min(Math.max(currentScrollY / (docHeight - height), 0), 1);

      // Hero: 1.0 -> Upload: ~0.65 -> Results: ~0.38 -> Footer: ~0.22
      let sectionMultiplier = 1.0;
      if (scrollFraction < 0.25) {
        sectionMultiplier = 1.0 - scrollFraction * 1.4; // 1.0 down to 0.65
      } else if (scrollFraction < 0.65) {
        const t = (scrollFraction - 0.25) / 0.4;
        sectionMultiplier = 0.65 - t * 0.27; // 0.65 down to 0.38
      } else {
        const t = (scrollFraction - 0.65) / 0.35;
        sectionMultiplier = 0.38 - t * 0.16; // 0.38 down to 0.22
      }

      // Spring damping on pointer tracking
      const springK = 0.09;
      mouseCurrentX += (mouseTargetX - mouseCurrentX) * springK;
      mouseCurrentY += (mouseTargetY - mouseCurrentY) * springK;

      // Scroll excitation decay
      const activeScrollExcite = Math.min(scrollDelta * 0.035, 1.0);
      scrollDelta *= 0.92;

      // -------------------------------------------------------------
      // 1. Update Node Physical Coordinates & Excitations
      // -------------------------------------------------------------
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (prefersReducedMotion) {
          node.x = node.baseX;
          node.y = node.baseY;
          node.pulseAlpha = 0;
          node.scrollExcite = 0;
          continue;
        }

        // Subtle ambient resting oscillation
        node.driftPhase += 0.008;
        const driftX = Math.cos(node.driftPhase) * 6;
        const driftY = Math.sin(node.driftPhase * 0.8) * 6;

        // Wrap nodes seamlessly across viewport with gentle scroll parallax
        const effectiveBaseY =
          ((node.baseY - currentScrollY * 0.24) % height + height) % height;
        const effectiveBaseX = node.baseX;

        const restX = effectiveBaseX + driftX;
        const restY = effectiveBaseY + driftY;

        // Mouse interaction calculation
        let pullX = 0;
        let pullY = 0;
        let mouseInfluence = 0;

        if (isMousePresent && !isMobile) {
          const dx = restX - mouseCurrentX;
          const dy = restY - mouseCurrentY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < MOUSE_RADIUS && dist > 1) {
            const factor = Math.max(0, 1 - dist / MOUSE_RADIUS);
            mouseInfluence = factor;
            // Physical soft pull toward cursor, capped to prevent clustering
            const pullMagnitude = Math.min(factor * factor * 16, 12);
            pullX = -(dx / dist) * pullMagnitude;
            pullY = -(dy / dist) * pullMagnitude;
          }
        }

        // Target positions with spring settle
        const targetX = restX + pullX;
        const targetY = restY + pullY;

        node.x += (targetX - node.x) * 0.12;
        node.y += (targetY - node.y) * 0.12;

        // Mouse excitation smooth ramp & decay
        node.pulseAlpha += (mouseInfluence * 0.65 - node.pulseAlpha) * 0.14;

        // Scroll analysis trail excitation
        if (activeScrollExcite > 0.02) {
          // Excitation wave travels down the page
          const normY = node.y / height;
          const waveProximity = 1 - Math.abs(normY - 0.5) * 1.5;
          if (waveProximity > 0) {
            node.scrollExcite = Math.min(
              1.0,
              node.scrollExcite + activeScrollExcite * waveProximity * 0.6
            );
          }
        }
        node.scrollExcite *= 0.96; // exponential fade
      }

      // -------------------------------------------------------------
      // 2. Dynamic Geometric Connections & Temporary Polygons
      // -------------------------------------------------------------
      // We collect active connected pairs to discover temporary triangles
      const activePairs = [];

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const ni = nodes[i];
          const nj = nodes[j];

          const dx = ni.x - nj.x;
          const dy = ni.y - nj.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < CONNECT_DIST * CONNECT_DIST) {
            const dist = Math.sqrt(distSq);

            // Activity level: either node influenced by pointer OR active in scroll trail
            const activity = Math.max(
              ni.pulseAlpha + ni.scrollExcite,
              nj.pulseAlpha + nj.scrollExcite
            );

            // Baseline subtle connectivity + responsive boost
            const proximityFactor = 1 - dist / CONNECT_DIST;
            const lineAlpha =
              (0.025 + proximityFactor * activity * 0.42) * sectionMultiplier;

            if (lineAlpha > 0.015) {
              ctx.lineWidth = 0.75;
              ctx.strokeStyle = `rgba(16, 185, 129, ${lineAlpha})`;
              ctx.beginPath();
              ctx.moveTo(ni.x, ni.y);
              ctx.lineTo(nj.x, nj.y);
              ctx.stroke();

              // Track active edge if proximity and activity allow polygons
              if (dist < TRIANGLE_MAX_DIST && activity > 0.08) {
                activePairs.push({ i, j, dist, activity });
              }
            }
          }
        }
      }

      // Discover and render temporary triangles (small organic security polygons)
      if (!prefersReducedMotion && activePairs.length >= 3) {
        const drawnTriangles = new Set();

        for (let a = 0; a < activePairs.length; a++) {
          const edge1 = activePairs[a];
          for (let b = a + 1; b < activePairs.length; b++) {
            const edge2 = activePairs[b];

            // Check if edges share a vertex
            let common = null;
            let p1 = null;
            let p2 = null;

            if (edge1.i === edge2.i) {
              common = edge1.i;
              p1 = edge1.j;
              p2 = edge2.j;
            } else if (edge1.i === edge2.j) {
              common = edge1.i;
              p1 = edge1.j;
              p2 = edge2.i;
            } else if (edge1.j === edge2.i) {
              common = edge1.j;
              p1 = edge1.i;
              p2 = edge2.j;
            } else if (edge1.j === edge2.j) {
              common = edge1.j;
              p1 = edge1.i;
              p2 = edge2.i;
            }

            if (common !== null && p1 !== null && p2 !== null) {
              // Check if the closing third edge exists
              const closingDx = nodes[p1].x - nodes[p2].x;
              const closingDy = nodes[p1].y - nodes[p2].y;
              const closingDist = Math.sqrt(closingDx * closingDx + closingDy * closingDy);

              if (closingDist < TRIANGLE_MAX_DIST) {
                const triKey = [common, p1, p2].sort().join('-');
                if (!drawnTriangles.has(triKey)) {
                  drawnTriangles.add(triKey);

                  const triActivity =
                    (nodes[common].pulseAlpha +
                      nodes[p1].pulseAlpha +
                      nodes[p2].pulseAlpha +
                      nodes[common].scrollExcite +
                      nodes[p1].scrollExcite +
                      nodes[p2].scrollExcite) /
                    3;

                  const fillAlpha =
                    Math.min(triActivity * 0.048, 0.045) * sectionMultiplier;

                  if (fillAlpha > 0.004) {
                    ctx.beginPath();
                    ctx.moveTo(nodes[common].x, nodes[common].y);
                    ctx.lineTo(nodes[p1].x, nodes[p1].y);
                    ctx.lineTo(nodes[p2].x, nodes[p2].y);
                    ctx.closePath();

                    // Ephemeral translucent facet fill
                    ctx.fillStyle = `rgba(16, 185, 129, ${fillAlpha})`;
                    ctx.fill();

                    // Subtle polygon boundary accent
                    ctx.lineWidth = 0.5;
                    ctx.strokeStyle = `rgba(110, 231, 183, ${fillAlpha * 2.2})`;
                    ctx.stroke();
                  }
                }
              }
            }
          }
        }
      }

      // -------------------------------------------------------------
      // 3. Render Nodes (Small Security Data Points)
      // -------------------------------------------------------------
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const activity = node.pulseAlpha + node.scrollExcite;
        const totalAlpha =
          (node.baseAlpha + activity * 0.65) * sectionMultiplier;

        // Restrained subtle node halo when active
        if (activity > 0.12 && !prefersReducedMotion) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(16, 185, 129, ${totalAlpha * 0.22})`;
          ctx.fill();
        }

        // Node core dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(110, 231, 183, ${totalAlpha})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Volumetric Ambient Light Clouds (CSS Compositor Accelerated) */}
      <div className="absolute inset-0">
        {/* Top-Right Emerald Aurora Orb */}
        <div className="animate-ambient-1 absolute -top-24 right-[10%] h-[500px] w-[650px] rounded-full bg-emerald-500/10 blur-[130px] motion-reduce:animate-none" />

        {/* Mid-Left Teal & Mint Aurora Orb */}
        <div className="animate-ambient-2 absolute top-[35%] -left-28 h-[450px] w-[600px] rounded-full bg-teal-500/06 blur-[140px] motion-reduce:animate-none" />

        {/* Bottom-Right Deep Emerald Pool */}
        <div className="animate-ambient-1 absolute -bottom-32 right-[18%] h-[550px] w-[700px] rounded-full bg-emerald-600/08 blur-[150px] motion-reduce:animate-none" />
      </div>

      {/* Tactile Micro-Dot Matrix Substrate Pattern */}
      <div
        className="bg-dot-matrix absolute inset-0 opacity-30"
        style={{
          maskImage:
            'radial-gradient(ellipse 90% 75% at 50% 35%, black 35%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 75% at 50% 35%, black 35%, transparent 100%)',
        }}
      />

      {/* Interactive Spring-Damped Pointer Spotlight Flare */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute top-0 left-0 h-[650px] w-[650px] rounded-full opacity-0 transition-opacity duration-300"
        style={{
          background:
            'radial-gradient(circle, rgba(16, 185, 129, 0.055) 0%, rgba(5, 150, 105, 0.02) 45%, transparent 70%)',
          willChange: 'transform',
        }}
      />

      {/* Interactive Security Network Field Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-90"
      />

      {/* Edge Vignette Framing */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 65%, rgba(9, 9, 11, 0.5) 100%)',
        }}
      />
    </div>
  );
}
