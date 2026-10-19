import { describe, it, expect } from 'vitest'
import { sceneRegistry, loadScene, isSceneImplemented, PRODUCT_ORIGINAL } from './registry'

describe('sceneRegistry', () => {
  it('contains celtic-folk-spring and theravada-water', () => {
    const ids = sceneRegistry.map((m) => m.id)
    expect(ids).toContain('celtic-folk-spring')
    expect(ids).toContain('theravada-water')
  })

  it('lists the pilot metas, the C-grade Design A scenes, then the product-original scenes', () => {
    expect(sceneRegistry.map((m) => m.id)).toEqual([
      'malawi-sansi',
      'japanese-kendama',
      'japanese-koinobori',
      'russian-matryoshka',
      'korean-yutnori',
      'chinese-diabolo',
      'chinese-tangram',
      'chinese-rattle-drum',
      'ghanaian-oware',
      'mexican-tortilla-press',
      'romanian-martisor',
      'greek-new-year-pomegranate',
      'bonfim-ribbon',
      'chinowa-kuguri',
      'zeniarai-coin-washing',
      'udo-undama',
      'japanese-daruma-otoshi',
      'paper-pinwheel',
      'chinese-steelyard',
      'garden-croquet',
      'welsh-drop-spindle',
      'scottish-plunge-churn',
      'irish-bodhran',
      'french-coffee-mill',
      'japanese-wagasa',
      'spanish-castanets',
      'japanese-shishi-odoshi',
      'german-jumping-jack',
      'finnish-kantele',
      'estonian-village-swing',
      'french-petanque',
      'english-hearth-bellows',
      'mexican-metate',
      'czech-wooden-ratchet',
      'puerto-rican-guiro',
      'valencian-folding-fan',
      'indian-charkha',
      'german-nutcracker',
      'mexican-molinillo',
      'chinese-suanpan',
      'mongolian-felt-ger',
      'peruvian-engraved-gourd', 'venetian-glass-bead',
      'korean-bojagi-wrap', 'vietnamese-bamboo-dragonfly',
      'turkish-ebru-paper', 'indonesian-angklung',
      'weifang-paper-kite', 'chinese-shadow-puppet',
      'faroese-wool-knit', 'niue-shell-necklace',
      'polish-paper-cut', 'uzbek-clay-bowl',
      'chinese-woodblock-print', 'czech-bead-star',
      'fijian-woven-fan', 'amazigh-woven-rug',
      'slovak-wire-bird', 'hungarian-embroidery-hoop', 'andalusian-ceramic-tile', 'sicilian-painted-cart',
      'bai-indigo-cloth', 'ndebele-painted-house', 'purepecha-copper-bowl', 'welsh-love-spoon',
      'barcelos-clay-rooster', 'finnish-birch-basket', 'croatian-licitar-heart', 'catalan-festival-giant',
      'sorbian-painted-egg', 'basque-sunflower', 'breton-banner', 'lithuanian-straw-garden',
      'dalarna-wooden-horse', 'aland-votive-ship', 'blang-tea', 'minangkabau-spinning-top',
      'chinese-incense', 'hongsheng-red-string', 'italian-ex-voto', 'czech-pilgrim-journal',
      'omikuji', 'polish-blessing-basket', 'navruz-sumalak', 'floating-lantern-loy-krathong',
      'omamori-cycle', 'shrine-suzu-bell', 'st-brigids-cross', 'bokjori',
      'ema-votive-plaque', 'clootie-well-rag', 'diya-oil-lamp', 'votive-candle-catholic',
      'daruma-eye-painting', 'mizuhiki', 'milagros', 'phuang-malai',
      'celtic-folk-spring',
      'shinto-torii',
      'theravada-water',
      'tibetan-wheel',
      'slavic-wreath',
      'tanzaku-tanabata',
      'yeondeunghoe',
      'furin-wind-chime',
      'crane',
      'lantern',
    ])
  })

  it('every registered scene is implemented', () => {
    for (const { id } of sceneRegistry) expect(isSceneImplemented(id)).toBe(true)
  })

  it('classifies authored scenes without a specific tradition claim as product-original', () => {
    expect(
      sceneRegistry.filter((m) => m.traditionSlug === PRODUCT_ORIGINAL).map((m) => m.id),
    ).toEqual(["minangkabau-spinning-top","hongsheng-red-string","czech-pilgrim-journal","celtic-folk-spring","theravada-water","lantern"])
  })

  it('tibetan-wheel keeps 中 sensitivity; the other new scenes are 低', () => {
    const sens = (id: string) => sceneRegistry.find((m) => m.id === id)?.sensitivity
    expect(sens('tibetan-wheel')).toBe('中')
    for (const id of ['shinto-torii', 'slavic-wreath', 'crane', 'lantern']) {
      expect(sens(id)).toBe('低')
    }
  })

  it('Design A scenes are C-grade, low sensitivity and implemented', () => {
    for (const id of ['tanzaku-tanabata', 'yeondeunghoe', 'furin-wind-chime']) {
      const meta = sceneRegistry.find((m) => m.id === id)
      expect(meta?.grade).toBe('C')
      expect(meta?.sensitivity).toBe('低')
      expect(isSceneImplemented(id)).toBe(true)
    }
  })

  it('celtic-folk-spring meta matches design', () => {
    const meta = sceneRegistry.find((m) => m.id === 'celtic-folk-spring')
    expect(meta).toEqual({
      id: 'celtic-folk-spring',
      title: '泉边一念',
      traditionSlug: PRODUCT_ORIGINAL,
      grade: 'C',
      sensitivity: '低',
      gestures: ['gyro', 'drag', 'wishWrite'],
    })
  })

  it('theravada-water meta matches design', () => {
    const meta = sceneRegistry.find((m) => m.id === 'theravada-water')
    expect(meta).toEqual({
      id: 'theravada-water',
      title: '花水位一倾',
      traditionSlug: PRODUCT_ORIGINAL,
      grade: 'C',
      sensitivity: '低',
      gestures: ['tilt', 'drag'],
    })
  })
})

