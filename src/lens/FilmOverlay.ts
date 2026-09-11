import type { PeakState } from './filmPeaks';

/**
 * Слой поверх всего окна, включая интерфейс. Шейдер к DOM не применить, поэтому
 * пик собирается из двух частей: отдельный прозрачный WebGL-холст рисует снег,
 * прожог, засветку и перемычку кадра, а сам интерфейс сдвигается и маскируется CSS.
 * Вне пиков холст скрыт и ничего не стоит.
 */
const VERTEX = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
  precision highp float;
  uniform vec2 resolution;
  uniform float time;
  uniform float whiteout;
  uniform float burn;
  uniform vec2 burnCenter;
  uniform float roll;
  uniform float staticAmount;
  uniform float rip;
  uniform float ripAngle;
  uniform float cueMark;
  varying vec2 vUv;

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

  void main() {
    float aspect = resolution.x / resolution.y;
    float frame = floor(time * 24.0);
    vec3 color = vec3(0.0);
    float alpha = 0.0;

    // Экранные координаты с верхнего края — так же, как в CSS.
    vec2 screen = vec2(vUv.x, 1.0 - vUv.y);

    if (staticAmount > 0.001) {
      float band = step(0.55, valueNoise(vec2(frame * 0.7, screen.y * 12.0)));
      float snow = hash12(gl_FragCoord.xy * 0.5 + frame * 3.7);
      float a = staticAmount * (0.35 + band * 0.45);
      color += vec3(snow) * a;
      alpha += a;
    }

    if (burn > 0.001) {
      vec2 d = (screen - burnCenter) * vec2(aspect, 1.0);
      float angleNoise = valueNoise(normalize(d + 1e-5) * 4.0 + time * 0.8) * 0.3;
      float field = length(d) - burn * 1.9 * (0.75 + angleNoise);
      float hole = 1.0 - smoothstep(-0.02, 0.0, field);
      float rim = exp(-abs(field) * 26.0);
      float char = (1.0 - smoothstep(0.0, 0.09, field)) * (1.0 - hole);
      color = mix(color, vec3(1.0, 0.97, 0.9), hole);
      alpha = max(alpha, hole);
      color += vec3(1.0, 0.45, 0.1) * rim * 1.4;
      alpha = max(alpha, max(rim, char * 0.7));
    }

    if (roll > 0.001) {
      // Перемычка на верхнем краю въезжающего кадра, по бокам — перфорация.
      float seamY = roll;
      float distanceToSeam = abs(screen.y - seamY);
      float bar = 1.0 - smoothstep(0.022, 0.028, distanceToSeam);
      float aboveSeam = step(screen.y, seamY);
      float sideX = min(screen.x, 1.0 - screen.x) * aspect;
      float perforationRow = step(0.5, fract((screen.y - seamY) * 18.0));
      float perforation = step(sideX, 0.045) * step(0.015, sideX) * perforationRow;
      vec3 barColor = vec3(0.02) + vec3(0.25, 0.2, 0.12) * (1.0 - smoothstep(0.0, 0.004, abs(distanceToSeam - 0.025)));
      color = mix(color, barColor, bar);
      alpha = max(alpha, bar);
      color = mix(color, vec3(0.9, 0.86, 0.75), perforation * 0.85);
      alpha = max(alpha, perforation * 0.85);
      // Над стыком — пустая часть ленты.
      color = mix(color, vec3(0.01), aboveSeam * (1.0 - bar) * 0.92);
      alpha = max(alpha, aboveSeam * 0.92);
    }

    // Разрыв проходит и по интерфейсу: светлая щель с тёмными рваными краями.
    if (rip > 0.001) {
      vec2 c = (vUv - 0.5) * vec2(aspect, 1.0);
      vec2 direction = vec2(cos(ripAngle), sin(ripAngle));
      float along = dot(c, direction);
      float across = dot(c, vec2(-direction.y, direction.x));
      float jag = (valueNoise(vec2(along * 18.0, ripAngle * 10.0)) - 0.5) * 0.022 + (valueNoise(vec2(along * 160.0, ripAngle)) - 0.5) * 0.005;
      float d = abs(across + jag);
      float gap = 1.0 - smoothstep(0.0, 0.0015 + rip * 0.006, d);
      float edge = (1.0 - smoothstep(0.0, 0.012, d)) * (1.0 - gap) * rip;
      color = mix(color, vec3(1.0, 0.96, 0.86), gap);
      alpha = max(alpha, max(gap, edge * 0.55));
    }

    // Метка смены части: кружок в правом верхнем углу на четыре кадра — поверх всего, как на копии фильма.
    if (cueMark > 0.5) {
      vec2 p = (screen - vec2(0.91, 0.16)) * vec2(aspect, 1.0);
      float radius = 0.026 + (valueNoise(normalize(p + 1e-5) * 5.0 + frame) - 0.5) * 0.004;
      float disc = 1.0 - smoothstep(radius - 0.003, radius, length(p));
      float rim = exp(-pow((length(p) - radius) * 220.0, 2.0));
      color = mix(color, vec3(0.93, 0.9, 0.83), disc * 0.9);
      alpha = max(alpha, max(disc * 0.9, rim * 0.8));
    }

    if (whiteout > 0.001) {
      color = mix(color, vec3(1.0, 0.98, 0.94), whiteout);
      alpha = max(alpha, whiteout);
    }

    gl_FragColor = vec4(color * alpha, alpha);
  }
