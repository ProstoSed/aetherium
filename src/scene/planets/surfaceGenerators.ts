import type { BodyId } from '../../data/bodies';

/**
 * Генераторы поверхностей в GLSL. Каждый получает точку p на единичной сфере и возвращает
 * цвет (в гамме sRGB, 0…1) и высоту. Цвета подобраны по снимкам миссий, детали — узнаваемые:
 * моря и лучевой кратер Луны, шапки и каньон Марса, Большое Красное Пятно, шестиугольник
 * Сатурна, Большое Тёмное Пятно Нептуна. Это не карты: расположение деталей условное.
 *
 * Земля дополнительно печёт карту свойств (шероховатость, огни городов, суша) и облака.
 */
export type SurfaceRecipe = {
  /** Размер грани кубической карты. */
  faceSize: number;
  /** Высота нужна для рельефа: хранится в half float, иначе в 8 битах видны ступени. */
  relief: boolean;
  glsl: string;
  extraGlsl?: string;
  cloudsGlsl?: string;
};

const MERCURY = /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    float plains = smoothstep(0.05, 0.5, fbm(p * 1.6 + 3.0, 4) * 0.5 + 0.5);
    float craters = craterField(p, 4.0, 0.5, 1.0) + craterField(p, 11.0, 0.65, 0.9) + craterField(p, 29.0, 0.75, 0.8) * (1.0 - plains * 0.7)
                  + craterField(p, 70.0, 0.8, 0.6) * (1.0 - plains * 0.5);
    float detail = fbm(p * 30.0, 5);
    height = 0.5 + craters * 3.0 + detail * 0.01;
    float tone = 0.45 + fbm(p * 2.5, 5) * 0.14 + detail * 0.05 + craters * 4.0;
    vec3 color = mix(vec3(0.30, 0.29, 0.27), vec3(0.62, 0.59, 0.54), clamp(tone, 0.0, 1.0));
    color = mix(color, vec3(0.34, 0.33, 0.32), plains * 0.35);
    albedo = color;
  }
`;

const MOON = /* glsl */ `
  const vec3 TYCHO = vec3(0.30, -0.74, 0.60);
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    vec3 q = warp(p * 1.25, 0.35, 4);
    // Моря тяготеют к стороне, обращённой к Земле.
    float maria = smoothstep(0.12, 0.32, fbm(q, 5) + p.x * 0.28 - 0.05);
    float craters = craterField(p, 5.0, 0.3, 0.8) + craterField(p, 13.0, 0.45, 0.7) * (1.0 - maria * 0.7)
                  + craterField(p, 34.0, 0.6, 0.6) * (1.0 - maria * 0.8) + craterField(p, 80.0, 0.75, 0.5) * (1.0 - maria * 0.6);
    height = 0.5 + craters * 3.0 - maria * 0.004 + fbm(p * 40.0, 4) * 0.004;
    vec3 highlands = vec3(0.63, 0.61, 0.57);
    vec3 basalt = vec3(0.24, 0.235, 0.23);
    vec3 color = mix(highlands, basalt, maria);
    color *= 0.9 + fbm(p * 12.0, 5) * 0.12 + craters * 3.0;
    // Лучевая система молодого кратера: светлые выбросы, расходящиеся по большим кругам.
    vec3 tycho = normalize(TYCHO);
    float distanceToTycho = acos(clamp(dot(p, tycho), -1.0, 1.0));
    vec3 azimuth = normalize(cross(p, tycho) + 1e-5);
    float rays = pow(max(snoise(azimuth * 7.0), 0.0), 2.5) * exp(-distanceToTycho * 2.2) * smoothstep(0.03, 0.08, distanceToTycho);
    color += vec3(0.28) * rays;
    albedo = clamp(color, 0.0, 1.0);
  }
`;

const MARS = /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    vec3 q = warp(p * 1.8, 0.4, 4);
    float dark = smoothstep(0.02, 0.38, fbm(q, 6));
    float highlands = ridged(p * 3.0, 6);
    float craters = craterField(p, 7.0, 0.22, 0.8) + craterField(p, 19.0, 0.4, 0.6) + craterField(p, 48.0, 0.6, 0.45);
    // Каньон вдоль экватора, как долины Маринер: узкая извилистая борозда.
    float canyonLine = p.y + 0.12 + snoise(p * 5.0) * 0.035;
    float canyon = exp(-pow(canyonLine * 34.0, 2.0)) * smoothstep(0.35, 0.7, snoise(p * 1.3 + 4.0) * 0.5 + 0.5);
    height = 0.5 + highlands * 0.035 + craters * 2.5 - canyon * 0.03 + fbm(p * 26.0, 4) * 0.004;
    vec3 rust = vec3(0.70, 0.35, 0.18);
    vec3 ochre = vec3(0.84, 0.58, 0.35);
    vec3 basalt = vec3(0.33, 0.19, 0.12);
    vec3 color = mix(rust, ochre, smoothstep(-0.35, 0.55, fbm(p * 5.0, 5)));
    color = mix(color, basalt, dark * 0.7);
    color *= 0.92 + highlands * 0.12;
    float cap = smoothstep(0.92, 0.94, abs(p.y) + snoise(p * 9.0) * 0.02);
    color = mix(color, vec3(0.94, 0.91, 0.87), cap);
    albedo = color;
  }
`;

