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

  void main() {
    float aspect = resolution.x / resolution.y;
    float frame = floor(time * FILM_FPS);
    vec2 uv = vUv;
    vec3 overlay = vec3(0.0);

    // --- Геометрия кадра ---------------------------------------------------
    if (weave > 0.001) {
      uv += (vec2(hash12(vec2(frame, 1.0)), hash12(vec2(frame, 2.0))) - 0.5) * weave * vec2(0.0025, 0.004);
    }

    // Кадр съехал: изображение сдвинуто по вертикали, а на стыке видна межкадровая перемычка.
    float barMask = 0.0;
    if (roll > 0.0005) {
      float shifted = uv.y + roll;
      float seam = fract(shifted);
      seam = min(seam, 1.0 - seam);
      barMask = 1.0 - smoothstep(0.018, 0.024, seam);
      uv.y = fract(shifted);
    }

    // Разрывы: полосы строк сдвинуты вбок, ширина полос меняется от кадра к кадру.
    if (tear > 0.001) {
      float bandScale = mix(6.0, 48.0, hash12(vec2(frame, 9.0)));
      float band = floor(uv.y * bandScale);
      float pick = hash12(vec2(band, frame));
      float bandActive = step(1.0 - tear * 0.45, pick);
      uv.x += bandActive * (hash12(vec2(band, frame + 3.0)) - 0.5) * 0.18 * tear;
      overlay += bandActive * tear * vec3(0.05, 0.02, 0.0) * step(0.8, hash12(vec2(band, frame + 5.0)));
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
    vec3 color;
    if (defocus > 0.0004) {
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
      vec2 direction = (uv - 0.5);
      vec2 offset = direction * aberration * 2.0;
      color.r = mix(color.r, texture2D(tScene, uv + offset).r, 0.85);
      color.b = mix(color.b, texture2D(tScene, uv - offset).b, 0.85);
    }

    // Ореол: свет, прошедший эмульсию, отражается от подложки и ложится тёплым венцом.
    // Размытые яркие места готовит LensPass в четверти разрешения.
    if (halation > 0.001) {
      vec3 glow = texture2D(tBloom, uv).rgb;
      color += glow * mix(vec3(1.0), vec3(1.0, 0.6, 0.35), 0.6) * halation * 1.4;
    }

    color *= 1.0 - shadow;

    // --- Экспозиция и проявка ---------------------------------------------
    float flickerGain = 1.0 + (hash12(vec2(frame, 17.0)) - 0.5) * flicker * 0.35;
    color *= exposure * flickerGain;
    color = mix(color, color * vec3(tintR, tintG, tintB), tintAmount);

    if (lightLeak > 0.001) {
      float leak = fbm(vec2(vUv.y * 2.0 + time * 0.15, time * 0.1)) * smoothstep(0.45, 0.0, vUv.x);
      color += vec3(1.4, 0.55, 0.18) * leak * lightLeak;
    }

    color = acesFilm(color);

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
      float haze = reach * frost * 0.22;
      color = mix(color, vec3(0.82, 0.92, 1.0), clamp(haze, 0.0, 0.5));
      color += vec3(0.75, 0.88, 1.0) * crystal * 0.7;
    }

    vec2 centered = (vUv - 0.5) * vec2(aspect, 1.0);
    color *= mix(1.0, smoothstep(1.05, 0.2, length(centered)), vignette);

    // --- Дефекты плёнки ----------------------------------------------------
    if (burn > 0.001) {
      vec2 d = (vUv - vec2(burnX, burnY)) * vec2(aspect, 1.0);
      float edgeNoise = fbm(normalize(d + 1e-5) * 3.0 + time * 0.6) * 0.35;
      float radius = burn * 1.9;
      float field = length(d) - radius * (0.75 + edgeNoise);
      float hole = 1.0 - smoothstep(-0.02, 0.0, field);
      float rim = exp(-abs(field) * 30.0) * step(0.0001, burn);
      color = mix(color, vec3(1.0, 0.97, 0.9), hole);
      color += vec3(1.0, 0.42, 0.08) * rim * 1.6;
      color *= 1.0 - (1.0 - smoothstep(0.0, 0.12, field)) * (1.0 - hole) * 0.55;
    }

    if (dust > 0.001) {
      for (int i = 0; i < 7; i++) {
        float fi = float(i);
        if (hash12(vec2(frame, fi * 7.3)) > dust * 0.9) continue;
        vec2 speck = vec2(hash12(vec2(frame, fi)), hash12(vec2(fi, frame)));
        float size = mix(0.0015, 0.006, hash12(vec2(fi, frame * 1.3)));
        float d = length((vUv - speck) * vec2(aspect, 1.0));
        color *= 1.0 - (1.0 - smoothstep(size * 0.4, size, d)) * 0.8;
      }
    }

    if (scratches > 0.001) {
      float epoch = floor(time * 2.5);
      for (int i = 0; i < 4; i++) {
        float fi = float(i);
        // Квадрат: в покое царапина — редкость, во время сбоя (scratches ≈ 1) их много.
        if (hash12(vec2(epoch, fi * 3.1)) > scratches * scratches) continue;
        float x = hash12(vec2(epoch, fi)) + sin(time * 3.0 + fi) * 0.002;
        float line = exp(-abs(vUv.x - x) * resolution.x * 1.4);
        float visiblePart = step(hash12(vec2(epoch, fi + 11.0)) * 0.6, fract(vUv.y + hash12(vec2(frame, fi))));
        color = mix(color, vec3(0.92, 0.88, 0.8), line * visiblePart * 0.32);
      }
    }

    if (hotPixels > 0.001) {
      float h = hash12(floor(gl_FragCoord.xy / 1.5) + frame * 13.1);
      color += step(1.0 - hotPixels * 0.0025, h) * vec3(0.9, 0.95, 1.0);
    }

    // Перемычка между кадрами: тёмная полоса с тонкими светлыми краями эмульсии.
    color = mix(color, vec3(0.012), barMask);
    color += overlay;

    vec3 display = linearToSrgb(clamp(color, 0.0, 1.0));
    // Зерно — в яркостях экрана: в линейном свете гамма-кривая раздувала бы его в тенях до «снега».
    // Серебро эмульсии зернит сильнее в средних тонах, чем в глубоких тенях.
    if (grain > 0.001) {
      float n = hash12(gl_FragCoord.xy + frame * 17.0) - 0.5;
      float midtones = 0.25 + 0.75 * sin(clamp(lumaOf(display), 0.0, 1.0) * 3.14159);
      display += n * grain * 0.09 * midtones;
    }
    gl_FragColor = vec4(display, 1.0);
  }
`;
