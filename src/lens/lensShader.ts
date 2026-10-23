/**
 * Один полноэкранный проход «объектив → плёнка». Все помехи собраны в одном шейдере:
 * отдельный проход на каждую стоил бы полного перечитывания кадра, а здесь выключенная
 * помеха стоит одно сравнение. Порядок повторяет путь света: геометрия кадра
 * (сдвиг, разрывы, линзы) → выборка через объектив → экспозиция → проявка → дефекты плёнки.
 */
export const LENS_UNIFORM_NAMES = [
  'exposure', 'defocus', 'aberration', 'distortion', 'vignette', 'grain', 'scratches', 'dust', 'flicker', 'weave',
  'tear', 'roll', 'burn', 'burnX', 'burnY', 'halation', 'heat', 'frost', 'signalLoss', 'lightLeak', 'hotPixels',
  'tintR', 'tintG', 'tintB', 'tintAmount', 'warpX', 'warpY', 'warpStrength', 'warpRadius', 'ripple', 'rippleX', 'rippleY',
  'filmLook', 'rip', 'ripAngle',
] as const;

export const lensVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const lensFragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform vec2 resolution;
  uniform float time;
  ${LENS_UNIFORM_NAMES.map(name => `uniform float ${name};`).join('\n  ')}
  varying vec2 vUv;

  const float FILM_FPS = 24.0;
  const float GOLDEN_ANGLE = 2.39996323;
  const int DEFOCUS_TAPS = 16;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * valueNoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
  vec3 acesFilm(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 linearToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  float lumaOf(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  /** Знаковое расстояние до рваной линии разрыва через центр кадра; вдоль линии — зубцы разной длины. */
  float ripDistance(vec2 uv, float aspect) {
    vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
    vec2 direction = vec2(cos(ripAngle), sin(ripAngle));
    float along = dot(c, direction);
    float across = dot(c, vec2(-direction.y, direction.x));
    float jag = (valueNoise(vec2(along * 18.0, ripAngle * 10.0)) - 0.5) * 0.022 + (valueNoise(vec2(along * 160.0, ripAngle)) - 0.5) * 0.005;
    return across + jag;
  }

  void main() {
    float aspect = resolution.x / resolution.y;
    float frame = floor(time * FILM_FPS);
    float filmTime = frame / FILM_FPS;
    vec2 uv = vUv;

    // --- Геометрия кадра ---------------------------------------------------
    // Кадр гуляет в фильмовом канале: плавное блуждание, но шагами в один кадр — как у проектора.
    if (weave > 0.001) {
      vec2 drift = vec2(valueNoise(vec2(filmTime * 2.3, 3.1)), valueNoise(vec2(filmTime * 1.7, 8.4))) - 0.5;
      vec2 jitter = (vec2(hash12(vec2(frame, 1.0)), hash12(vec2(frame, 2.0))) - 0.5) * 0.3;
      uv += (drift + jitter) * weave * vec2(0.0022, 0.0055);
    }

    // Разрыв плёнки: половины кадра разъезжаются по рваной линии.
    float ripEdge = 1.0;
    float ripGap = 0.0;
    if (rip > 0.001) {
      float d = ripDistance(vUv, aspect);
      uv += step(0.0, d) * vec2(0.035, -0.05) * rip;
      ripGap = 1.0 - smoothstep(0.0, 0.0015 + rip * 0.006, abs(d));
      ripEdge = abs(d);
    }

    // Кадр съехал: изображение сдвинуто по вертикали, на стыке видна межкадровая перемычка.
    float barMask = 0.0;
    if (roll > 0.0005) {
      float shifted = uv.y + roll;
      float seam = fract(shifted);
      seam = min(seam, 1.0 - seam);
      barMask = 1.0 - smoothstep(0.018, 0.024, seam);
      uv.y = fract(shifted);
    }

    // Разрывы строк: узкие полосы, сдвинутые вбок, ширина полос меняется от кадра к кадру.
    if (tear > 0.001) {
      float bandScale = mix(24.0, 90.0, hash12(vec2(frame, 9.0)));
      float band = floor(uv.y * bandScale);
      float bandActive = step(1.0 - tear * 0.35, hash12(vec2(band, frame)));
      uv.x += bandActive * (hash12(vec2(band, frame + 3.0)) - 0.5) * 0.14 * tear;
    }

    if (heat > 0.001) {
      float wobble = fbm(vec2(uv.x * 9.0, uv.y * 14.0 - time * 1.8));
      uv += (vec2(wobble, fbm(vec2(uv.y * 11.0 + time * 1.3, uv.x * 7.0))) - 0.5) * heat * 0.007;
    }

    // Гравитационная линза: луч отклоняется на θ_E² / θ, внутри тени — абсолютная тьма.
    float shadow = 0.0;
    if (warpStrength > 0.001) {
      vec2 d = (uv - vec2(warpX, warpY)) * vec2(aspect, 1.0);
      float r = max(length(d), 1e-4);
      float einstein = warpRadius * warpStrength;
      uv -= (d / r) * (einstein * einstein / r) / vec2(aspect, 1.0);
      shadow = 1.0 - smoothstep(einstein * 0.55, einstein * 0.75, r);
    }

    if (ripple > 0.001) {
      vec2 d = (uv - vec2(rippleX, rippleY)) * vec2(aspect, 1.0);
      float r = length(d);
      uv += normalize(d + 1e-5) / vec2(aspect, 1.0) * sin(r * 55.0 - time * 7.0) * ripple * 0.006 * exp(-r * 1.2);
    }

    if (abs(distortion) > 0.001) {
      vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
      uv = 0.5 + (uv - 0.5) * (1.0 + distortion * dot(c, c) * 0.35);
    }

    // --- Выборка через объектив -------------------------------------------
    // 16 выборок — только когда пятно размытия больше пикселя: меньшее глаз не отличит от резкого.
    vec3 color;
    if (defocus * resolution.y > 0.75) {
      vec3 sum = vec3(0.0);
      float rotation = hash12(gl_FragCoord.xy) * 6.2831;
      for (int i = 0; i < DEFOCUS_TAPS; i++) {
        float fi = float(i) + 0.5;
        float angle = fi * GOLDEN_ANGLE + rotation;
        vec2 offset = vec2(cos(angle), sin(angle)) * sqrt(fi / float(DEFOCUS_TAPS)) * defocus;
        sum += texture2D(tScene, uv + offset * vec2(1.0 / aspect, 1.0)).rgb;
      }
      color = sum / float(DEFOCUS_TAPS);
    } else {
      color = texture2D(tScene, uv).rgb;
    }

    if (aberration > 0.0002) {
      vec2 offset = (uv - 0.5) * aberration * 2.0;
      color.r = mix(color.r, texture2D(tScene, uv + offset).r, 0.85);
      color.b = mix(color.b, texture2D(tScene, uv - offset).b, 0.85);
    }

    // Ореол: свет, прошедший эмульсию, отражается от подложки и ложится тёплым венцом.
    if (halation > 0.001) {
      vec3 glow = texture2D(tBloom, uv).rgb;
      color += glow * mix(vec3(1.0), vec3(1.0, 0.6, 0.35), 0.6) * halation * 1.4;
    }

    color *= 1.0 - shadow;

    // --- Экспозиция и проявка ---------------------------------------------
    // Мерцание: неровная выдержка кадра плюс медленное «дыхание» лампы проектора.
    float flickerGain = 1.0 + ((hash12(vec2(frame, 17.0)) - 0.5) * 0.35 + (valueNoise(vec2(time * 0.7, 5.0)) - 0.5) * 0.12) * flicker;
    color *= exposure * flickerGain;
    color = mix(color, color * vec3(tintR, tintG, tintB), tintAmount);

    // Засветка — неровные тёплые пятна от края кассеты, медленно плывущие.
    if (lightLeak > 0.001) {
      float side = sin(time * 0.031) > 0.0 ? vUv.x : 1.0 - vUv.x;
      float blotch = pow(fbm(vec2(vUv.y * 1.6 + time * 0.05, time * 0.06 + side)), 2.0);
      float reach = smoothstep(0.55, 0.0, side + (fbm(vec2(vUv.y * 3.0, time * 0.2)) - 0.5) * 0.25);
      color += (vec3(1.5, 0.42, 0.1) * blotch + vec3(1.0, 0.78, 0.35) * blotch * blotch) * reach * lightLeak;
    }

    color = acesFilm(color);

    // Характер плёнки: холодные тени, тёплые света, мягкая S-кривая и приподнятый чёрный подложки.
    if (filmLook > 0.001) {
      float l = lumaOf(color);
      vec3 graded = color * mix(vec3(0.93, 1.0, 1.05), vec3(1.05, 1.0, 0.91), smoothstep(0.05, 0.6, l));
      graded = mix(vec3(lumaOf(graded)), graded, 0.9);
      graded = mix(graded, smoothstep(-0.03, 1.03, graded), 0.5);
      graded += vec3(0.006, 0.007, 0.01);
      color = mix(color, graded, clamp(filmLook, 0.0, 1.0));
    }

    if (signalLoss > 0.001) {
      float lines = step(0.5, fract(gl_FragCoord.y * 0.5)) * 0.25 + 0.75;
      float levels = mix(64.0, 5.0, signalLoss);
      vec3 coarse = floor(color * levels) / levels;
      color = mix(color, vec3(lumaOf(coarse)) * vec3(0.85, 1.0, 0.95) * lines, signalLoss * 0.85);
      float dropout = step(1.0 - signalLoss * 0.06, hash12(vec2(floor(vUv.y * 90.0), frame)));
      color = mix(color, vec3(hash12(gl_FragCoord.xy + frame)), dropout * 0.8);
    }

    // Иней растёт от краёв линзы: ветвистые прожилки (гребни шума), а не сплошная муть.
    if (frost > 0.001) {
      vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
      float reach = smoothstep(0.72 - frost * 0.22, 1.05, length(c) + (fbm(vUv * 6.0) - 0.5) * 0.3);
      float veins = pow(1.0 - abs(fbm(vUv * vec2(38.0, 30.0)) * 2.0 - 1.0), 7.0);
      float fineVeins = pow(1.0 - abs(fbm(vUv * vec2(90.0, 76.0) + 5.0) * 2.0 - 1.0), 10.0);
      float crystal = clamp(veins + fineVeins * 0.6, 0.0, 1.0) * reach * frost;
      color = mix(color, vec3(0.82, 0.92, 1.0), clamp(reach * frost * 0.22, 0.0, 0.5));
      color += vec3(0.75, 0.88, 1.0) * crystal * 0.7;
    }

    vec2 centered = (vUv - 0.5) * vec2(aspect, 1.0);
    color *= mix(1.0, smoothstep(1.05, 0.2, length(centered)), vignette);

    // --- Дефекты плёнки ----------------------------------------------------
    // Прожог: плёнка плавится у лампы — раскалённый край, пузыри эмульсии, обугленная кайма.
    if (burn > 0.001) {
      vec2 d = (vUv - vec2(burnX, burnY)) * vec2(aspect, 1.0);
      vec2 dir = normalize(d + 1e-5);
      float edgeNoise = fbm(dir * 4.0 + time * 0.5) + fbm(d * 14.0 - time) * 0.35;
      float field = length(d) - burn * 1.9 * (0.62 + edgeNoise * 0.45);
      float hole = 1.0 - smoothstep(-0.012, 0.0, field);
      float outside = step(0.0, field);
      float charred = (1.0 - smoothstep(0.0, 0.11, field)) * outside;
      float bubbles = smoothstep(0.62, 0.8, valueNoise(d * 46.0 + time * 4.0)) * (1.0 - smoothstep(0.0, 0.05, field)) * outside;
      color = mix(color, vec3(0.22, 0.1, 0.03), charred * 0.7);
      color += vec3(1.0, 0.8, 0.45) * exp(-abs(field) * 70.0) * 1.8 + vec3(1.0, 0.38, 0.06) * exp(-abs(field) * 22.0) * 0.9;
      color += vec3(1.0, 0.62, 0.22) * bubbles;
      color = mix(color, vec3(1.0, 0.97, 0.9), hole);
    }

    // Пыль неровной формы: тёмные крупинки на эмульсии и светлые — там, где она соскоблена.
    if (dust > 0.001) {
      for (int i = 0; i < 8; i++) {
        float fi = float(i);
        if (hash12(vec2(frame, fi * 7.3)) > dust * 0.85) continue;
        vec2 speck = vec2(hash12(vec2(frame, fi)), hash12(vec2(fi, frame)));
        float size = mix(0.0012, 0.0065, pow(hash12(vec2(fi, frame * 1.3)), 2.0));
        vec2 offset = (vUv - speck) * vec2(aspect, 1.0);
        float ragged = (valueNoise(normalize(offset + 1e-5) * 3.0 + fi * 11.0 + frame) - 0.5) * size * 0.8;
        float blot = 1.0 - smoothstep(size * 0.5, size, length(offset) + ragged);
        float bright = step(0.7, hash12(vec2(fi, frame + 4.0)));
        color = mix(color, mix(vec3(0.02), vec3(0.9, 0.88, 0.82), bright), blot * 0.85);
      }
      // Волосок: изогнутая нить, держится несколько кадров.
      float hairEpoch = floor(time * 1.5);
      if (hash12(vec2(hairEpoch, 91.0)) < dust * 0.25) {
        vec2 anchor = vec2(hash12(vec2(hairEpoch, 1.0)), hash12(vec2(hairEpoch, 2.0)));
        float angle = hash12(vec2(hairEpoch, 3.0)) * 6.2831;
        vec2 p = (vUv - anchor) * vec2(aspect, 1.0);
        vec2 axis = vec2(cos(angle), sin(angle));
        float t = clamp(dot(p, axis), 0.0, 0.12);
        vec2 curve = axis * t + vec2(-axis.y, axis.x) * sin(t * 40.0) * 0.012;
        float hair = 1.0 - smoothstep(0.0006, 0.0016, length(p - curve));
        color *= 1.0 - hair * 0.85;
      }
    }

    // Царапины: живут секунды, медленно дрейфуют; разрывы бегут вдоль ленты с её протяжкой.
    if (scratches > 0.001) {
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        float epoch = floor((time + fi * 1.37) / 3.2);
        // Квадрат: в покое царапина — редкость, во время сбоя (scratches ≈ 1) их много.
        if (hash12(vec2(epoch, fi * 3.1)) > scratches * scratches) continue;
        float x = hash12(vec2(epoch, fi)) + sin(time * 0.6 + fi) * 0.004 + (hash12(vec2(frame, fi)) - 0.5) * 0.4 / resolution.x;
        float width = mix(0.6, 1.8, hash12(vec2(epoch, fi + 5.0)));
        float line = exp(-pow(abs(vUv.x - x) * resolution.x / width, 2.0));
        float breaks = step(0.3, valueNoise(vec2(fi * 13.0, vUv.y * 5.0 + time * FILM_FPS * 0.35)));
        vec3 tone = hash12(vec2(epoch, fi + 9.0)) > 0.6 ? vec3(0.05) : vec3(0.93, 0.9, 0.84);
        color = mix(color, tone, line * breaks * 0.4);
      }
    }

    if (hotPixels > 0.001) {
      float h = hash12(floor(gl_FragCoord.xy / 1.5) + frame * 13.1);
      color += step(1.0 - hotPixels * 0.0009, h) * vec3(0.7, 0.85, 1.0);
    }

    // Разрыв: в щели виден свет лампы, края рваные и тёмные.
    if (rip > 0.001) {
      color *= 1.0 - (1.0 - smoothstep(0.0, 0.03, ripEdge)) * (1.0 - ripGap) * 0.6 * rip;
      color = mix(color, vec3(1.0, 0.96, 0.86), ripGap);
    }

    // Перемычка между кадрами.
    color = mix(color, vec3(0.012), barMask);

    vec3 display = linearToSrgb(clamp(color, 0.0, 1.0));
    // Зерно — сгустки разного размера в яркостях экрана, сильнее в средних тонах, с лёгким цветом слоёв эмульсии.
    if (grain > 0.001) {
      vec2 grainUv = gl_FragCoord.xy / 1.7 + vec2(hash12(vec2(frame, 31.0)), hash12(vec2(frame, 47.0))) * 512.0;
      float clumps = valueNoise(grainUv) * 0.6 + valueNoise(grainUv * 2.3 + 17.0) * 0.4 - 0.5;
      vec3 layers = vec3(valueNoise(grainUv + 3.0), valueNoise(grainUv + 7.0), valueNoise(grainUv + 11.0)) - 0.5;
      float l = lumaOf(display);
      float response = 0.3 + 3.0 * l * (1.0 - l);
      display += (vec3(clumps) + layers * 0.3) * grain * 0.13 * response;
    }
    gl_FragColor = vec4(display, 1.0);
  }
`;
