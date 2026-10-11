import { HStack, Image, Link, Rectangle, Spacer, Text, ZStack } from '@expo/ui/swift-ui';
import { accessibilityLabel, aspectRatio, background, clipped, containerBackground, cornerRadius, fixedSize, font, foregroundStyle, frame, lineLimit, minimumScaleFactor, padding, resizable, widgetAccentedRenderingMode, widgetURL } from '@expo/ui/swift-ui/modifiers';
import type { WidgetEnvironment } from 'expo-widgets';
import type { TodayWidgetProps } from '@wbr/core/widgets';

export function TodayWidget(props: TodayWidgetProps, environment: WidgetEnvironment) {
  'widget';
  // The isolated widget only reads public props and local App Group image files.
  const small = environment.widgetFamily === 'systemSmall';
  const title = props?.title || '今日仪式';
  const link = props?.deepLink || 'cyber-bless://widget/today?v=1';
  const cover = small ? props?.previewSmall : props?.previewMedium;
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
      frame({ minWidth: 0, maxWidth: Infinity, alignment: 'leading' }), padding({ all: small ? 10 : 14 }),
    ]}>
      <Text modifiers={[
        font({ textStyle: small ? 'subheadline' : 'headline', weight: 'semibold' }),
        foregroundStyle('#fffef7'), lineLimit(2), minimumScaleFactor(0.75),
        accessibilityLabel(`${props?.day || ''}，${title}`),
      ]}>{title}</Text>
      <Spacer minLength={0} />
      <Link destination={link} modifiers={[accessibilityLabel(`进入仪式：${title}`)]}>
        <Text modifiers={[
          font({ textStyle: 'caption', weight: 'semibold' }), foregroundStyle('#183b2e'),
          padding({ horizontal: small ? 8 : 12, vertical: 8 }), background('#e3f4e9'),
          cornerRadius(12), fixedSize({ horizontal: true, vertical: false }),
        ]}>进入仪式 ↗</Text>
      </Link>
    </HStack>
  </ZStack>;
}
