import { useWindowDimensions } from 'react-native';

/**
 * V28's tablet experience is a media query at 700px (with a further step at
 * 1100px for the atlas grid). The same breakpoints drive the layout here, so
 * an iPad or a large Android tablet gets the spacious kitchen companion
 * rather than a stretched phone screen.
 */
export type Layout = ReturnType<typeof useLayout>;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const tablet = width >= 700;
  const wide = width >= 1100;

  return {
    width,
    height,
    tablet,
    wide,

    // .app / main
    railWidth: tablet ? 118 : 0,
    contentMaxWidth: tablet ? 1180 : 430,
    pagePadding: tablet ? 34 : 18,

    // type scale
    h1: tablet ? 48 : 36,
    h1Line: tablet ? 49 : 38,
    h2: tablet ? 34 : 28,
    h3: tablet ? 24 : 21,
    body: tablet ? 15 : 14,
    bodyLine: tablet ? 23 : 21,
    brand: tablet ? 34 : 29,

    // .section
    sectionGap: tablet ? 38 : 26,
    cardPadding: tablet ? 24 : 18,
    cardRadius: tablet ? 28 : 24,

    // rails become grids on tablet
    railColumns: tablet ? 3 : 0,
    worldColumns: tablet ? 4 : 0,
    foodColumns: tablet ? 3 : 2,
    atlasColumns: wide ? 4 : tablet ? 3 : 1,
    weekColumns: tablet ? 2 : 1,
    kitchenColumns: 2,

    // card metrics
    mealCardWidth: tablet ? 0 : 230,
    mealCardImage: tablet ? 210 : 178,
    foodCardImage: tablet ? 230 : 165,
    worldCardWidth: tablet ? 0 : 150,
    worldCardImage: tablet ? 180 : 120,
    heroImage: tablet ? 360 : 224,
    pantryMatchImage: tablet ? 190 : 108,
  };
}
