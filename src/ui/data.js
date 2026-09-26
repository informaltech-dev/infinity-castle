// All user-facing content (formal Traditional Chinese).

export const CHARACTERS = [
  {
    id: 'tanjiro',
    name: '竈門炭治郎',
    title: '鬼殺隊劍士',
    school: '水之呼吸・火之神神樂',
    blurb: '嗅覺靈敏，能嗅出敵人破綻的『隙之線』。兼用水之呼吸與火之神神樂，爆發力強。',
    stats: [
      ['攻擊', 4],
      ['速度', 4],
      ['防禦', 3],
      ['技巧', 3],
    ],
    techniques: [
      { key: '1', school: '水之呼吸', form: '壹之型', name: '水面斬擊', style: 'water' },
      { key: '2', school: '水之呼吸', form: '貳之型', name: '水車', style: 'water' },
      { key: '3', school: '火之神神樂', form: '', name: '圓舞', style: 'fire' },
      { key: 'R', school: '火之神神樂', form: '', name: '日暈之龍 頭舞', style: 'fire', ult: true },
    ],
    trait: '完美閃避後浮現『隙之線』，下一擊必定暴擊。',
    accent: '#ff7a2a',
    accent2: '#2f8f74',
    motif: 'checker',
    crest: '炭',
    ultStyle: 'fire',
  },
  {
    id: 'giyu',
    name: '富岡義勇',
    title: '水柱',
    school: '水之呼吸',
    blurb: '沉默寡言的水柱。劍技流暢綿密，擅長防守反擊，自創拾壹之型『凪』。',
    stats: [
      ['攻擊', 4],
      ['速度', 3],
      ['防禦', 5],
      ['技巧', 5],
    ],
    techniques: [
      { key: '1', school: '', form: '壹之型', name: '水面斬擊', style: 'water' },
      { key: '2', school: '', form: '陸之型', name: '扭轉漩渦', style: 'water' },
      { key: '3', school: '', form: '拾之型', name: '生生流轉', style: 'water' },
      { key: 'R', school: '', form: '拾壹之型', name: '凪', style: 'calm', ult: true },
    ],
    trait: '完美格擋會觸發反擊並大幅回復呼吸。',
    accent: '#4fb3e8',
    accent2: '#7a1f2e',
    motif: 'kikko',
    crest: '水',
    ultStyle: 'water',
  },
];

export const CHAR_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export const COMMON_MOVES = [
  { mouse: 'left', key: '左鍵', text: '攻擊（輕：四段連斬；重：重斬，長按蓄力施展漆之型・雫波紋擊刺）' },
  { k: 'Q', key: 'Q 鍵', text: '切換輕攻擊／重攻擊' },
  { mouse: 'right', key: '右鍵', text: '防禦（按住）；命中前一刻按下為完美格擋' },
];

// Touch-screen equivalents: {btn} is the calligraphy glyph on the on-screen button.
export const COMMON_MOVES_TOUCH = [
  { btn: '斬', key: '斬', text: '輕攻擊，連按施展四段連斬' },
  { btn: '重', key: '重', text: '重斬；按住蓄力施展漆之型・雫波紋擊刺' },
  { btn: '防', key: '防', text: '防禦（按住）；命中前一刻按下為完美格擋' },
  { btn: '閃', key: '閃', text: '閃避；命中前一刻閃避為完美閃避' },
];

export const MODES = {
  story: { label: '無限城・全程', sub: '三波鬼群＋上弦之參' },
  boss: { label: '直接挑戰・猗窩座', sub: '略過鬼群，直面上弦之參' },
};

export const MENU_ITEMS = [
  { id: 'story', num: '壹', label: '開始遊戲', sub: '無限城・全程 ── 三波鬼群與上弦之參' },
  { id: 'boss', num: '貳', label: '直接挑戰・猗窩座', sub: '略過鬼群，直面上弦之參' },
  { id: 'controls', num: '參', label: '操作說明', sub: '鍵盤、滑鼠與手把操作一覽', touchSub: '觸控與手把操作一覽' },
  { id: 'settings', num: '肆', label: '設定', sub: '聲音、操作、畫面與難度' },
];

export const PAUSE_ITEMS = [
  { id: 'resume', label: '繼續' },
  { id: 'controls', label: '操作說明' },
  { id: 'settings', label: '設定' },
  { id: 'restart', label: '重新開始', confirm: '確定要重新開始嗎？目前的戰鬥進度將會遺失。' },
  { id: 'quit', label: '回到標題', confirm: '確定要回到標題畫面嗎？目前的戰鬥進度將會遺失。' },
];

