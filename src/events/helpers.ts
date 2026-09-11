import * as THREE from 'three';

export const smoothstep = (edge0: number, edge1: number, t: number) => {
  const x = THREE.MathUtils.clamp((t - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
};

/** Однократное действие, когда прогресс переходит порог. */
export function createMilestones() {
  const fired = new Set<string>();
  return (key: string, progress: number, threshold: number, action: () => void) => {
    if (progress >= threshold && !fired.has(key)) {
      fired.add(key);
      action();
    }
  };
}

export function additiveSprite(texture: THREE.Texture, color: THREE.ColorRepresentation): THREE.Sprite {
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
}

/** Свечение по краю сферы — оболочки, ударные волны, лёд. */
export function fresnelMaterial(color: THREE.ColorRepresentation, power = 2.5): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { glowColor: { value: new THREE.Color(color) }, opacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying float vRim;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vRim = 1.0 - abs(dot(n, normalize(-viewPosition.xyz)));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 glowColor;
      uniform float opacity;
      varying float vRim;
      void main() {
        float glow = pow(vRim, ${power.toFixed(2)});
        gl_FragColor = vec4(glowColor * glow * opacity, glow * opacity);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Освобождает всё, что сценарий добавил в сцену. */
export function disposeObject(root: THREE.Object3D) {
  root.removeFromParent();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    materials.forEach(material => material.dispose());
  });
}

/**
 * Облако частиц, разлетающихся из точки. Направления заданы один раз,
 * разлёт считает шейдер — процессор не переписывает тысячи координат каждый кадр.
 */
export function createBurstParticles(count: number, color: THREE.ColorRepresentation, seed: number, coneAngle = Math.PI) {
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const directions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const direction = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // Равномерно по сферическому сегменту вокруг +Z; при угле π — во все стороны.
    const cosTheta = 1 - random() * (1 - Math.cos(coneAngle));
    const sinTheta = Math.sqrt(1 - cosTheta * cosTheta);
    const phi = random() * Math.PI * 2;
    direction.set(sinTheta * Math.cos(phi), sinTheta * Math.sin(phi), cosTheta);
    direction.toArray(directions, i * 3);
    speeds[i] = 0.3 + Math.pow(random(), 2) * 1.0;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(directions, 3));
  geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { spread: { value: 0 }, opacity: { value: 1 }, tint: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      attribute float speed;
      uniform float spread;
      varying float vHeat;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position * spread * speed, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(40.0 / -viewPosition.z, 1.0, 6.0);
        vHeat = speed;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      uniform vec3 tint;
      varying float vHeat;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(tint * (1.5 + vHeat * 2.0) * opacity, opacity);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}
