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
    [218, 198, 73],
    [76, 157, 75],
    [55, 119, 171],
    [117, 81, 148]
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
  let width = 0;
  let height = 0;
  let networkNodes = [];

  const helixSize = document.body.classList.contains('helix-size-full')
    ? { center: .64, amplitudeFactor: .23, amplitudeMax: 188, startY: 24, spanFactor: .87, spanMax: 720, pairs: 28, angle: -.4 }
    : document.body.classList.contains('helix-size-tall')
      ? { center: .65, amplitudeFactor: .235, amplitudeMax: 195, startY: -24, spanFactor: .91, spanMax: 780, pairs: 24, angle: -.5, scale: .89, line: .128, opacity: .96, lineWidth: .95 }
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
    if (!pointer.active) return { x, y, proximity: 0 };
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const distance = Math.hypot(dx, dy) || 1;
    if (distance >= radius) return { x, y, proximity: 0 };
    const proximity = 1 - distance / radius;
    const force = proximity * proximity * strength;
    return {
      x: x + (dx / distance) * force,
      y: y + (dy / distance) * force,
      proximity
    };
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
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeNetwork();
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
      const phase = time * (helixStyle.speed || .00055) + index * (helixStyle.phaseStep || .57);
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
      ctx.strokeStyle = colour(ratio, lineOpacity + depth * lineOpacity);
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
      ctx.fillStyle = colour(ratio + time * .000015, (.28 + depth * .48) * characterOpacity - left.proximity * .18);
      ctx.fillText(chars[index % chars.length], left.x, left.y);
      ctx.font = `${diagonal ? 400 : 500} ${sizeBack}px ${helixStyle.font}`;
      ctx.fillStyle = colour(ratio + .42 + time * .000015, (.2 + (1 - depth) * .34) * characterOpacity - right.proximity * .14);
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
    draw(time);
    if (!reducedMotion) requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = pointer.x > -40 && pointer.x < rect.width + 40 && pointer.y > -40 && pointer.y < rect.height + 40;
    if (reducedMotion) draw(0);
  }, { passive: true });

  window.addEventListener('pointerleave', () => {
    pointer.active = false;
    if (reducedMotion) draw(0);
  });
  window.addEventListener('resize', resize);

  resize();
  if (reducedMotion) draw(0);
  else requestAnimationFrame(frame);
})();
