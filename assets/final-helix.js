(() => {
  const canvas = document.createElement('canvas');
  canvas.className = 'sequence-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mode = document.body.classList.contains('funky-helix')
    ? 'helix'
    : document.body.classList.contains('funky-waves')
      ? 'waves'
      : 'network';

  const chars = 'ACGT0110GTACTCGA';
  const fullSpectrum = [
    [244, 231, 107],
    [91, 171, 74],
    [62, 123, 184],
    [129, 76, 164]
  ];
  const restrainedSpectrum = [
    [214, 187, 57],
    [83, 174, 73],
    [45, 165, 151],
    [42, 123, 190],
    [119, 76, 168]
  ];
  const helixStyles = {
    graphite: {
      palette: [[30, 30, 30], [76, 76, 76], [128, 128, 128], [42, 42, 42]],
      angle: -.43,
      font: 'Manrope, Arial, sans-serif',
      scale: .72,
      line: .065,
      opacity: .72
    },
    muted: {
      palette: [[188, 169, 65], [77, 137, 78], [64, 105, 143], [101, 73, 121]],
      angle: -.36,
      font: 'Manrope, Arial, sans-serif',
      scale: .78,
      line: .075,
      opacity: .7
    },
    cool: {
      palette: [[35, 72, 88], [54, 115, 119], [77, 139, 126], [112, 126, 143]],
      angle: -.5,
      font: 'Manrope, Arial, sans-serif',
      scale: .78,
      line: .085,
      opacity: .78,
      speed: .00042,
      amplitudeFactor: .19,
      amplitudeMax: 154,
      spanFactor: .76,
      spanMax: 610,
      pairs: 26,
      phaseStep: .5
    },
    host: {
      palette: [[38, 38, 38], [80, 158, 33], [198, 177, 49], [68, 68, 68]],
      angle: -.4,
      font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      scale: .7,
      line: .06,
      opacity: .68
    },
    original: {
      palette: fullSpectrum,
      angle: 0,
      font: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      scale: 1,
      line: .08,
      opacity: 1
    }
  };
  const helixStyle = document.body.classList.contains('helix-graphite')
    ? helixStyles.graphite
    : document.body.classList.contains('helix-muted-spectrum')
      ? helixStyles.muted
      : document.body.classList.contains('helix-cool-science')
        ? helixStyles.cool
        : document.body.classList.contains('helix-host-accent')
          ? helixStyles.host
          : helixStyles.original;
  const palette = document.body.classList.contains('helix-size-tall')
    ? restrainedSpectrum
    : mode === 'helix' ? helixStyle.palette : fullSpectrum;
  const pointer = { x: -9999, y: -9999, active: false };
  const wakePoints = [];
  let width = 0;
  let height = 0;
  let networkNodes = [];
  let currentFrameTime = 0;
  let lastWakePointTime = 0;
  let running = false;
  let documentVisible = !document.hidden;
  // The canvas covers only the top of a very long page, but it used to keep
  // clearing, redrawing and recompositing at 60fps the whole way down.
  let canvasOnScreen = true;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const helixSize = document.body.classList.contains('helix-size-full')
    ? { center: .64, amplitudeFactor: .23, amplitudeMax: 188, startY: 24, spanFactor: .87, spanMax: 720, pairs: 28, angle: -.4 }
    : document.body.classList.contains('helix-size-tall')
      ? { center: .72, amplitudeFactor: .115, amplitudeMax: 108, startY: -24, spanFactor: .98, spanMax: 820, pairs: 28, angle: -.52, scale: .84, line: .1, opacity: .94, lineWidth: .76, speed: .00044, phaseStep: .57 }
      : document.body.classList.contains('helix-size-balanced')
        ? { center: .68, amplitudeFactor: .2, amplitudeMax: 164, startY: 54, spanFactor: .78, spanMax: 640, pairs: 26, angle: -.47 }
        : null;

  function colour(t, alpha = 1) {
    const wrapped = ((t % 1) + 1) % 1;
    const scaled = wrapped * (palette.length - 1);
    const index = Math.min(palette.length - 2, Math.floor(scaled));
    const amount = scaled - index;
    const start = palette[index];
    const end = palette[index + 1];
    const rgb = start.map((value, channel) => Math.round(value + (end[channel] - value) * amount));
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function deterministic(seed) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function displace(x, y, radius = 118, strength = 28) {
    if (!wakePoints.length) return { x, y, proximity: 0 };
    let offsetX = 0;
    let offsetY = 0;
    let peakProximity = 0;

    wakePoints.forEach((wakePoint) => {
      const age = currentFrameTime - wakePoint.time;
      const life = Math.max(0, 1 - age / 920);
      if (!life) return;

      const dx = x - wakePoint.x;
      const dy = y - wakePoint.y;
      const distance = Math.hypot(dx, dy) || 1;
      const wakeRadius = radius * (.7 + life * .45);
      if (distance >= wakeRadius) return;

      const proximity = 1 - distance / wakeRadius;
      const force = proximity * proximity * strength * life;
      offsetX += (dx / distance) * force;
      offsetY += (dy / distance) * force;
      peakProximity = Math.max(peakProximity, proximity * life);
    });

    return { x: x + offsetX, y: y + offsetY, proximity: peakProximity };
  }

  function rotatePoint(x, y, centerX, centerY, angle) {
    if (!angle) return { x, y };
    const dx = x - centerX;
    const dy = y - centerY;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return {
      x: centerX + dx * cosine - dy * sine,
      y: centerY + dx * sine + dy * cosine
    };
  }

  function makeNetwork() {
    const count = width < 650 ? 36 : 54;
    networkNodes = Array.from({ length: count }, (_, index) => ({
      x: width * (.18 + deterministic(index + 1) * .78),
      y: height * (.04 + deterministic(index + 91) * .78),
      phase: deterministic(index + 211) * Math.PI * 2,
      drift: 5 + deterministic(index + 413) * 11,
      char: chars[index % chars.length],
      colour: deterministic(index + 701)
    }));
  }

  function resize() {
    const facts = document.querySelector('.facts');
    if (facts) {
      const canvasTop = Number.parseFloat(getComputedStyle(canvas).top) || 0;
      const factsBottom = facts.getBoundingClientRect().bottom + window.scrollY;
      // .facts stacks to one column under 820px, which drags factsBottom far down
      // and made the canvas *taller* on phones than on desktop. The stylesheet caps
      // .sequence-canvas at 720px below 720px wide; honour that cap here too, or the
      // backing store (and the masked composite done every frame) balloons on exactly
      // the weakest devices.
      const capped = window.innerWidth <= 820 ? 720 : Infinity;
      const wanted = Math.max(560, Math.round(factsBottom - canvasTop));
      canvas.style.height = `${Math.min(capped, wanted)}px`;
    }
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.round(rect.width * dpr);
    const nextHeight = Math.round(rect.height * dpr);
    // Mobile browsers fire resize continuously as the URL bar collapses. Reassigning
    // canvas.width/height reallocates the whole backing store, so bail when nothing
    // actually changed.
    if (canvas.width === nextWidth && canvas.height === nextHeight) return;
    width = rect.width;
    height = rect.height;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode === 'network') makeNetwork();
  }

  function drawHelix(time) {
    const diagonal = document.body.classList.contains('helix-diagonal');
    const centerX = width * (helixSize?.center || (diagonal ? .72 : .68));
    const amplitude = Math.min(
      width * (helixSize?.amplitudeFactor || helixStyle.amplitudeFactor || (diagonal ? .145 : .18)),
      helixSize?.amplitudeMax || helixStyle.amplitudeMax || (diagonal ? 118 : 146)
    );
    const startY = helixSize?.startY ?? (diagonal ? 94 : 42);
    const span = Math.min(
      height * (helixSize?.spanFactor || helixStyle.spanFactor || (diagonal ? .69 : .84)),
      helixSize?.spanMax || helixStyle.spanMax || (diagonal ? 548 : 670)
    );
    const pairs = width < 650 ? 22 : helixSize?.pairs || helixStyle.pairs || (diagonal ? 31 : 28);
    const rotationCenterY = startY + span / 2;
    const points = [];

    for (let index = 0; index < pairs; index += 1) {
      const ratio = index / (pairs - 1);
      const phase = time * (helixSize?.speed || helixStyle.speed || .00055)
        + index * (helixSize?.phaseStep || helixStyle.phaseStep || .57);
      const sine = Math.sin(phase);
      const depth = (Math.cos(phase) + 1) / 2;
      const y = startY + ratio * span;
      const helixAngle = helixSize?.angle ?? helixStyle.angle;
      const rawLeft = rotatePoint(centerX + sine * amplitude, y, centerX, rotationCenterY, helixAngle);
      const rawRight = rotatePoint(centerX - sine * amplitude, y, centerX, rotationCenterY, helixAngle);
      const left = displace(rawLeft.x, rawLeft.y, 124, 35);
      const right = displace(rawRight.x, rawRight.y, 124, 35);
      points.push({ left, right, ratio, depth, phase, index });
    }

    points.forEach(({ left, right, ratio, depth }) => {
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      const lineOpacity = helixSize?.line || helixStyle.line;
      ctx.strokeStyle = colour(ratio, Math.min(.52, lineOpacity + depth * lineOpacity));
      ctx.lineWidth = helixSize?.lineWidth || (diagonal ? .65 : .8);
      ctx.stroke();
    });

    points.forEach(({ left, right, ratio, depth, index }) => {
      const characterScale = helixSize?.scale || helixStyle.scale;
      const characterOpacity = helixSize?.opacity || helixStyle.opacity;
      const sizeFront = (12 + depth * 10) * characterScale;
      const sizeBack = (11 + (1 - depth) * 8) * characterScale;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${diagonal ? 500 : 600} ${sizeFront}px ${helixStyle.font}`;
      ctx.fillStyle = colour(ratio + time * .000015, Math.min(.98, (.31 + depth * .5) * characterOpacity - left.proximity * .18));
      ctx.fillText(chars[index % chars.length], left.x, left.y);
      ctx.font = `${diagonal ? 400 : 500} ${sizeBack}px ${helixStyle.font}`;
      ctx.fillStyle = colour(ratio + .42 + time * .000015, Math.min(.92, (.23 + (1 - depth) * .37) * characterOpacity - right.proximity * .14));
      ctx.fillText(chars[(index + 5) % chars.length], right.x, right.y);
    });
  }

  function drawWaves(time) {
    const strands = 5;
    const pointsPerStrand = width < 650 ? 20 : 30;
    for (let strand = 0; strand < strands; strand += 1) {
      const points = [];
      const baseY = 105 + strand * 104;
      for (let index = 0; index < pointsPerStrand; index += 1) {
        const ratio = index / (pointsPerStrand - 1);
        const x = 32 + ratio * (width - 56);
        const y = baseY
          + Math.sin(ratio * Math.PI * 4.2 + time * .00045 + strand * .86) * (20 + strand * 2)
          + Math.cos(ratio * Math.PI * 1.8 - time * .00022) * 8;
        points.push({ ...displace(x, y, 130, 32), ratio, index });
      }

      ctx.beginPath();
      points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = colour(strand / strands + time * .000012, .12);
      ctx.lineWidth = 1;
      ctx.stroke();

      points.forEach((point) => {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${point.index % 4 === 0 ? 600 : 500} ${12 + (strand % 2) * 2}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = colour(point.ratio * .72 + strand * .1 + time * .000012, .3 + (point.index % 5 === 0 ? .34 : .12) - point.proximity * .2);
        ctx.fillText(chars[(point.index + strand * 3) % chars.length], point.x, point.y);
      });
    }
  }

  function drawNetwork(time) {
    const current = networkNodes.map((node, index) => {
      const x = node.x + Math.sin(time * .00025 + node.phase) * node.drift;
      const y = node.y + Math.cos(time * .0002 + node.phase * 1.4) * node.drift;
      return { ...node, ...displace(x, y, 142, 38), index };
    });

    for (let a = 0; a < current.length; a += 1) {
      for (let b = a + 1; b < current.length; b += 1) {
        const distance = Math.hypot(current[a].x - current[b].x, current[a].y - current[b].y);
        if (distance < 112) {
          ctx.beginPath();
          ctx.moveTo(current[a].x, current[a].y);
          ctx.lineTo(current[b].x, current[b].y);
          ctx.strokeStyle = colour((current[a].colour + current[b].colour) / 2 + time * .000008, (1 - distance / 112) * .19);
          ctx.lineWidth = .75;
          ctx.stroke();
        }
      }
    }

    current.forEach((node) => {
      const emphasis = node.index % 6 === 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${emphasis ? 600 : 500} ${emphasis ? 19 : 13}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillStyle = colour(node.colour + time * .00001, (emphasis ? .7 : .4) - node.proximity * .18);
      ctx.fillText(node.char, node.x, node.y);
    });
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    if (mode === 'helix') drawHelix(time);
    else if (mode === 'waves') drawWaves(time);
    else drawNetwork(time);
  }

  function frame(time) {
    currentFrameTime = time;
    while (wakePoints.length && time - wakePoints[0].time > 940) wakePoints.shift();
    draw(time);
    if (reducedMotion || !documentVisible || !canvasOnScreen) {
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function start() {
    if (running || reducedMotion || !documentVisible || !canvasOnScreen) return;
    running = true;
    requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (event) => {
    if (!finePointer || event.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = pointer.x > -40 && pointer.x < rect.width + 40 && pointer.y > -40 && pointer.y < rect.height + 40;
    if (pointer.active) {
      const now = performance.now();
      if (now - lastWakePointTime > 34) {
        wakePoints.push({ x: pointer.x, y: pointer.y, time: now });
        if (wakePoints.length > 22) wakePoints.shift();
        lastWakePointTime = now;
      }
    }
    if (reducedMotion) draw(0);
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    pointer.active = false;
    if (reducedMotion) draw(0);
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  document.addEventListener('visibilitychange', () => {
    documentVisible = !document.hidden;
    start();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry.boundingClientRect;
      // Never let a degenerate measurement (zero-area box, e.g. a hidden or
      // not-yet-laid-out container) latch the animation off permanently.
      if (!box.width || !box.height) return;
      canvasOnScreen = entry.isIntersecting;
      start();
    }, { rootMargin: '200px' }).observe(canvas);
  }

  resize();
  if (reducedMotion) draw(0);
  else start();
})();