describe('loadScene', () => {
  it('resolves celtic-folk-spring module with matching meta', async () => {
    const mod = await loadScene('celtic-folk-spring')
    expect(mod.meta.id).toBe('celtic-folk-spring')
    expect(mod.meta.title).toBe('泉边一念')
    expect(typeof mod.create).toBe('function')
  })

  it('resolves theravada-water module with matching meta', async () => {
    const mod = await loadScene('theravada-water')
    expect(mod.meta.id).toBe('theravada-water')
    expect(mod.meta.title).toBe('花水位一倾')
    expect(mod.meta.gestures).toEqual(['tilt', 'drag'])
    expect(typeof mod.create).toBe('function')
  })

  it.each([
    ['malawi-sansi', '铁舌轻鸣', 'mbira-sansi-craft'],
    ['japanese-kendama', '剑玉轻接', 'japanese-kendama-craft'],
    ['japanese-koinobori', '鲤旗迎风', 'japanese-koinobori'],
    ['russian-matryoshka', '套娃相藏', 'russian-matryoshka'],
    ['korean-yutnori', '木柶行棋', 'korean-yutnori'],
    ['chinese-diabolo', '空竹轻扬', 'chinese-diabolo'],
    ['chinese-tangram', '七巧归方', 'chinese-tangram'],
    ['chinese-rattle-drum', '拨浪轻响', 'chinese-rattle-drum'],
    ['ghanaian-oware', '木窝播籽', 'ghanaian-oware'],
    ['mexican-tortilla-press', '木压成圆', 'mexican-tortilla-press'],
    ['valencian-folding-fan', '折扇轻风', 'valencian-folding-fan'],
    ['german-jumping-jack', '牵绳木偶', 'german-jumping-jack'],
    ['finnish-kantele', '五弦轻拨', 'finnish-kantele'],
    ['estonian-village-swing', '秋千轻荡', 'estonian-village-swing'],
    ['french-petanque', '银球近靶', 'french-petanque'],
    ['english-hearth-bellows', '风囊轻送', 'english-hearth-bellows'],
    ['mexican-metate', '石面磨香', 'mexican-metate'],
    ['czech-wooden-ratchet', '木齿轻转', 'czech-wooden-ratchet'],
    ['puerto-rican-guiro', '瓜棱轻奏', 'puerto-rican-guiro'],
    ['indian-charkha', '棉线慢成', 'indian-charkha-craft'],
    ['german-nutcracker', '木偶开果', 'erzgebirge-nutcracker-craft'],
    ['mexican-molinillo', '木旋起沫', 'molinillo-chocolate-craft'],
    ['chinese-suanpan', '拨珠见数', 'chinese-zhusuan'],
    ['mongolian-felt-ger', '毡屋向阳', 'mongolian-ger-craft'],
    ['peruvian-engraved-gourd', '葫芦刻光', 'peruvian-mate-burilado'],
    ['venetian-glass-bead', '玻珠凝彩', "italian-glass-beads"],
    ['korean-bojagi-wrap', '方巾裹礼', 'korean-bojagi'],
    ['vietnamese-bamboo-dragonfly', '竹蜓点风', 'thach-xa-bamboo-dragonfly'],
    ['turkish-ebru-paper', '浮彩成笺', 'turkish-ebru'],
    ['indonesian-angklung', '竹音轻摇', 'indonesian-angklung'],
    ['weifang-paper-kite', '纸鸢乘风', "weifang-kite-craft"],
    ['chinese-shadow-puppet', '影偶小戏', "chinese-shadow-puppet"],
    ['fijian-woven-fan', '叶扇纳凉', "fijian-iri-fan"],
    ['polish-paper-cut', '剪纸开花', "polish-wycinanki"],
    ['uzbek-clay-bowl', '陶轮慢成', "uzbek-ceramic-craft"],
    ['chinese-woodblock-print', '木版留春', "chinese-woodblock-print"],
    ['czech-bead-star', '珠星映光', "czech-glass-bead-ornaments"],
    ['amazigh-woven-rug', '织毯寄暖', "moroccan-amazigh-textiles"],
    ['slovak-wire-bird', '铁线栖鸟', "slovak-wire-craft"],
    ['hungarian-embroidery-hoop', '花绣寄语', "hungarian-embroidery"],
    ['andalusian-ceramic-tile', '釉彩映晴', "andalusian-ceramic-tile"],
    ['sicilian-painted-cart', '彩车迎晴', "sicilian-carretto-craft"],
    ['bai-indigo-cloth', '蓝白晾晴', "bai-tie-dye"],
    ['ndebele-painted-house', '彩墙寄家', "ndebele-wall-painting"],
    ['purepecha-copper-bowl', '铜碗拾暖', "santa-clara-copper-craft"],
    ['welsh-love-spoon', '木勺寄情', "welsh-love-spoons"],
    ['barcelos-clay-rooster', '陶鸡报晓', "barcelos-clay-rooster"],
    ['finnish-birch-basket', '桦篮拾光', "finnish-birch-bark-craft"],
    ['croatian-licitar-heart', '彩心相赠', "croatian-licitar"],
    ['catalan-festival-giant', '巨偶待游', "catalan-gegants"],
    ['sorbian-painted-egg', '彩蛋寄春', "sorbian-easter-eggs"],
    ['basque-sunflower', '太阳花迎门', "basque-eguzkilore"],
    ['breton-banner', '节旗轻展', "breton-pardons"],
    ['lithuanian-straw-garden', '草穗悬园', "lithuanian-straw-gardens"],
    ['dalarna-wooden-horse', '木马安放', "dalarna-wooden-horse"],
    ['aland-votive-ship', '舟模寄谢', "aland-votive-ship"],
    ['blang-tea', '茶山一盏', "jingmai-tea-forest"],
    ['minangkabau-spinning-top', '木陀轻转', PRODUCT_ORIGINAL],
    ['chinese-incense', '炉前一炷', "chinese-incense"],
    ['hongsheng-red-string', '红绳自持', PRODUCT_ORIGINAL],
    ['italian-ex-voto', '绘牌记谢', "italian-ex-voto"],
    ['czech-pilgrim-journal', '旅途一页', PRODUCT_ORIGINAL],
    ['omikuji', '签纸慢读', "omikuji"],
    ['polish-blessing-basket', '一篮春食', "polish-folk-catholic"],
    ['navruz-sumalak', '春锅共煮', "uzbek-sumalak-cooking"],
    ['floating-lantern-loy-krathong', '叶舟寄意', 'floating-lantern-loy-krathong'],
    ['omamori-cycle', '御守伴行', "omamori-cycle"],
    ['shrine-suzu-bell', '庭前一铃', 'shrine-suzu-bell'],
    ['st-brigids-cross', '草编迎春', 'st-brigids-cross'],
    ['bokjori', '竹筛迎岁', 'bokjori'],
    ['ema-votive-plaque', '木牌记愿', 'ema-votive-plaque'],
    ['clootie-well-rag', '井边放下', "clootie-well-rag"],
    ['diya-oil-lamp', '灯旋一瞥', "diya-oil-lamp"],
    ['votive-candle-catholic', '留一盏烛光', "votive-candle-catholic"],
    ['daruma-eye-painting', '达摩点睛', "daruma-eye-painting"],
    ['mizuhiki', '水引结愿', 'mizuhiki'],
    ['milagros', '留一枚感谢', 'milagros'],
    ['phuang-malai', '串花寄意', "phuang-malai"],
    ['tanzaku-tanabata', '短册系竹', "tanzaku-tanabata"],
    ['yeondeunghoe', '燃灯上浮', 'yeondeunghoe'],
    ['furin-wind-chime', '风铃一响', "furin-wind-chime"],
    ['shinto-torii', '庭前一礼', 'shinto'],
    ['tibetan-wheel', '廊前轻转', 'tibetan-buddhism'],
    ['slavic-wreath', '火边花环', "kupala-wreath"],
    ['crane', '折一只纸鹤', "origami-crane-senbazuru"],
    ['lantern', '月下一灯', PRODUCT_ORIGINAL],
  ])('resolves %s module whose meta matches the registry', async (id, title, slug) => {
    const mod = await loadScene(id)
    expect(mod.meta).toEqual(sceneRegistry.find((m) => m.id === id))
    expect(mod.meta.title).toBe(title)
    expect(mod.meta.traditionSlug).toBe(slug)
    expect(typeof mod.create).toBe('function')
  })

  it('throws scene not implemented for unknown ids', async () => {
    await expect(loadScene('no-such-scene')).rejects.toThrow(
      /scene not implemented: no-such-scene/,
    )
    expect(isSceneImplemented('no-such-scene')).toBe(false)
  })
})

