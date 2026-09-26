import * as THREE from 'three';
import { createNormalOverride } from './materials.js';

// Layers
export const LAYER_WORLD = 0; // opaque world + actors, gets ink outlines
export const LAYER_FX = 1; // effects, drawn after outlines, depth-tested against the world
export const LAYER_MAIN_ONLY = 2; // world objects without outlines (sky, dissolving bodies, glow cards)

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const compositeFrag = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform sampler2D tNDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uLineWidth;
uniform float uLineStrength;
uniform vec3 uInk;
uniform float uTime;
uniform float uBoil;
uniform float uDepthThr;
uniform float uNormalThr;
uniform vec2 uFade;
varying vec2 vUv;

float viewZ(float d) { return -perspectiveDepthToViewZ(d, uNear, uFar); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float t = floor(uTime * 8.0);
  vec2 boil = vec2(vnoise2(vUv * vec2(21.0, 13.0) + t * 7.13), vnoise2(vUv * vec2(17.0, 23.0) + 31.7 + t * 3.71)) - 0.5;
  vec2 uvb = vUv + boil * uBoil / uRes;
  // line weight varies slightly along the stroke like a brush
  float w = uLineWidth * (0.8 + 0.45 * vnoise2(vUv * 40.0 + t * 1.3));
  vec2 px = w / uRes;
  float dC = viewZ(texture2D(tNDepth, uvb).r);
  vec3 nC = texture2D(tNormal, uvb).rgb * 2.0 - 1.0;
  vec2 o1 = vec2(-px.x, -px.y), o2 = vec2(px.x, px.y), o3 = vec2(-px.x, px.y), o4 = vec2(px.x, -px.y);
  float d1 = viewZ(texture2D(tNDepth, uvb + o1).r);
  float d2 = viewZ(texture2D(tNDepth, uvb + o2).r);
  float d3 = viewZ(texture2D(tNDepth, uvb + o3).r);
  float d4 = viewZ(texture2D(tNDepth, uvb + o4).r);
  vec3 n1 = texture2D(tNormal, uvb + o1).rgb * 2.0 - 1.0;
  vec3 n2 = texture2D(tNormal, uvb + o2).rgb * 2.0 - 1.0;
  vec3 n3 = texture2D(tNormal, uvb + o3).rgb * 2.0 - 1.0;
  vec3 n4 = texture2D(tNormal, uvb + o4).rgb * 2.0 - 1.0;
  float dMin = min(min(d1, d2), min(min(d3, d4), dC));
  float dd = max(abs(d1 - d2), abs(d3 - d4));
  float ndv = clamp(nC.z, 0.0, 1.0);
  float g = 1.0 - ndv;
  float thr = uDepthThr * dMin * (1.0 + 9.0 * g * g * g);
  float eDepth = smoothstep(thr, thr * 1.8, dd);
  float nd = max(distance(n1, n2), distance(n3, n4));
  float eNormal = smoothstep(uNormalThr, uNormalThr + 0.3, nd);
  float edge = max(eDepth, eNormal * 0.9);
  edge *= 1.0 - smoothstep(uFade.x, uFade.y, dMin);
  vec3 col = texture2D(tColor, vUv).rgb;
  vec3 ink = mix(uInk, col * 0.16, 0.3);
  col = mix(col, ink, clamp(edge * uLineStrength, 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
  gl_FragDepth = texture2D(tDepth, vUv).r;
}
`;

const brightFrag = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture2D(tInput, vUv + uTexel * vec2(1.0, -1.0)).rgb
         + texture2D(tInput, vUv + uTexel * vec2(-1.0, 1.0)).rgb
         + texture2D(tInput, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(max(c.r, c.g), c.b);
  float k = smoothstep(uThreshold, uThreshold + 0.6, l);
  gl_FragColor = vec4(c * k, 1.0);
}
`;

const blurFrag = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tInput, vUv).rgb * 0.2270270270;
  c += texture2D(tInput, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture2D(tInput, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture2D(tInput, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const finalFrag = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform sampler2D tPaper;
uniform float uHasPaper;
uniform vec2 uRes;
uniform float uTime;
uniform float uBloom;
uniform float uPaper;
uniform float uVignette;
uniform float uImpact;
uniform float uImpactSeed;
uniform vec3 uImpactA;
uniform vec3 uImpactB;
uniform float uSpeed;
uniform vec2 uSpeedCenter;
uniform vec3 uSpeedColor;
uniform float uRadial;
uniform vec2 uRadialCenter;
uniform float uChroma;
uniform vec3 uFlashColor;
uniform float uFlash;
uniform float uDesat;
uniform vec3 uTint;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform float uDanger;
uniform float uRipple;
uniform vec2 uRippleCenter;
uniform float uRippleTime;
uniform float uGrain;
varying vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  if (uRipple > 0.001) {
    vec2 d = (uv - uRippleCenter) * vec2(aspect, 1.0);
    float r = length(d);
    float wave = sin(r * 70.0 - uRippleTime * 9.0) * exp(-r * 2.5);
    uv += (d / max(r, 1e-4)) * wave * 0.0045 * uRipple / vec2(aspect, 1.0);
  }
  vec2 dir = uv - uRadialCenter;
  vec3 col;
  if (uRadial > 0.001) {
    vec3 acc = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 12; i++) {
      float t = float(i) / 11.0;
      float w = 1.0 - t * 0.75;
      acc += texture2D(tInput, uv - dir * t * uRadial * 0.14).rgb * w;
      wsum += w;
    }
    col = acc / wsum;
  } else {
    col = texture2D(tInput, uv).rgb;
  }
  if (uChroma > 0.001) {
    vec2 off = dir * uChroma * 0.018;
    col.r = mix(col.r, texture2D(tInput, uv + off).r, 0.85);
    col.b = mix(col.b, texture2D(tInput, uv - off).b, 0.85);
  }
  col += (texture2D(tBloomA, uv).rgb * 0.8 + texture2D(tBloomB, uv).rgb * 0.9) * uBloom;
  col *= uExposure;
  // highlight shoulder, keeps flat anime colours intact below ~0.8
  vec3 over = max(col - 0.8, 0.0);
  col = min(col, 0.8) + over / (1.0 + over * 2.2);
  // to display space
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSaturation * (1.0 - uDesat));
  col = (col - 0.5) * uContrast + 0.5;
  col *= uTint;
  // split tone: cool violet shadows, warm highlights
  col += vec3(0.012, -0.004, 0.03) * (1.0 - smoothstep(0.0, 0.45, l));
  col += vec3(0.02, 0.008, -0.02) * smoothstep(0.55, 1.0, l);
  if (uHasPaper > 0.5) {
    float paper = texture2D(tPaper, vUv * uRes / 700.0).r;
    col *= mix(1.0, paper, uPaper);
  }
  vec2 vd = (vUv - 0.5) * vec2(aspect, 1.0);
  float vr = length(vd);
  col *= mix(1.0, smoothstep(1.05, 0.25, vr), uVignette);
  if (uDanger > 0.001) {
    float edge = smoothstep(0.35, 1.0, vr);
    col = mix(col, vec3(0.55, 0.02, 0.04), edge * uDanger * 0.6);
  }
  // anime speed lines
  if (uSpeed > 0.001) {
    vec2 p = (vUv - uSpeedCenter) * vec2(aspect, 1.0);
    float ang = atan(p.y, p.x) / 6.2831853 + 0.5;
    float r = length(p);
    float count = 220.0;
    float bucket = floor(ang * count);
    float tt = floor(uTime * 24.0);
    float rnd = hash11(bucket * 1.37 + tt * 0.71);
    float on = step(0.55, rnd);
    float fw = abs(fract(ang * count) - 0.5) * 2.0;
    float width = mix(0.25, 0.9, hash11(bucket + tt * 3.1));
    float inner = mix(0.28, 0.62, hash11(bucket * 7.3 + tt));
    float line = on * step(fw, width) * smoothstep(inner, inner + 0.25, r);
    col = mix(col, uSpeedColor, line * uSpeed * 0.85);
  }
  if (uImpact > 0.001) {
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    float thr = 0.5 + (hash12(floor(vUv * uRes / 3.0) + floor(uTime * 30.0)) - 0.5) * 0.08;
    float m = step(thr, lum);
    vec3 a = uImpactA, b = uImpactB;
    if (mod(uImpactSeed, 2.0) > 0.5) { vec3 tmp = a; a = b; b = tmp; }
    vec3 ic = mix(a, b, m);
    col = mix(col, ic, clamp(uImpact, 0.0, 1.0));
  }
  col = mix(col, uFlashColor, clamp(uFlash, 0.0, 1.0));
  col += (hash12(vUv * uRes + fract(uTime) * 91.0) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function makeQuadMaterial(frag, uniforms, extra = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: quadVert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...extra,
  });
}

export class Pipeline {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 1);
    this.renderScale = 1;
    this.width = 1;
    this.height = 1;

    const mkRT = (opts) => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, ...opts });
    this.rtNormal = mkRT({ type: THREE.UnsignedByteType, depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this.rtMain = mkRT({ depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType) });
    this.rtComp = mkRT({ depthBuffer: true });
    this.rtB1 = mkRT({ depthBuffer: false });
    this.rtB2 = mkRT({ depthBuffer: false });
    this.rtC1 = mkRT({ depthBuffer: false });
    this.rtC2 = mkRT({ depthBuffer: false });

    this.normalOverride = createNormalOverride();

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.compositeMat = makeQuadMaterial(
      compositeFrag,
      {
        tColor: { value: this.rtMain.texture },
        tDepth: { value: this.rtMain.depthTexture },
        tNormal: { value: this.rtNormal.texture },
        tNDepth: { value: this.rtNormal.depthTexture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.1 },
        uFar: { value: 500 },
        uLineWidth: { value: 1.25 },
        uLineStrength: { value: 0.92 },
        uInk: { value: new THREE.Color(0x140c0c) },
        uTime: { value: 0 },
        uBoil: { value: 1.6 },
        uDepthThr: { value: 0.018 },
        uNormalThr: { value: 0.45 },
        uFade: { value: new THREE.Vector2(45, 140) },
      },
      { depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth }
    );

    this.brightMat = makeQuadMaterial(brightFrag, {
      tInput: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0.92 },
    });
    this.blurMat = makeQuadMaterial(blurFrag, { tInput: { value: null }, uDir: { value: new THREE.Vector2() } });

    this.finalMat = makeQuadMaterial(finalFrag, {
      tInput: { value: this.rtComp.texture },
      tBloomA: { value: this.rtB1.texture },
      tBloomB: { value: this.rtC1.texture },
      tPaper: { value: null },
      uHasPaper: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uBloom: { value: 0.75 },
      uPaper: { value: 0.22 },
      uVignette: { value: 0.5 },
      uImpact: { value: 0 },
      uImpactSeed: { value: 0 },
      uImpactA: { value: new THREE.Color(0x0a0608) },
      uImpactB: { value: new THREE.Color(0xf6efe2) },
      uSpeed: { value: 0 },
      uSpeedCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uSpeedColor: { value: new THREE.Color(0xffffff) },
      uRadial: { value: 0 },
      uRadialCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uChroma: { value: 0 },
      uFlashColor: { value: new THREE.Color(0xffffff) },
      uFlash: { value: 0 },
      uDesat: { value: 0 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uExposure: { value: 1.0 },
      uContrast: { value: 1.06 },
      uSaturation: { value: 1.08 },
      uDanger: { value: 0 },
      uRipple: { value: 0 },
      uRippleCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uRippleTime: { value: 0 },
      uGrain: { value: 0.025 },
    });

    // Public FX parameters (written by ScreenFX each frame)
    this.fx = this.finalMat.uniforms;
    this.outline = this.compositeMat.uniforms;
    this.clearColor = new THREE.Color(0x07050a);
  }

  setPaper(tex) {
    this.finalMat.uniforms.tPaper.value = tex;
    this.finalMat.uniforms.uHasPaper.value = tex ? 1 : 0;
  }

  setSize(w, h, pixelRatio) {
    const pr = Math.max(0.5, pixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    const W = Math.max(1, Math.floor(w * pr));
    const H = Math.max(1, Math.floor(h * pr));
    this.width = W;
    this.height = H;
    this.rtNormal.setSize(W, H);
    this.rtMain.setSize(W, H);
    this.rtComp.setSize(W, H);
    const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
    this.rtB1.setSize(bw, bh);
    this.rtB2.setSize(bw, bh);
    const cw = Math.max(1, W >> 3), ch = Math.max(1, H >> 3);
    this.rtC1.setSize(cw, ch);
    this.rtC2.setSize(cw, ch);
    this.compositeMat.uniforms.uRes.value.set(W, H);
    this.finalMat.uniforms.uRes.value.set(W, H);
    // keep line weight visually stable across resolutions (reference: 1080p)
    this.compositeMat.uniforms.uLineWidth.value = Math.max(1, (H / 1080) * 1.5);
    this.compositeMat.uniforms.uBoil.value = Math.max(1, (H / 1080) * 1.8);
  }

  _quad(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    this.compositeMat.uniforms.uNear.value = camera.near;
    this.compositeMat.uniforms.uFar.value = camera.far;
    this.compositeMat.uniforms.uTime.value = time;
    this.finalMat.uniforms.uTime.value = time;

    // 1. normal + depth prepass (outlined world only)
    const prevOverride = scene.overrideMaterial;
    camera.layers.mask = 1 << LAYER_WORLD;
    scene.overrideMaterial = this.normalOverride;
    r.setRenderTarget(this.rtNormal);
    r.setClearColor(0x8080ff, 1);
    r.clear(true, true, false);
    r.render(scene, camera);
    scene.overrideMaterial = prevOverride;

    // 2. main colour pass
    camera.layers.mask = (1 << LAYER_WORLD) | (1 << LAYER_MAIN_ONLY);
    r.setRenderTarget(this.rtMain);
    r.setClearColor(this.clearColor, 1);
    r.clear(true, true, false);
    r.render(scene, camera);

    // 3. composite ink lines, copy depth
    r.setRenderTarget(this.rtComp);
    r.clear(true, true, false);
    this.quad.material = this.compositeMat;
    r.render(this.quadScene, this.quadCam);

    // 4. effects on top, depth-tested against the world
    camera.layers.mask = 1 << LAYER_FX;
    r.setRenderTarget(this.rtComp);
    r.render(scene, camera);
    camera.layers.mask = (1 << LAYER_WORLD) | (1 << LAYER_MAIN_ONLY) | (1 << LAYER_FX);

    // 5. bloom
    this.brightMat.uniforms.tInput.value = this.rtComp.texture;
    this.brightMat.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
    this._quad(this.brightMat, this.rtB1);
    this.blurMat.uniforms.tInput.value = this.rtB1.texture;
    this.blurMat.uniforms.uDir.value.set(1 / this.rtB1.width, 0);
    this._quad(this.blurMat, this.rtB2);
    this.blurMat.uniforms.tInput.value = this.rtB2.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1 / this.rtB1.height);
    this._quad(this.blurMat, this.rtB1);
    // wider level
    this.blurMat.uniforms.tInput.value = this.rtB1.texture;
    this.blurMat.uniforms.uDir.value.set(1.5 / this.rtC1.width, 0);
    this._quad(this.blurMat, this.rtC2);
    this.blurMat.uniforms.tInput.value = this.rtC2.texture;
    this.blurMat.uniforms.uDir.value.set(0, 1.5 / this.rtC1.height);
    this._quad(this.blurMat, this.rtC1);

    // 6. final screen pass
    this._quad(this.finalMat, null);
  }
}
