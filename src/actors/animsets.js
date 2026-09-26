import * as THREE from 'three';
import { Animator, compileClip, compilePose } from './anim.js';
import {
  SWORD_STANCE, SWORD_RUN, SWORD_SPRINT, SWORD_GUARD, SWORD_CLIPS,
  AKAZA_STANCE, AKAZA_RUN, AKAZA_CLIPS,
  DEMON_STANCE, DEMON_RUN, DEMON_CLIPS,
} from './poses.js';

const cache = new Map();

function compileSet(key, stance, clips) {
  if (cache.has(key)) return cache.get(key);
  const base = compilePose(stance);
  const out = {};
  for (const name in clips) out[name] = compileClip({ name, ...clips[name] }, base);
  cache.set(key, out);
  return out;
}

/** Create an animator + compiled clip set for a built character model. */
export function createAnimator(model) {
  const id = model.id;
  let anim, clips;
  if (id === 'tanjiro' || id === 'giyu') {
    anim = new Animator(model.rig, { stance: SWORD_STANCE, run: SWORD_RUN, sprint: SWORD_SPRINT, guard: SWORD_GUARD });
    clips = compileSet('sword', SWORD_STANCE, SWORD_CLIPS);
    const grip = model.sword.grip;
    anim.sword = {
      pivot: new THREE.Vector3(-0.03, 0.12, 0.06),
      gripInvQ: grip.quaternion.clone().invert(),
      gripOffset: grip.position.clone(),
    };
    anim.ikTarget = model.sword.offhand;
  } else if (id === 'akaza') {
    anim = new Animator(model.rig, { stance: AKAZA_STANCE, run: AKAZA_RUN, sprint: AKAZA_RUN });
    clips = compileSet('akaza', AKAZA_STANCE, AKAZA_CLIPS);
  } else {
    anim = new Animator(model.rig, { stance: DEMON_STANCE, run: DEMON_RUN, sprint: DEMON_RUN });
    clips = compileSet('demon', DEMON_STANCE, DEMON_CLIPS);
  }
  return { anim, clips };
}