const VENUS = /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    vec3 q = warp(p, 0.55, 5);
    float swirl = fbm(vec3(q.x * 2.4, q.y * 6.5, q.z * 2.4), 7) * 0.5 + 0.5;
    float chevrons = sin(p.y * 5.0 + q.x * 2.2 + q.z * 1.4) * 0.5 + 0.5;
    vec3 color = mix(vec3(0.74, 0.62, 0.40), vec3(0.96, 0.90, 0.76), swirl);
    color *= 0.88 + 0.12 * chevrons;
    albedo = color;
    height = 0.5;
  }
`;

const EARTH_COMMON = /* glsl */ `
  const float SEA_LEVEL = 0.1;
  float earthElevation(vec3 p) {
    vec3 q = warp(p * 1.35, 0.5, 5);
    float e = fbm(q, 8);
    e += ridged(p * 3.6, 7) * 0.22 * smoothstep(0.0, 0.25, e);
    return e;
  }
  float earthTemperature(vec3 p, float elevation) {
    return 1.0 - abs(p.y) * 1.2 - max(elevation - SEA_LEVEL, 0.0) * 1.6 + snoise(p * 3.0) * 0.07;
  }
`;

const EARTH = EARTH_COMMON + /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    float e = earthElevation(p);
    float land = smoothstep(SEA_LEVEL, SEA_LEVEL + 0.008, e);
    float temperature = earthTemperature(p, e);
    float latitude = abs(p.y);
    float moisture = fbm(p * 2.4 + 11.0, 6) * 0.5 + 0.5 - exp(-pow((latitude - 0.45) * 6.0, 2.0)) * 0.28;

    vec3 deep = vec3(0.012, 0.055, 0.15);
    vec3 shallow = vec3(0.03, 0.22, 0.34);
    vec3 ocean = mix(deep, shallow, smoothstep(SEA_LEVEL - 0.22, SEA_LEVEL, e));

    vec3 desert = vec3(0.80, 0.66, 0.45);
    vec3 steppe = vec3(0.56, 0.52, 0.33);
    vec3 forest = vec3(0.12, 0.25, 0.09);
    vec3 jungle = vec3(0.06, 0.19, 0.06);
    vec3 tundra = vec3(0.43, 0.41, 0.34);
    vec3 rock = vec3(0.40, 0.35, 0.30);
    vec3 snow = vec3(0.94, 0.95, 0.97);

    vec3 vegetation = mix(forest, jungle, smoothstep(0.62, 0.95, temperature));
    vec3 dry = mix(steppe, desert, smoothstep(0.55, 0.85, temperature));
    vec3 ground = mix(dry, vegetation, smoothstep(0.38, 0.62, moisture));
    ground = mix(tundra, ground, smoothstep(0.12, 0.34, temperature));
    ground = mix(ground, rock, smoothstep(0.24, 0.42, e));
    ground *= 0.84 + fbm(p * 48.0, 4) * 0.16;

    vec3 color = mix(ocean, ground, land);
    float ice = max(smoothstep(0.05, -0.02, temperature), smoothstep(0.84, 0.88, latitude + snoise(p * 7.0) * 0.03));
    color = mix(color, snow, ice);
    // Снег на вершинах.
    color = mix(color, snow, smoothstep(0.42, 0.55, e) * land);
    albedo = color;
    height = 0.5 + max(e - SEA_LEVEL, 0.0) * 0.06 * land;
  }
`;

