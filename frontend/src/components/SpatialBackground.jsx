import React, { useEffect, useRef } from 'react';

/**
 * SpatialBackground -- DeepQR Shield.
 *
 * Restrained interactive network field:
 * - Rest state: Pure clean dark backdrop. All nodes dormant (alpha 0).
 * - Interactive state: As pointer moves, nearby data nodes wake with asymmetric easing
 *   (fast ease-out rise, gradual exponential ease-out fade out over ~1.5s).
 * - Calibrated intensity: Subtle, cryptographic-grade fine nodes (1.4-2.1px) and
 *   hairline connections (0.8px) that remain firmly in the background without competing
 *   with foreground cards or typographic content.
 * - Single z-0 fixed background layer so all page content and cards sit cleanly in front.
 * - Full reduced-motion and high-DPI compliance.
 *
 * Zero em-dashes and zero en-dashes throughout.
 */
export default function SpatialBackground() {
  const canvasRef    = useRef(null);
  const spotlightRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const isMobile = window.innerWidth < 768 || 'ontouchstart' in window;
    const dpr      = Math.min(window.devicePixelRatio || 1, 2);

    let W = window.innerWidth;
    let H = window.innerHeight;

    const resizeCanvas = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width  = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resizeCanvas();

    // ----------------------------------------------------------------
    // Fine-Tuned Spatial Configuration
    // ----------------------------------------------------------------
    const NODE_COUNT   = isMobile ? 36 : 75;
    const CONNECT_DIST = 135;
    const TRI_DIST     = 105;
    const MOUSE_RADIUS = isMobile ? 0 : 175;

    // Asymmetric easing constants:
    // Fast ease-out wake on pointer entry; smooth exponential decay on exit.
    const ALPHA_RISE  = 0.14;
    const ALPHA_DECAY = 0.026;

    // Strict maximum ceiling for atmospheric restraint
    const ALPHA_MAX = 0.40;

    // Threshold below which node skips drawing completely
    const DRAW_THRESHOLD = 0.006;

    const SPEED_MIN = 0.08;
    const SPEED_MAX = 0.22;

    // ----------------------------------------------------------------
    // Node Pool Initialization
    // ----------------------------------------------------------------
    let nodes = [];

    const seedNodes = () => {
      nodes = [];
      for (let k = 0; k < NODE_COUNT; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
        nodes.push({
          x:      Math.random() * W,
          y:      Math.random() * H,
          vx:     Math.cos(angle) * speed,
          vy:     Math.sin(angle) * speed,
          radius: 1.4 + Math.random() * 0.7, // 1.4px to 2.1px crisp micro-nodes
          alpha:  0,
          targetAlpha: 0,
        });
      }
    };
    seedNodes();

    const handleResize = () => {
      resizeCanvas();
      seedNodes();
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // ----------------------------------------------------------------
    // Spring-Damped Pointer Tracking
    // ----------------------------------------------------------------
    let mouseTargetX  = -9999;
    let mouseTargetY  = -9999;
    let mouseCurrentX = -9999;
    let mouseCurrentY = -9999;
    let isMouseActive = false;

    const onMouseMove = (e) => {
      mouseTargetX  = e.clientX;
      mouseTargetY  = e.clientY;
      isMouseActive = true;
      if (spotlightRef.current) {
        spotlightRef.current.style.transform =
          `translate(${e.clientX - 300}px,${e.clientY - 300}px)`;
        spotlightRef.current.style.opacity = '1';
      }
    };

    const onMouseLeave = () => {
      isMouseActive = false;
      mouseTargetX  = -9999;
      mouseTargetY  = -9999;
      if (spotlightRef.current) {
        spotlightRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove',    onMouseMove,   { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);

    let isVisible = true;
    const onVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    // ----------------------------------------------------------------
    // Animation Render Loop
    // ----------------------------------------------------------------
    let rafId;

    const render = () => {
      rafId = requestAnimationFrame(render);
      if (!isVisible) return;

      ctx.clearRect(0, 0, W, H);

      // Spring interpolation toward pointer target (Apple WWDC 2018 spring damping)
      mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.09;
      mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.09;

      // --------------------------------------------------------------
      // Phase 1: Physical drift & asymmetric excitation calculation
      // --------------------------------------------------------------
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        if (!prefersReducedMotion) {
          n.x += n.vx;
          n.y += n.vy;
          // Toroidal boundary wrapping
          if (n.x < -4)    n.x = W + 4;
          if (n.x > W + 4) n.x = -4;
          if (n.y < -4)    n.y = H + 4;
          if (n.y > H + 4) n.y = -4;
        }

        if (isMobile || prefersReducedMotion) {
          n.alpha       = 0;
          n.targetAlpha = 0;
          continue;
        }

        if (isMouseActive) {
          const dx   = n.x - mouseCurrentX;
          const dy   = n.y - mouseCurrentY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS) {
            const t = 1 - dist / MOUSE_RADIUS;
            // Smooth quadratic spatial falloff
            n.targetAlpha = Math.min(t * t * ALPHA_MAX, ALPHA_MAX);
          } else {
            n.targetAlpha = 0;
          }
        } else {
          n.targetAlpha = 0;
        }

        // Asymmetric easing: rapid rise on activation, graceful exponential fade
        if (n.targetAlpha > n.alpha) {
          n.alpha += (n.targetAlpha - n.alpha) * ALPHA_RISE;
        } else {
          n.alpha += (n.targetAlpha - n.alpha) * ALPHA_DECAY;
        }

        if (n.alpha < 0.001) n.alpha = 0;
      }

      // --------------------------------------------------------------
      // Phase 2: Dynamic hairline connections between active nodes
      // --------------------------------------------------------------
      const activePairs = [];

      for (let i = 0; i < nodes.length; i++) {
        const ni = nodes[i];
        if (ni.alpha < DRAW_THRESHOLD) continue;

        for (let j = i + 1; j < nodes.length; j++) {
          const nj = nodes[j];
          if (nj.alpha < DRAW_THRESHOLD) continue;

          const dx     = ni.x - nj.x;
          const dy     = ni.y - nj.y;
          const distSq = dx * dx + dy * dy;
          if (distSq >= CONNECT_DIST * CONNECT_DIST) continue;

          // Geometric mean ensures line only renders when both nodes are active
          const avgAlpha  = Math.sqrt(ni.alpha * nj.alpha);
          const dist      = Math.sqrt(distSq);
          const proxFac   = 1 - dist / CONNECT_DIST;
          // Restrained alpha ceiling for hairline lines
          const lineAlpha = avgAlpha * proxFac * 0.70;

          if (lineAlpha > DRAW_THRESHOLD) {
            ctx.beginPath();
            ctx.moveTo(ni.x, ni.y);
            ctx.lineTo(nj.x, nj.y);
            ctx.lineWidth   = 0.85;
            ctx.strokeStyle = `rgba(52,211,153,${Math.min(lineAlpha, 0.28)})`;
            ctx.stroke();

            if (
              dist < TRI_DIST &&
              ni.alpha > 0.12 &&
              nj.alpha > 0.12
            ) {
              activePairs.push({ i, j });
            }
          }
        }
      }

      // --------------------------------------------------------------
      // Phase 3: Subtle geometric polygons during localized clustering
      // --------------------------------------------------------------
      if (!prefersReducedMotion && activePairs.length >= 3) {
        const drawn = new Set();
        const cap   = Math.min(activePairs.length, 45);

        for (let a = 0; a < cap; a++) {
          const e1 = activePairs[a];
          for (let b = a + 1; b < cap; b++) {
            const e2 = activePairs[b];

            let common = null, p1 = null, p2 = null;
            if      (e1.i === e2.i) { common = e1.i; p1 = e1.j; p2 = e2.j; }
            else if (e1.i === e2.j) { common = e1.i; p1 = e1.j; p2 = e2.i; }
            else if (e1.j === e2.i) { common = e1.j; p1 = e1.i; p2 = e2.j; }
            else if (e1.j === e2.j) { common = e1.j; p1 = e1.i; p2 = e2.i; }
            if (common === null) continue;

            const nc  = nodes[common];
            const np1 = nodes[p1];
            const np2 = nodes[p2];

            const cdx = np1.x - np2.x;
            const cdy = np1.y - np2.y;
            if (cdx * cdx + cdy * cdy >= TRI_DIST * TRI_DIST) continue;

            const key = [common, p1, p2].sort().join('-');
            if (drawn.has(key)) continue;
            drawn.add(key);

            const triAlpha = (nc.alpha + np1.alpha + np2.alpha) / 3;
            const fillA    = Math.min(triAlpha * 0.05, 0.022);
            if (fillA < DRAW_THRESHOLD) continue;

            ctx.beginPath();
            ctx.moveTo(nc.x,  nc.y);
            ctx.lineTo(np1.x, np1.y);
            ctx.lineTo(np2.x, np2.y);
            ctx.closePath();
            ctx.fillStyle   = `rgba(16,185,129,${fillA})`;
            ctx.fill();
            ctx.lineWidth   = 0.5;
            ctx.strokeStyle = `rgba(110,231,183,${Math.min(fillA * 2.5, 0.06)})`;
            ctx.stroke();
          }
        }
      }

      // --------------------------------------------------------------
      // Phase 4: Clean micro-nodes rendering
      // --------------------------------------------------------------
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.alpha < DRAW_THRESHOLD) continue;

        // Subtle soft perimeter glow only at peak activation
        if (!prefersReducedMotion && n.alpha > 0.28) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * 2.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(52,211,153,${n.alpha * 0.08})`;
          ctx.fill();
        }

        // Solid core node with calibrated subtle intensity
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(52,211,153,${Math.min(n.alpha, 0.38)})`;
        ctx.fill();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize',             handleResize);
      window.removeEventListener('mousemove',          onMouseMove);
      document.removeEventListener('mouseleave',       onMouseLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Volumetric Ambient Aurora Atmosphere */}
      <div className="absolute inset-0">
        <div className="animate-ambient-1 absolute -top-24 right-[10%] h-[500px] w-[650px] rounded-full bg-emerald-500/[0.04] blur-[140px] motion-reduce:animate-none" />
        <div className="animate-ambient-2 absolute top-[40%] -left-28 h-[400px] w-[550px] rounded-full bg-teal-500/[0.03] blur-[150px] motion-reduce:animate-none" />
      </div>

      {/* Spring-Damped Pointer Ambient Spotlight */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute top-0 left-0 h-[600px] w-[600px] rounded-full opacity-0 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(circle, rgba(16,185,129,0.04) 0%, rgba(5,150,105,0.01) 50%, transparent 72%)',
          willChange: 'transform',
        }}
      />

      {/* Security Network Field Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: 'crisp-edges' }}
      />

      {/* Atmospheric Edge Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(9,9,11,0.5) 100%)',
        }}
      />
    </div>
  );
}
