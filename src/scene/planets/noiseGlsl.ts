/**
 * Шумы для запекания поверхностей. Всё считается от точки на единичной сфере в трёх
 * измерениях: у такой функции нет ни полюсов, ни шва, поэтому поверхность не стягивается
 * к полюсам, как текстура «широта — долгота».
 *
 * snoise — трёхмерный симплекс-шум Ashima Arts / Stefan Gustavson (MIT),
 * https://github.com/ashima/webgl-noise
 */
export const NOISE_GLSL = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  /** Фрактальный шум, ≈ [−1, 1]. Каждая октава сдвинута, чтобы не совпадали узлы решётки. */
  float fbm(vec3 p, int octaves) {
    float sum = 0.0, amplitude = 0.5, norm = 0.0;
    for (int i = 0; i < 10; i++) {
      if (i >= octaves) break;
      sum += amplitude * snoise(p);
      norm += amplitude;
      p = p * 2.03 + vec3(19.1, 7.3, 3.7);
      amplitude *= 0.5;
    }
    return sum / norm;
  }

  /** Гребни — хребты и горные цепи, [0, 1]. Каждая октава гасится там, где предыдущая низкая. */
  float ridged(vec3 p, int octaves) {
    float sum = 0.0, amplitude = 0.5, norm = 0.0, weight = 1.0;
    for (int i = 0; i < 10; i++) {
      if (i >= octaves) break;
      float n = 1.0 - abs(snoise(p));
      n = n * n * weight;
      weight = clamp(n * 2.0, 0.0, 1.0);
      sum += n * amplitude;
      norm += amplitude;
      p = p * 2.05 + vec3(5.2, 1.3, 8.1);
      amplitude *= 0.5;
    }
    return sum / norm;
  }

  /** Искажение координат шумом: береговые линии, облака и завихрения становятся «природными». */
  vec3 warp(vec3 p, float amount, int octaves) {
    return p + amount * vec3(fbm(p + vec3(1.3, 7.1, 2.2), octaves), fbm(p + vec3(8.4, 2.9, 5.5), octaves), fbm(p + vec3(3.7, 4.4, 9.9), octaves));
  }

  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  float hash13(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  /**
   * Поле кратеров: чаша, приподнятый вал и выбросы вокруг. Центры — по одному на ячейку
   * трёхмерной решётки, не у каждой ячейки кратер есть (density). Возвращает приращение высоты.
   */
  float craterField(vec3 p, float scale, float density, float depth) {
    vec3 q = p * scale;
    vec3 cell = floor(q);
    vec3 f = q - cell;
    float h = 0.0;
    for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
    for (int z = -1; z <= 1; z++) {
      vec3 offset = vec3(float(x), float(y), float(z));
      vec3 id = cell + offset;
      vec3 r = hash33(id);
      if (r.x > density) continue;
      vec3 center = offset + 0.2 + 0.6 * hash33(id + 13.7);
      float radius = mix(0.12, 0.42, r.y * r.y);
      float d = length(f - center) / radius;
      if (d > 1.8) continue;
      float bowl = d < 1.0 ? (d * d - 1.0) : 0.0;
      float rim = exp(-pow((d - 1.0) * 4.5, 2.0));
      float ejecta = d > 1.0 ? exp(-(d - 1.0) * 3.0) * 0.12 : 0.0;
      h += (bowl * 0.9 + rim * 0.35 + ejecta) * radius * depth;
    }
    return h / scale;
  }

  /** Вихрь: точка поворачивается вокруг центра на угол, убывающий от центра. Для пятен газовых гигантов. */
  vec3 vortex(vec3 p, vec3 center, vec2 size, float strength, out float radius) {
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), center));
    vec3 north = cross(center, east);
    vec3 d = p - center;
    vec2 local = vec2(dot(d, east) / size.x, dot(d, north) / size.y);
    radius = length(local);
    float angle = strength * exp(-radius * radius * 1.4);
    float c = cos(angle), s = sin(angle);
    local = vec2(c * local.x - s * local.y, s * local.x + c * local.y);
    return normalize(center + east * local.x * size.x + north * local.y * size.y + center * dot(d, center));
  }

  vec3 directionFromLatLon(float latitudeDeg, float longitudeRad) {
    float lat = radians(latitudeDeg);
    return vec3(cos(lat) * cos(longitudeRad), sin(lat), cos(lat) * sin(longitudeRad));
  }
`;
