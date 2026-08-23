/* ═══════════════════════════════════════════════════════
   OSCA — characters.js · темы для 3D-персонажей OSCA
   Каждый персонаж = набор цветов/стиля. Сама 3D-модель
   строится процедурно в viewer.js из этих настроек.
   ═══════════════════════════════════════════════════════ */

var OSCA = [
  {
    id: 'neon-neko',
    name: 'NEON NEKO',
    tag: 'Неоновая кибер-кошка · киберпанк',
    emoji: '😼',
    style: 'cat',              // тип ушей/аксессуара
    skin: 0x3d2b5f,            // цвет тела
    accent: 0x00f0ff,          // неоновая окантовка/эмиссия
    eye: 0xff2e88,             // цвет глаз
    secondary: 0x7c5cff,
    material: 'gloss',         // матовый/глянцевый/металл
    glow: true
  },
  {
    id: 'mech-x',
    name: 'MECH X',
    tag: 'Боевой мех · сталь и энергия',
    emoji: '🤖',
    style: 'antenna',
    skin: 0x4a4a5a,
    accent: 0x7dff5a,
    eye: 0x00f0ff,
    secondary: 0x9aa0b8,
    material: 'metal',
    glow: true
  },
  {
    id: 'ghost-wisp',
    name: 'GHOST WISP',
    tag: 'Призрачный дух · мистика',
    emoji: '👻',
    style: 'halo',
    skin: 0xb9ecff,
    accent: 0x7c5cff,
    eye: 0xffffff,
    secondary: 0x3d3a6d,
    material: 'glass',
    glow: true
  },
  {
    id: 'mage-void',
    name: 'MAGE VOID',
    tag: 'Маг пустоты · тёмное фэнтэзи',
    emoji: '🧙',
    style: 'hat',
    skin: 0x232036,
    accent: 0xff2e88,
    eye: 0x7c5cff,
    secondary: 0x4a3f8a,
    material: 'cloth',
    glow: true
  },
  {
    id: 'fox-blaze',
    name: 'FOX BLAZE',
    tag: 'Огненный лис · дикий стиль',
    emoji: '🦊',
    style: 'fox',
    skin: 0xd8562f,
    accent: 0xffaa2e,
    eye: 0xfff1d6,
    secondary: 0xf7e3c7,
    material: 'gloss',
    glow: true
  },
  {
    id: 'angel-halo0',
    name: 'CYBER ANGEL',
    tag: 'Кибер-ангел · небесный неон',
    emoji: '😇',
    style: 'halo',
    skin: 0xf4f1ff,
    accent: 0x00f0ff,
    eye: 0x7c5cff,
    secondary: 0xffd166,
    material: 'pearl',
    glow: true
  },
  {
    id: 'bone-mascot',
    name: 'GLITCH BONE',
    tag: 'Глитч-маскот · пиксельный вайб',
    emoji: '💀',
    style: 'antena',
    skin: 0x27262f,
    accent: 0xff2e88,
    eye: 0x00f0ff,
    secondary: 0x6a6878,
    material: 'flat',
    glow: true
  },
  {
    id: 'pumpkin-lord',
    name: 'PUMPKIN LORD',
    tag: 'Король тыкв · хэллоуин-хватка',
    emoji: '🎃',
    style: 'hat',
    skin: 0xff7a1a,
    accent: 0xffd166,
    eye: 0x27262f,
    secondary: 0x3d2b1a,
    material: 'cloth',
    glow: true
  }
];

/* Пары градиентов для галерейных карточек */
var OSCA_GRADS = [
  ['#00f0ff', '#7c5cff'],
  ['#7dff5a', '#00f0ff'],
  ['#7c5cff', '#ff2e88'],
  ['#ff2e88', '#7c5cff'],
  ['#ffaa2e', '#ff2e88'],
  ['#00f0ff', '#ffd166'],
  ['#ff2e88', '#27262f'],
  ['#ff7a1a', '#ffd166']
];