// Key/glyph tokens: {k, w} key cap · {mouse} mouse glyph · {pad} gamepad glyph · {sep} separator text · {tag} small tag
export const CONTROLS_KB = [
  { keys: [{ k: 'W' }, { k: 'A' }, { k: 'S' }, { k: 'D' }], label: '移動' },
  { keys: [{ mouse: 'move', text: '滑鼠' }], label: '視角' },
  { keys: [{ k: 'Shift', w: 1.7 }, { tag: '按住' }], label: '衝刺' },
  { keys: [{ k: '空白鍵', w: 2.6 }], label: '閃避', note: '瞬間無敵，於敵人命中前一刻閃避可觸發「完美閃避」' },
  { keys: [{ mouse: 'left', text: '左鍵' }], label: '攻擊', note: '輕攻擊連按四段；重攻擊長按蓄力' },
  { keys: [{ k: 'Q' }], label: '切換輕／重攻擊', note: '目前模式顯示於畫面左下角' },
  { keys: [{ mouse: 'right', text: '右鍵' }, { tag: '按住' }], label: '防禦', note: '敵人命中前一刻按下為「完美格擋」' },
  { keys: [{ k: '1' }, { sep: '／' }, { k: '2' }, { sep: '／' }, { k: '3' }], label: '呼吸法招式', note: '消耗呼吸值' },
  { keys: [{ k: 'R' }], label: '奧義', note: '全集中值滿時' },
  { keys: [{ k: 'Tab', w: 1.5 }, { sep: '或' }, { mouse: 'middle', text: '滑鼠中鍵' }], label: '鎖定目標' },
  { keys: [{ k: 'Esc', w: 1.4 }], label: '暫停' },
];

// {touch: 'stick'|'drag'|'tap'} gesture glyph · {btn: '斬'} on-screen button
export const CONTROLS_TOUCH = [
  { keys: [{ touch: 'stick', text: '左半邊' }], label: '移動', note: '手指按住左半邊任一處即出現搖桿；推出外圈即衝刺' },
  { keys: [{ touch: 'drag', text: '右半邊' }], label: '視角', note: '在右半邊空白處滑動' },
  { keys: [{ btn: '斬' }], label: '輕攻擊', note: '連按施展四段連斬' },
  { keys: [{ btn: '重' }, { tag: '按住' }], label: '重攻擊', note: '按住蓄力，放開施展漆之型・雫波紋擊刺' },
  { keys: [{ btn: '閃' }], label: '閃避', note: '敵人命中前一刻閃避為「完美閃避」' },
  { keys: [{ btn: '防' }, { tag: '按住' }], label: '防禦', note: '敵人命中前一刻按下為「完美格擋」' },
  { keys: [{ btn: '壹' }, { sep: '／' }, { btn: '貳' }, { sep: '／' }, { btn: '參' }], label: '呼吸法招式', note: '外圈三鈕，標示各招式的型數或首字；消耗呼吸值' },
  { keys: [{ btn: '奧' }], label: '奧義', note: '全集中值蓄滿時發光' },
  { keys: [{ btn: '鎖' }, { sep: '或' }, { touch: 'tap', text: '輕觸敵人' }], label: '鎖定目標' },
  { keys: [{ touch: 'pause' }], label: '暫停', note: '畫面右上角' },
];

export const CONTROLS_PAD = [
  { keys: [{ pad: 'stickL', text: '左搖桿' }], label: '移動' },
  { keys: [{ pad: 'stickR', text: '右搖桿' }], label: '視角' },
  { keys: [{ pad: 'X' }, { sep: '／' }, { pad: 'square' }], label: '輕攻擊' },
  { keys: [{ pad: 'Y' }, { sep: '／' }, { pad: 'triangle' }], label: '重攻擊' },
  { keys: [{ pad: 'A' }, { sep: '／' }, { pad: 'cross' }], label: '閃避' },
  { keys: [{ pad: 'RB' }], label: '防禦' },
  { keys: [{ pad: 'LB' }, { sep: '＋' }, { pad: 'X' }, { sep: '／' }, { pad: 'Y' }, { sep: '／' }, { pad: 'B' }], label: '招式一／二／三' },
  { keys: [{ pad: 'RT' }], label: '奧義' },
  { keys: [{ pad: 'stickR', press: true, text: '右搖桿按下' }], label: '鎖定' },
  { keys: [{ pad: 'Start' }], label: '暫停' },
];

const pct = (v) => `${Math.round(v * 100)}`;