const EARTH_EXTRA = EARTH_COMMON + /* glsl */ `
  void generateExtra(vec3 p, out vec4 extra) {
    float e = earthElevation(p);
    float land = smoothstep(SEA_LEVEL, SEA_LEVEL + 0.008, e);
    float latitude = abs(p.y);
    float temperature = earthTemperature(p, e);
    float ice = max(smoothstep(0.05, -0.02, temperature), smoothstep(0.84, 0.88, latitude));
    float roughness = mix(0.16, 0.92, max(land, ice));
    // Города гуще на побережьях и в умеренном поясе, собраны в скопления.
    float coast = exp(-abs(e - SEA_LEVEL) * 28.0);
    float region = smoothstep(0.05, 0.45, fbm(p * 2.6 + 40.0, 4)) * smoothstep(0.78, 0.25, latitude) * land * (1.0 - ice);
    float clusters = smoothstep(0.55, 0.92, fbm(p * 16.0 + 3.0, 4) * 0.5 + 0.5);
    float sparks = step(0.8, hash13(floor(p * 520.0)));
    float lights = region * (clusters * 0.9 + coast * 0.6) * (0.25 + sparks);
    extra = vec4(roughness, clamp(lights, 0.0, 1.0), land, 1.0);
  }
`;

const EARTH_CLOUDS = /* glsl */ `
  float generateClouds(vec3 p) {
    vec3 q = warp(p * 2.1, 0.7, 5);
    float n = fbm(q, 8) * 0.5 + 0.5;
    float latitude = abs(p.y);
    // Облачность гуще у экватора и в поясах циклонов умеренных широт, реже в субтропиках.
    float belts = 0.52 + 0.22 * exp(-pow(latitude * 8.0, 2.0)) + 0.26 * exp(-pow((latitude - 0.78) * 5.0, 2.0))
                - 0.2 * exp(-pow((latitude - 0.42) * 6.0, 2.0));
    return smoothstep(0.56, 0.86, n * belts + 0.18);
  }
`;

const JUPITER = /* glsl */ `
  const float GREAT_RED_SPOT_LATITUDE = -22.0;
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    float spotRadius, ovalRadius1, ovalRadius2;
    vec3 v = vortex(p, directionFromLatLon(GREAT_RED_SPOT_LATITUDE, 1.2), vec2(0.17, 0.08), 2.8, spotRadius);
    v = vortex(v, directionFromLatLon(-33.5, 2.3), vec2(0.05, 0.03), 3.0, ovalRadius1);
    v = vortex(v, directionFromLatLon(-33.0, -0.6), vec2(0.045, 0.028), 3.0, ovalRadius2);

    float turbulence = fbm(vec3(v.x * 3.0, v.y * 10.0, v.z * 3.0) + 2.0, 7);
    float latitude = v.y + turbulence * 0.03 + fbm(v * 20.0, 4) * 0.006;
    float bands = sin(latitude * 36.0) * 0.5 + 0.5;
    float fineBands = sin(latitude * 94.0 + 1.3) * 0.5 + 0.5;
    vec3 zone = vec3(0.91, 0.85, 0.73);
    vec3 belt = vec3(0.67, 0.45, 0.29);
    vec3 darkBelt = vec3(0.50, 0.32, 0.21);
    vec3 color = mix(belt, zone, smoothstep(0.32, 0.68, bands));
    color = mix(color, darkBelt, (1.0 - fineBands) * 0.28);
    // Экваториальная зона со сизыми «фестонами».
    float equator = exp(-pow(p.y * 9.0, 2.0));
    float festoons = smoothstep(0.55, 0.82, fbm(vec3(v.x * 6.0, v.y * 22.0, v.z * 6.0) + 5.0, 5) * 0.5 + 0.5) * equator;
    color = mix(color, vec3(0.40, 0.44, 0.52), festoons * 0.55);
    color = mix(color, vec3(0.55, 0.53, 0.52), smoothstep(0.68, 0.97, abs(p.y)));

    color = mix(color, vec3(0.78, 0.37, 0.22), smoothstep(1.0, 0.45, spotRadius) * 0.85);
    color = mix(color, vec3(0.94, 0.88, 0.78), exp(-pow((spotRadius - 1.05) * 5.0, 2.0)) * 0.55);
    color = mix(color, vec3(0.96, 0.94, 0.90), smoothstep(1.0, 0.4, ovalRadius1) * 0.9);
    color = mix(color, vec3(0.96, 0.94, 0.90), smoothstep(1.0, 0.4, ovalRadius2) * 0.9);
    albedo = color;
    height = 0.5;
  }
`;

