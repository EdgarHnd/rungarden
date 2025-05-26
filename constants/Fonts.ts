/**
 * SF Pro Rounded Font Constants
 * Use these font family names in your StyleSheet fontFamily properties
 */
export const Fonts = {
  SFProRounded: {
    Ultralight: 'SF-Pro-Rounded-Ultralight',
    Thin: 'SF-Pro-Rounded-Thin',
    Light: 'SF-Pro-Rounded-Light',
    Regular: 'SF-Pro-Rounded-Regular',
    Medium: 'SF-Pro-Rounded-Medium',
    Semibold: 'SF-Pro-Rounded-Semibold',
    Bold: 'SF-Pro-Rounded-Bold',
    Heavy: 'SF-Pro-Rounded-Heavy',
    Black: 'SF-Pro-Rounded-Black',
  },
};

/**
 * Helper function to get font family with weight
 * @param weight - The font weight (100-900)
 * @returns The corresponding SF Pro Rounded font family name
 */
export const getSFProRounded = (weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 = 400): string => {
  switch (weight) {
    case 100:
      return Fonts.SFProRounded.Ultralight;
    case 200:
      return Fonts.SFProRounded.Thin;
    case 300:
      return Fonts.SFProRounded.Light;
    case 400:
      return Fonts.SFProRounded.Regular;
    case 500:
      return Fonts.SFProRounded.Medium;
    case 600:
      return Fonts.SFProRounded.Semibold;
    case 700:
      return Fonts.SFProRounded.Bold;
    case 800:
      return Fonts.SFProRounded.Heavy;
    case 900:
      return Fonts.SFProRounded.Black;
    default:
      return Fonts.SFProRounded.Regular;
  }
}; 