it('loads the bamboo tipping water feature through the scene registry',async()=>{const m=await loadScene('japanese-shishi-odoshi');expect(m.meta.id).toBe('japanese-shishi-odoshi');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the cord-linked hollow castanets through the scene registry',async()=>{const m=await loadScene('spanish-castanets');expect(m.meta.id).toBe('spanish-castanets');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the bamboo and folding paper wagasa through the scene registry',async()=>{const m=await loadScene('japanese-wagasa');expect(m.meta.id).toBe('japanese-wagasa');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the open hopper, rigid crank and sliding drawer coffee mill',async()=>{const m=await loadScene('french-coffee-mill');expect(m.meta.id).toBe('french-coffee-mill');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the frame drum and double ended wooden tipper',async()=>{const m=await loadScene('irish-bodhran');expect(m.meta.id).toBe('irish-bodhran');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the Scottish plunge churn with sliding wooden dasher',async()=>{const m=await loadScene('scottish-plunge-churn');expect(m.meta.id).toBe('scottish-plunge-churn');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the Welsh drop spindle with suspended wooden whorl',async()=>{const m=await loadScene('welsh-drop-spindle');expect(m.meta.id).toBe('welsh-drop-spindle');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads garden croquet with a real mallet and rolling ball',async()=>{const m=await loadScene('garden-croquet');expect(m.meta.id).toBe('garden-croquet');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads Chinese steelyard with real sliding weight and suspended pan',async()=>{const m=await loadScene('chinese-steelyard');expect(m.meta.id).toBe('chinese-steelyard');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads paper pinwheel with a real four vane rotor and wooden handle',async()=>{const m=await loadScene('paper-pinwheel');expect(m.meta.id).toBe('paper-pinwheel');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads daruma otoshi with three wooden discs and a striking mallet',async()=>{const m=await loadScene('japanese-daruma-otoshi');expect(m.meta.id).toBe('japanese-daruma-otoshi');expect(m.meta.gestures).toEqual(['drag']);expect(m.create).toBeTypeOf('function')})

it('loads the public Udo wishing practice with a real clay ball',async()=>{const m=await loadScene('udo-undama');expect(m.meta.id).toBe('udo-undama');expect(m.meta.traditionSlug).toBe('udo-undama');expect(m.create).toBeTypeOf('function')})

it('loads the source-specific Zeniarai washing fragment',async()=>{const m=await loadScene('zeniarai-coin-washing');expect(m.meta.id).toBe('zeniarai-coin-washing');expect(m.meta.traditionSlug).toBe('zeniarai-coin-washing');expect(m.create).toBeTypeOf('function')})

it('loads the source-specific fixed Chinowa walking fragment',async()=>{const m=await loadScene('chinowa-kuguri');expect(m.meta.id).toBe('chinowa-kuguri');expect(m.meta.traditionSlug).toBe('chinowa-kuguri');expect(m.create).toBeTypeOf('function')})

it('loads the three preformed Bonfim knots fragment',async()=>{const m=await loadScene('bonfim-ribbon');expect(m.meta.id).toBe('bonfim-ribbon');expect(m.meta.traditionSlug).toBe('bonfim-ribbon');expect(m.create).toBeTypeOf('function')})

it('loads the Greek household New Year pomegranate fragment',async()=>{const m=await loadScene('greek-new-year-pomegranate');expect(m.meta.id).toBe('greek-new-year-pomegranate');expect(m.meta.traditionSlug).toBe('greek-new-year-pomegranate');expect(m.create).toBeTypeOf('function')})
