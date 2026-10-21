import type { Messages } from './en';

/** Упрощённый китайский (zh-CN). Множественного числа нет; большие расстояния — в 万 и 亿. */
export const zh: Messages = {
  locale: 'zh-CN',

  document: {
    title: 'Aetherium — 天体力学',
    description: '按真实轨道运行的太阳系，真实比例，透过老式电影摄影机的镜头观看宇宙事件。',
  },
  brand: { tagline: '天体力学' },
  intro: { developing: '正在冲洗胶片…', ready: '就绪', loadingLabel: '正在加载场景', readyLabel: '场景已就绪' },
  webglError: { title: '需要 WebGL 2', hint: '请在浏览器设置中开启硬件加速，然后刷新页面。' },

  topBar: {
    overview: '整个太阳系',
    scale: '比例',
    illustrative: '示意',
    trueScaleShort: '真实',
    trueScaleLong: '真实比例',
    film: { off: '胶片效果：关', soft: '胶片效果：柔和', strong: '胶片效果：强烈' },
    soundOn: '开启声音',
    soundOff: '关闭声音',
    settings: '设置',
    help: '使用说明',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    language: '语言',
  },

  settings: {
    title: '设置',
    view: '显示',
    orbits: { label: '轨道', hint: '当前日期的真实椭圆' },
    labels: { label: '标签', hint: '场景中的天体名称' },
    asteroids: { label: '小行星带', hint: '7000 个天体，各有各的轨道' },
    constellations: { label: '星座', hint: '国际天文学联合会的连线与名称' },
    film: '胶片与镜头',
    filmStrength: '干扰强度',
    filmOptions: { off: '关', soft: '柔和', strong: '强烈' },
    events: '事件',
    autoEvents: { label: '自动发生', hint: '暂停一段时间后随机播放一个场景' },
    autoInterval: '事件间隔',
    minutes: count => `${count} 分钟`,
    quality: '画质',
    qualityLabel: '渲染质量',
    qualityOptions: { auto: '自动', high: '高', low: '节能' },
  },

  help: {
    title: '观看方式',
    close: '关闭',
    controls: [
      ['左键、单指', '旋转视角'],
      ['滚轮、双指', '放大和缩小'],
      ['右键', '移动视野中心'],
      ['点击天体或其标签', '天体详情'],
      ['空格', '暂停'],
      ['Esc', '关闭面板'],
    ],
    notes: [
      [
        { strong: '轨道是真实的。', text: '行星位置依据 JPL 的开普勒轨道根数按所选日期计算：椭圆、倾角、近日点进动。1800–2050 年间误差不到一度，超出这一范围则为外推。' },
      ],
      [
        { strong: '示意比例', text: '压缩距离和大小，让整个太阳系装进画面。' },
        { strong: '真实比例', text: '按实际比例显示：从火星轨道看，地球还不到一个像素，因此天体用圆圈标出。' },
      ],
      [
        { strong: '胶片干扰', text: '取决于你看向哪里：靠近太阳是过曝和热浪扭曲，木星附近是辐射，海王星附近是结霜和微弱信号。事件是虚构的，但基于真实的力学。' },
      ],
    ],
  },

  time: {
    deck: '时间流逝',
    reverse: '倒流',
    reverseOn: '时间正在倒流',
    reverseOff: '让时间倒流',
    play: '继续',
    pause: '暂停',
    playHint: '继续（空格）',
    pauseHint: '暂停（空格）',
    speed: '速度',
    speedLabel: '时间速度',
    extrapolated: (from, to) => `${from}–${to} 年以外：轨道为外推`,
    now: '现在',
    nowHint: '回到今天',
  },
  speeds: {
    realtime: '实时',
    hour: '1 小时/秒',
    day: '1 天/秒',
    week: '1 周/秒',
    month: '1 个月/秒',
    year: '1 年/秒',
    decade: '10 年/秒',
    century: '100 年/秒',
    millennium: '1000 年/秒',
  },

  date: (dayMonth, year) => (year > 0 ? `${year}年${dayMonth}` : `公元前${1 - year}年${dayMonth}`),

  units: {
    au: value => `${value} 天文单位`,
    km: value => `${value} 公里`,
    distance: (km, n) => {
      if (km >= 1e8) return `${n(km / 1e8, 2)} 亿公里`;
      if (km >= 1e4) return `${n(km / 1e4, km < 1e6 ? 1 : 0)} 万公里`;
      return `${n(km, 0)} 公里`;
    },
    lightTime: (seconds, n) => {
      if (seconds < 60) return `${n(seconds, 2)} 秒`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} 分 ${Math.round(seconds % 60)} 秒`;
      return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
    },
    seconds: count => `${count} 秒`,
    earthMasses: value => `${value} 倍地球质量`,
    days: value => `${value} 天`,
    earthDays: value => `${value} 个地球日`,
    hoursMinutes: (hours, minutes) => `${hours} 小时 ${minutes} 分`,
  },

  bodies: {
    sun: { name: '太阳', kind: '恒星，G2V 型黄矮星', description: '占整个太阳系质量的 99.86%。阳光从太阳表面到达地球需要 8 分 20 秒。' },
    mercury: { name: '水星', kind: '类地行星', description: '所有行星中最扁长的轨道：在近日点看到的太阳比在远日点大一半。' },
    venus: { name: '金星', kind: '类地行星', description: '逆向自转，而且转得极慢，一天比一年还长。由于温室效应，它比水星更热。' },
    earth: { name: '地球', kind: '类地行星', description: '已知唯一表面有液态海洋、也有生命的世界。' },
    moon: { name: '月球', kind: '地球的卫星', description: '始终以同一面朝向地球。其轨道平面每 18.6 年转一圈，决定了日月食的节律。' },
    mars: { name: '火星', kind: '类地行星', description: '这里有高 22 公里的奥林帕斯山和一条与澳大利亚一样长的峡谷。红色来自尘埃中的氧化铁。' },
    jupiter: { name: '木星', kind: '气态巨行星', description: '比其他所有行星加起来还重。大红斑是一场比地球还宽的风暴。' },
    saturn: { name: '土星', kind: '气态巨行星', description: '光环宽达 28 万公里，有些地方却只有十来米厚。平均密度比水还低。' },
    uranus: { name: '天王星', kind: '冰巨星', description: '侧躺着运行：自转轴倾斜 98°。每个极点先连续 42 年处于白昼，之后是同样长的黑夜。' },
    neptune: { name: '海王星', kind: '冰巨星', description: '1846 年靠纸笔算出——依据天王星运动的偏差。风速可达每小时 2000 公里。' },
  },

  facts: {
    diameter: '直径',
    distanceToEarth: '距地球',
    mass: '质量',
    temperature: '温度',
    meanTemperature: '平均温度',
    surfaceTemperature: '表面温度',
    equatorRotation: '赤道自转周期',
    orbitalPeriod: '公转周期',
    solarDay: '太阳日',
    day: '一天',
    axialTilt: '轴倾角',
    moons: '卫星',
  },
  noMoons: '无',

  rail: {
    label: '天体',
    overview: '整个太阳系',
    sunCaption: '太阳系中心',
    moonCaption: distance => `距地球 ${distance}`,
  },

  card: {
    label: name => `详情：${name}`,
    close: '关闭卡片',
    fromSun: '当前距太阳',
    fromEarth: '当前距地球',
    lightTime: '光从地球出发需',
    flyTo: '飞往该天体',
  },

  events: {
    alignment: { name: '行星连珠', description: '行星在太阳的同一侧排成一线。' },
    eclipse: { name: '日食', description: '阴影遮住太阳，日冕骤然闪耀。' },
    comet: { name: '大彗星', description: '来自奥尔特云的访客绕过太阳。彗尾始终背向太阳。' },
    meteors: { name: '流星雨', description: '一股流星穿过黄道面。' },
    flare: { name: '太阳的呼吸', description: '日冕物质抛射。等离子体浪潮扑向镜头。' },
    gravity: { name: '引力波', description: '空间泛起涟漪，轨道像琴弦一样颤动。' },
    rogue: { name: '迷途的流浪者', description: '海王星挣脱轨道，消失在黑暗中。' },
    ice: { name: '大冰期', description: '冰封住地球，镜头结满白霜。' },
    aliens: { name: '我们并不孤单', description: '一支外星舰队干扰了天文台的信号。' },
    blackhole: { name: '不速之渊', description: '附近诞生了一个黑洞，光线在它周围弯曲。' },
    collision: { name: '世界相撞', description: '地球与火星彼此靠近，撞击烧穿了胶片。' },
    supernova: { name: '最后的光', description: '太阳膨胀并抛出外壳。纯属虚构：我们的恒星质量太小，不会这样。' },
  },
  intensity: { quiet: '平静', strong: '强烈', devastating: '毁灭性' },

  eventsUi: {
    title: '事件',
    scenarios: '场景',
    chronicle: '纪事',
    close: '关闭',
    nextIn: '距下一个',
    running: '正在进行',
    choose: '选择一个场景',
    inProgress: '事件进行中',
    settling: '恢复平衡',
    stop: '停止事件',
    chronicleEmpty: '这里还是空的。本次观看中的每个事件都会在此留下记录。',
    clearChronicle: '清空纪事',
    completed: name => `${name} — 已结束`,
    interrupted: name => `${name} — 已中断`,
    orbitsRestored: '轨道已恢复为计算值。',
  },
};