export const SETTINGS_GROUPS = [
  {
    title: '聲音',
    rows: [
      { key: 'masterVolume', label: '主音量', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct, desc: '調整整體音量。' },
      { key: 'sfxVolume', label: '音效', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct, desc: '調整刀劍、招式與介面音效的音量。' },
      { key: 'musicVolume', label: '音樂', type: 'slider', min: 0, max: 1, step: 0.05, fmt: pct, desc: '調整背景音樂的音量。' },
    ],
  },
  {
    title: '操作',
    rows: [
      {
        key: 'mouseSensitivity', label: '滑鼠靈敏度', type: 'slider', min: 0.3, max: 2.5, step: 0.1, fmt: (v) => v.toFixed(1), desc: '調整以滑鼠轉動視角的速度。',
        touchLabel: '視角靈敏度', touchDesc: '調整在畫面右半邊滑動時，視角轉動的速度。',
      },
      { key: 'invertY', label: '反轉垂直視角', type: 'toggle', desc: '開啟後，滑鼠向上移動時視角向下。', touchDesc: '開啟後，手指向上滑動時視角向下。' },
      {
        key: 'touchButtonSize',
        label: '觸控按鈕大小',
        type: 'choice',
        touchOnly: true,
        options: [
          { v: 's', t: '小' },
          { v: 'm', t: '中' },
          { v: 'l', t: '大' },
        ],
        desc: '調整畫面上搖桿與攻擊按鈕的大小。',
      },
    ],
  },
  {
    title: '畫面',
    rows: [
      {
        key: 'renderScale',
        label: '解析度倍率',
        type: 'choice',
        options: [
          { v: 'auto', t: '自動' },
          { v: 0.5, t: '0.5 倍' },
          { v: 0.75, t: '0.75 倍' },
          { v: 1, t: '1 倍' },
          { v: 1.25, t: '1.25 倍' },
          { v: 1.5, t: '1.5 倍' },
        ],
        desc: '調整算繪解析度。數值越低效能越佳，越高畫面越細緻；「自動」會依影格率即時調整。',
      },
      {
        key: 'animStyle',
        label: '作畫風格',
        type: 'choice',
        options: [
          { v: 'anime', t: '逐格作畫' },
          { v: 'smooth', t: '流暢' },
        ],
        desc: '逐格作畫：模仿動畫的頓格節奏；流暢：以最高影格率呈現動作。',
      },
      { key: 'cameraShake', label: '鏡頭震動', type: 'slider', min: 0, max: 1.5, step: 0.1, fmt: (v) => `${Math.round(v * 100)}%`, desc: '調整命中與爆發時的鏡頭震動強度。' },
      { key: 'damageNumbers', label: '傷害數字', type: 'toggle', desc: '顯示或隱藏命中時浮現的傷害數字。' },
    ],
  },
  {
    title: '遊戲',
    rows: [
      {
        key: 'difficulty',
        label: '難度',
        type: 'choice',
        options: [
          { v: 'easy', t: '簡單' },
          { v: 'normal', t: '普通' },
          { v: 'hard', t: '困難' },
        ],
        desc: '影響敵人的攻擊力、攻擊頻率與反應速度。',
      },
    ],
  },
];

export const RANK_GLYPH = { S: '秀', A: '優', B: '良', C: '可' };
export const RANK_WORD = { S: '無上之境', A: '技冠群倫', B: '穩健可靠', C: '尚待磨練' };

export const LOADING_TIPS = [
  '於敵人命中前一刻閃避，可觸發「完美閃避」。',
  '按住右鍵防禦；在敵人命中前一刻按下即為「完美格擋」。',
  '按 Q 切換輕攻擊與重攻擊，目前模式顯示於畫面左下角。',
  '全集中值蓄滿後，按 R 施展奧義。',
  '呼吸法招式會消耗呼吸值，連擊與格擋可使其回復。',
  '按 Tab 或滑鼠中鍵鎖定目標，便於追擊。',
  '重攻擊模式下長按左鍵蓄力，可施展漆之型・雫波紋擊刺。',
];

export const LOADING_TIPS_TOUCH = [
  '於敵人命中前一刻按「閃」，可觸發「完美閃避」。',
  '按住「防」防禦；在敵人命中前一刻按下即為「完美格擋」。',
  '按住「重」蓄力，放開即施展漆之型・雫波紋擊刺。',
  '全集中值蓄滿後，「奧」鈕會發光，按下施展奧義。',
  '左手搖桿推出外圈即可衝刺。',
  '輕觸畫面上的敵人即可鎖定，便於追擊。',
  '設定中可調整觸控按鈕大小與視角靈敏度。',
];

/** Numeral glyph for a skill slot: 壹之型 -> 壹, 拾壹之型 -> 拾壹, 火之神神樂 -> 火 */
export function formGlyph(form, name) {
  const f = String(form || '');
  const m = f.match(/^(.+?)之型/);
  if (m) return m[1];
  if (f) return f[0];
  const n = String(name || '');
  return n ? n[0] : '';
}

/** Glyph for the ultimate slot: last segment after 「・」, first character. */
export function ultGlyph(name) {
  const n = String(name || '').trim();
  if (!n) return '奧';
  const seg = n.split('・').pop().trim();
  return seg[0] || '奧';
}
