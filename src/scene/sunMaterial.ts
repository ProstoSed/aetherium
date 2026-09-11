import * as THREE from 'three';

/**
 * Поверхность Солнца: грануляция конвекционных ячеек и потемнение к краю диска.
 * Шум считается по нормали сферы, поэтому на полюсах нет растяжения текстуры.
 * Яркость выше 1 оставлена намеренно: объектив тонирует HDR-картинку и
 * «пересвечивается» от диска, как настоящая плёнка.
 */
export function createSunMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, intensity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vNormalObject = normal;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform float intensity;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float sum = 0.0, amplitude = 0.5;
        for (int i = 0; i < 4; i++) { sum += amplitude * noise(p); p *= 2.07; amplitude *= 0.5; }
        return sum;
      }

      void main() {
        vec3 p = vNormalObject * 7.0;
        float granules = fbm(p + vec3(0.0, time * 0.05, time * 0.03));
        float cells = fbm(p * 3.1 - time * 0.08);
        float spots = smoothstep(0.72, 0.8, fbm(p * 0.6 + 11.0));
        float mu = clamp(dot(vNormalView, vViewDir), 0.0, 1.0);
        // Закон потемнения к краю: I(μ) = 1 − u(1 − μ), u ≈ 0,6 для видимого света.
        float limb = 1.0 - 0.6 * (1.0 - mu);
        vec3 hot = vec3(1.9, 1.2, 0.5);
        vec3 cool = vec3(1.05, 0.36, 0.07);
        vec3 color = mix(cool, hot, granules * 0.75 + cells * 0.35) * limb;
        color *= 1.0 - spots * 0.65;
        gl_FragColor = vec4(color * intensity, 1.0);
      }
    `,
  });
}
