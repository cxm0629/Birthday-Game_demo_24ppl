(function () {
  'use strict';

  let canvas = null;
  let context = null;
  let frameId = 0;
  let running = false;
  let host = null;
  let particles = [];
  let startedAt = 0;
  let nextBurstAt = 0;
  let burstIndex = 0;
  let config = null;

  const colors = [
    [246, 211, 139],
    [236, 184, 92],
    [255, 239, 196],
    [220, 151, 75],
    [232, 132, 62],
    [247, 222, 168]
  ];

  const random = (min, max) => min + Math.random() * (max - min);

  function resize() {
    if (!canvas || !host) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, config.reduced ? 1 : 1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function burst(progress) {
    if (!canvas || particles.length >= config.maxParticles) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    const currentBurst = burstIndex++;
    const right = currentBurst % 2 === 1;
    const large = !config.reduced && currentBurst % 3 === 2;
    const x = width * (large
      ? (right ? random(.72, .96) : random(.04, .28))
      : (right ? random(.64, .97) : random(.03, .36)));
    const y = height * random(large ? .05 : .1, large ? .32 : .5);
    const scale = Math.max(.72, Math.min(1.15, Math.min(width, height) / 700));
    const earlyBoost = progress < .48 ? 1.14 : 1;
    const count = Math.round(random(config.particlesMin, config.particlesMax) * earlyBoost * (large ? 1.18 : 1) * (1 - progress * .3));
    const offset = random(0, Math.PI * 2);

    for (let index = 0; index < count && particles.length < config.maxParticles; index++) {
      const angle = offset + (index / count) * Math.PI * 2 + random(-.055, .055);
      const burstScale = large ? 1.75 : 1.42;
      const speed = random(config.speedMin, config.speedMax) * scale * burstScale;
      particles.push({
        x,
        y,
        previousX: x,
        previousY: y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        age: 0,
        life: random(config.lifeMin, config.lifeMax),
        width: random(.9, 1.65),
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  function drawParticle(particle) {
    const remaining = Math.max(0, 1 - particle.age / particle.life);
    const alpha = Math.min(1, remaining * 1.35) * config.opacity;
    const [red, green, blue] = particle.color;
    const trailTime = config.reduced ? 22 : 42;
    context.strokeStyle = `rgba(${red},${green},${blue},${alpha})`;
    context.lineWidth = particle.width;
    context.beginPath();
    context.moveTo(particle.x - particle.velocityX * trailTime, particle.y - particle.velocityY * trailTime);
    context.lineTo(particle.x, particle.y);
    context.stroke();

    if (remaining > .72 && !config.reduced) {
      context.fillStyle = `rgba(255,244,211,${alpha * .62})`;
      context.fillRect(particle.x - .8, particle.y - .8, 1.6, 1.6);
    }
  }

  function finish() {
    running = false;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    window.removeEventListener('resize', resize);
    if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
    canvas?.remove();
    canvas = null;
    context = null;
    host = null;
    particles = [];
    config = null;
  }

  function animate(now) {
    if (!running || !canvas || !context || !host?.isConnected) return finish();
    const elapsed = now - startedAt;
    const width = host.clientWidth;
    const height = host.clientHeight;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';

    if (elapsed < config.launchUntil && now >= nextBurstAt) {
      const progress = elapsed / config.launchUntil;
      burst(progress);
      const openingPace = elapsed < 2800 ? .78 : 1;
      nextBurstAt = now + random(config.intervalMin, config.intervalMax) * openingPace * (1 + progress * .55);
    }

    const delta = Math.min(32, Math.max(8, now - (animate.previousTime || now - 16.7)));
    animate.previousTime = now;
    particles = particles.filter(particle => {
      particle.age += delta;
      if (particle.age >= particle.life) return false;
      particle.previousX = particle.x;
      particle.previousY = particle.y;
      const drag = Math.pow(config.drag, delta / 16.7);
      particle.velocityX *= drag;
      particle.velocityY = particle.velocityY * drag + config.gravity * delta;
      particle.x += particle.velocityX * delta;
      particle.y += particle.velocityY * delta;
      drawParticle(particle);
      return true;
    });

    if ((elapsed >= config.launchUntil && particles.length === 0) || elapsed >= config.duration) return finish();
    frameId = requestAnimationFrame(animate);
  }

  function start(container) {
    finish();
    if (!(container instanceof HTMLElement)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const compact = container.clientWidth < 520;
    config = reduced ? {
      reduced: true,
      duration: 3800,
      launchUntil: 2100,
      maxParticles: 64,
      particlesMin: 9,
      particlesMax: 14,
      speedMin: .035,
      speedMax: .064,
      lifeMin: 900,
      lifeMax: 1300,
      intervalMin: 520,
      intervalMax: 700,
      gravity: .000025,
      drag: .986,
      opacity: .52
    } : {
      reduced: false,
      duration: 7600,
      launchUntil: 5600,
      maxParticles: compact ? 220 : 280,
      particlesMin: 21,
      particlesMax: 30,
      speedMin: .048,
      speedMax: .092,
      lifeMin: 1200,
      lifeMax: 1850,
      intervalMin: 400,
      intervalMax: 620,
      gravity: .000045,
      drag: .984,
      opacity: .84
    };

    host = container;
    canvas = document.createElement('canvas');
    canvas.className = 'ending-fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '0',
      pointerEvents: 'none'
    });
    context = canvas.getContext('2d', { alpha: true });
    if (!context) return finish();
    context.lineCap = 'round';
    host.appendChild(canvas);
    resize();
    window.addEventListener('resize', resize, { passive: true });
    running = true;
    particles = [];
    burstIndex = 0;
    animate.previousTime = 0;
    startedAt = performance.now();
    nextBurstAt = startedAt + 120;
    frameId = requestAnimationFrame(animate);
  }

  window.EndingFireworks = { start, stop: finish };
})();