`;

export class FilmOverlay {
  readonly canvas = document.createElement('canvas');
  private readonly gl: WebGLRenderingContext | null;
  private readonly program: WebGLProgram | null = null;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private visible = false;
  private hudStyled = false;

  constructor(private readonly hud: HTMLElement) {
    this.canvas.className = 'film-overlay';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!this.gl) return;
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'film overlay shader');
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    gl.useProgram(program);
    this.program = program;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const location = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['resolution', 'time', 'whiteout', 'burn', 'burnCenter', 'roll', 'staticAmount', 'rip', 'ripAngle', 'cueMark']) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  update(peak: PeakState, time: number, cueMark: boolean) {
    const hudActive = peak.whiteout > 0.001 || peak.burn > 0.001 || peak.roll > 0.001 || peak.static > 0.001 || peak.rip > 0.001;
    const active = hudActive || cueMark;
    this.styleHud(peak, hudActive);
    if (!active) {
      if (this.visible) {
        this.canvas.style.display = 'none';
        this.visible = false;
      }
      return;
    }
    if (!this.visible) {
      this.canvas.style.display = 'block';
      this.visible = true;
    }
    if (!this.gl || !this.program) return;

    // Слою хватает половинного разрешения: снег и засветка мягкие, а заливка экрана дешевле вчетверо.
    const width = Math.max(1, Math.round(window.innerWidth / 2));
    const height = Math.max(1, Math.round(window.innerHeight / 2));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
    const gl = this.gl;
    gl.uniform2f(this.uniforms.resolution, width, height);
    gl.uniform1f(this.uniforms.time, time);
    gl.uniform1f(this.uniforms.whiteout, peak.whiteout);
    gl.uniform1f(this.uniforms.burn, peak.burn);
    gl.uniform2f(this.uniforms.burnCenter, peak.burnX, peak.burnY);
    gl.uniform1f(this.uniforms.roll, peak.roll);
    gl.uniform1f(this.uniforms.staticAmount, peak.static);
    gl.uniform1f(this.uniforms.rip, peak.rip);
    gl.uniform1f(this.uniforms.ripAngle, peak.ripAngle);
    gl.uniform1f(this.uniforms.cueMark, cueMark ? 1 : 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Интерфейс участвует в пике: въезжает вместе с кадром, дёргается, выгорает по краю прожога. */
  private styleHud(peak: PeakState, active: boolean) {
    const style = this.hud.style;
    if (!active && peak.shakeX === 0 && peak.shakeY === 0) {
      if (this.hudStyled) {
        style.transform = '';
        style.opacity = '';
        style.maskImage = '';
        style.webkitMaskImage = '';
        style.filter = '';
        this.hudStyled = false;
      }
      return;
    }
    this.hudStyled = true;
    const jitterX = peak.static > 0 ? (Math.random() - 0.5) * 14 * peak.static : 0;
    const offsetY = peak.roll * window.innerHeight;
    style.transform = `translate3d(${(peak.shakeX * window.innerWidth + jitterX).toFixed(1)}px, ${(offsetY + peak.shakeY * window.innerHeight).toFixed(1)}px, 0)`;
    style.opacity = String(Math.max(0, 1 - peak.whiteout * 0.9));
    style.filter = peak.static > 0.05 ? `contrast(${1 + peak.static * 0.6}) saturate(${1 - peak.static * 0.7})` : '';
    if (peak.burn > 0.001) {
      const radius = peak.burn * 1.9 * 0.75 * window.innerHeight;
      const mask = `radial-gradient(circle at ${(peak.burnX * 100).toFixed(1)}% ${(peak.burnY * 100).toFixed(1)}%, transparent ${radius.toFixed(0)}px, black ${(radius + 40).toFixed(0)}px)`;
      style.maskImage = mask;
      style.webkitMaskImage = mask;
    } else {
      style.maskImage = '';
      style.webkitMaskImage = '';
    }
  }

  dispose() {
    this.canvas.remove();
  }
}