const SATURN = /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    float latitude = p.y + fbm(vec3(p.x * 2.0, p.y * 8.0, p.z * 2.0), 6) * 0.018;
    float bands = sin(latitude * 30.0) * 0.5 + 0.5;
    float fineBands = sin(latitude * 73.0 + 0.7) * 0.5 + 0.5;
    vec3 color = mix(vec3(0.78, 0.66, 0.46), vec3(0.94, 0.87, 0.69), smoothstep(0.3, 0.7, bands));
    color *= 0.92 + fineBands * 0.08;
    color = mix(color, vec3(0.60, 0.61, 0.58), smoothstep(0.76, 0.96, abs(p.y)));
    // Шестиугольник вокруг северного полюса (~78° с. ш.).
    if (p.y > 0.9) {
      float angle = atan(p.z, p.x);
      float sector = mod(angle, 3.14159265 / 3.0) - 3.14159265 / 6.0;
      float hexagonRadius = cos(3.14159265 / 6.0) / cos(sector);
      float polarDistance = acos(clamp(p.y, -1.0, 1.0)) / radians(12.0);
      color = mix(color, vec3(0.46, 0.52, 0.56), smoothstep(hexagonRadius, hexagonRadius * 0.92, polarDistance) * 0.45);
      color += vec3(0.05) * exp(-pow((polarDistance - hexagonRadius) * 14.0, 2.0));
    }
    albedo = color;
    height = 0.5;
  }
`;

const URANUS = /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    float latitude = p.y + fbm(p * 3.0, 4) * 0.02;
    vec3 color = mix(vec3(0.60, 0.82, 0.85), vec3(0.72, 0.90, 0.91), sin(latitude * 13.0) * 0.5 + 0.5);
    color = mix(color, vec3(0.82, 0.94, 0.95), smoothstep(0.5, 0.95, p.y) * 0.45);
    color *= 0.96 + fbm(vec3(p.x * 4.0, p.y * 22.0, p.z * 4.0), 4) * 0.035;
    albedo = color;
    height = 0.5;
  }
`;

const NEPTUNE = /* glsl */ `
  void generateSurface(vec3 p, out vec3 albedo, out float height) {
    float spotRadius;
    vec3 v = vortex(p, directionFromLatLon(-20.0, 0.4), vec2(0.13, 0.07), 2.2, spotRadius);
    float latitude = v.y + fbm(vec3(v.x * 3.0, v.y * 11.0, v.z * 3.0), 6) * 0.03;
    vec3 color = mix(vec3(0.14, 0.28, 0.70), vec3(0.24, 0.43, 0.86), sin(latitude * 17.0) * 0.5 + 0.5);
    color = mix(color, vec3(0.09, 0.17, 0.48), smoothstep(0.7, 1.0, abs(p.y)) * 0.4);
    color = mix(color, vec3(0.05, 0.09, 0.30), smoothstep(1.0, 0.55, spotRadius));
    // Высотные метановые облака — белые штрихи вдоль параллелей, одно пятно рядом с тёмным вихрем.
    float streaks = smoothstep(0.74, 0.92, fbm(vec3(v.x * 7.0, v.y * 42.0, v.z * 7.0) + 3.0, 5) * 0.5 + 0.5);
    float companion = exp(-pow((spotRadius - 1.4) * 3.0, 2.0)) * step(0.0, dot(v - directionFromLatLon(-20.0, 0.4), vec3(0.0, -1.0, 0.0)));
    color = mix(color, vec3(0.92, 0.96, 1.0), clamp(streaks * 0.75 + companion * 0.6, 0.0, 1.0));
    albedo = color;
    height = 0.5;
  }
`;

/**
 * Размеры граней подобраны по видеопамяти: вместе с мип-уровнями все карты занимают ~130 МБ.
 * Рельефным телам нужен half float (вдвое дороже), поэтому они мельче газовых гигантов.
 */
export const SURFACE_RECIPES: Partial<Record<BodyId, SurfaceRecipe>> = {
  mercury: { faceSize: 384, relief: true, glsl: MERCURY },
  venus: { faceSize: 384, relief: false, glsl: VENUS },
  earth: { faceSize: 768, relief: true, glsl: EARTH, extraGlsl: EARTH_EXTRA, cloudsGlsl: EARTH_CLOUDS },
  moon: { faceSize: 384, relief: true, glsl: MOON },
  mars: { faceSize: 512, relief: true, glsl: MARS },
  jupiter: { faceSize: 768, relief: false, glsl: JUPITER },
  saturn: { faceSize: 512, relief: false, glsl: SATURN },
  uranus: { faceSize: 256, relief: false, glsl: URANUS },
  neptune: { faceSize: 384, relief: false, glsl: NEPTUNE },
};

/** Карты свойств и облаков Земли — вдвое мельче поверхности: они мягкие, а место дорогое. */
export const EXTRA_FACE_SHARE = 0.667;
