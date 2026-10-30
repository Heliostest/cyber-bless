import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';

const tileSize = 24;
const tileSource = require('./assets/island-dots.png');

/** Continue the DOM ground through native safe areas, without changing layout. */
export const SafeAreaBackground = memo(function SafeAreaBackground() {
  const { width, height } = useSafeAreaFrame();
  const { top, right, bottom, left } = useSafeAreaInsets();
  const tiles = useMemo(() => {
    const positions: { left: number; top: number }[] = [];
    if (!top && !right && !bottom && !left) return positions;
    // Anchor the 24pt grid at the inset WebView's origin, extending beyond
    // the screen edges to cover partial tiles. Keep only tiles touching a
    // safe-area band: the opaque WebView already paints the content rect.
    for (let y = top % tileSize - tileSize; y < height; y += tileSize) {
      if (y + tileSize <= 0) continue;
      for (let x = left % tileSize - tileSize; x < width; x += tileSize) {
        if (x + tileSize <= 0) continue;
        if (x >= left && x + tileSize <= width - right &&
            y >= top && y + tileSize <= height - bottom) continue;
        positions.push({ left: x, top: y });
      }
    }
    return positions;
  }, [width, height, top, right, bottom, left]);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tiles.map(position => (
        <Image
          key={`${position.left}:${position.top}`}
          source={tileSource}
          // Android repeat tiles raw bitmap pixels. Explicit 24pt images
          // preserve the CSS grid even at fractional device densities.
          resizeMode="stretch"
          accessible={false}
          style={[styles.tile, position]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  tile: { position: 'absolute', width: tileSize, height: tileSize },
});
