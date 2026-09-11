import * as THREE from 'three';

/** Радиальный градиент для свечения: яркое ядро и долгий спад. */
export function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(255,240,200,0.9)');
  gradient.addColorStop(0.25, 'rgba(255,190,110,0.35)');
  gradient.addColorStop(0.55, 'rgba(255,140,60,0.08)');
  gradient.addColorStop(1, 'rgba(255,120,40,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}
