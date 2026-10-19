import { HStack, Image, Rectangle, Spacer, Text, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, aspectRatio, clipped, containerBackground, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, padding, resizable, widgetAccentedRenderingMode, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';
import type { TodayWidgetProps } from '@wbr/core/widgets';

export function TodayWidget(props: TodayWidgetProps, environment: WidgetEnvironment) {
  'widget';
  // The isolated widget only reads public props and local App Group image files.
  // Keep this guard inside the serialized function; old timelines outlive App launches.
  const hiddenScenes = ["malawi-sansi","japanese-kendama","russian-matryoshka","korean-yutnori","chinese-diabolo","indian-charkha","german-nutcracker","mexican-molinillo","chinese-suanpan","mongolian-felt-ger","peruvian-engraved-gourd","venetian-glass-bead","vietnamese-bamboo-dragonfly","turkish-ebru-paper","indonesian-angklung","weifang-paper-kite","chinese-shadow-puppet","faroese-wool-knit","niue-shell-necklace","polish-paper-cut","uzbek-clay-bowl","chinese-woodblock-print","czech-bead-star","fijian-woven-fan","amazigh-woven-rug","slovak-wire-bird","hungarian-embroidery-hoop","andalusian-ceramic-tile","sicilian-painted-cart","bai-indigo-cloth","ndebele-painted-house","purepecha-copper-bowl","finnish-birch-basket","catalan-festival-giant","breton-banner","dalarna-wooden-horse","blang-tea","minangkabau-spinning-top","hongsheng-red-string","czech-pilgrim-journal","celtic-folk-spring","theravada-water","lantern","japanese-daruma-otoshi","paper-pinwheel","chinese-steelyard","garden-croquet","welsh-drop-spindle","scottish-plunge-churn","irish-bodhran","french-coffee-mill","japanese-wagasa","spanish-castanets","japanese-shishi-odoshi","german-jumping-jack","finnish-kantele","estonian-village-swing","french-petanque","english-hearth-bellows","mexican-metate","czech-wooden-ratchet","puerto-rican-guiro","valencian-folding-fan","mexican-tortilla-press","ghanaian-oware","chinese-rattle-drum","chinese-tangram"];
  const linkedScene = /[?&]scene=([^&]+)/.exec(props?.deepLink || '')?.[1] || '';
  const visible = hiddenScenes.includes(props?.sceneId || '') || hiddenScenes.includes(linkedScene) ? undefined : props;
  const small = environment.widgetFamily === 'systemSmall';
  const large = environment.widgetFamily === 'systemLarge';
  const title = visible?.title || '今日仪式';
  const link = visible?.deepLink || 'cyber-bless://widget/today?v=1';
  const cover = large ? visible?.previewLarge || visible?.previewSmall : small ? visible?.previewSmall : visible?.previewMedium;
  const fill = { minWidth: 0, maxWidth: Infinity, minHeight: 0, maxHeight: Infinity };
  return <ZStack alignment="bottom" modifiers={[
    frame(fill), clipped(), containerBackground('#173c34', 'widget'), widgetURL(link),
  ]}>
    {cover && <Image uiImage={cover} modifiers={[
      resizable(), aspectRatio({ contentMode: 'fill' }), frame(fill), clipped(),
      widgetAccentedRenderingMode('fullColor'),
    ]} />}
    <Rectangle modifiers={[
      foregroundStyle({ type: 'linearGradient', colors: ['#0b211800', '#0b211810', '#0b2118de'],
        startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } }), frame(fill),
    ]} />
    <HStack alignment="bottom" spacing={small ? 6 : 12} modifiers={[
      frame({ minWidth: 0, maxWidth: Infinity, alignment: 'leading' }), padding({ all: large ? 18 : small ? 10 : 14 }),
    ]}>
      <Text modifiers={[
        font({ textStyle: large ? 'title3' : small ? 'subheadline' : 'headline', weight: 'semibold' }),
        foregroundStyle('#fffef7'), lineLimit(2), minimumScaleFactor(0.75),
        accessibilityLabel(`${visible?.day || ''}，${title}`),
      ]}>{title}</Text>
      <Spacer minLength={0} />
    </HStack>
  </ZStack>;
}
