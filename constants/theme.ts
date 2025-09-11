export const Theme = {
  colors: {
    background: {
      primary: '#FBF6F2',      // Light cream - main background (inspired by garden UI)
      secondary: '#EEEDE7',    // Slightly darker cream - secondary background
      tertiary: '#E6E4DD',     // Warm light gray - tertiary background
      disabled: '#E0DFDA',     // Disabled background
      overlay: 'rgba(0, 0, 0, 0.4)', // Lighter modal overlay
    },

    // Text colors
    text: {
      primary: '#2D2B26',      // Dark brown/charcoal - primary text
      secondary: '#4A4741',    // Medium brown - secondary text
      tertiary: '#6B675E',     // Light brown - tertiary text
      muted: '#8B8680',        // Muted brown - muted text
      disabled: '#A8A39D',     // Light gray - disabled text
    },

    // Accent colors (keeping the nature-inspired orange/brown theme)
    accent: {
      primary: '#4035F1',      // Chocolate/saddle brown - main accent color
      secondary: '#4035F1',    // Sienna brown - darker accent
      light: '#DEB887',        // Burlywood - light accent
    },

    // Status colors (adjusted for light theme)
    status: {
      success: '#228B22',      // Forest green
      warning: '#DAA520',      // Goldenrod
      error: '#DC143C',        // Crimson
      info: '#4682B4',         // Steel blue
    },

    // Border colors
    border: {
      primary: '#D1CCC0',      // Light brown border
      secondary: '#C7C2B6',    // Medium light border
      disabled: '#E0DFDA',     // Disabled border
      accent: '#D2691E',       // Accent border (matches primary accent)
    },

    // Special colors (adjusted for light theme)
    special: {
      primary:{
        exp: '#4A90E2',         // Medium blue for experience
        coin: '#D2691E',        // Chocolate brown (matches accent)
        level: '#228B22',       // Forest green for level progress
        shadow: '#2D2B26',      // Dark brown shadow for light theme
        heart: '#DC143C',       // Crimson for heart
        energy: '#DAA520',      // Goldenrod for energy
        streak: '#D2691E',      // Chocolate brown for streak
        plan: '#A0522D',        // Sienna brown for plan
      },
      secondary:{
        exp: '#357ABD',         // Darker blue
        coin: '#A0522D',        // Sienna brown (darker)
        level: '#1F7A1F',       // Darker forest green
        shadow: '#1A1917',      // Darker shadow
        heart: '#B71C3C',       // Darker crimson
        energy: '#B8941C',      // Darker goldenrod
        streak: '#A0522D',      // Darker brown for streak
        plan: '#8B4513',        // Saddle brown for plan
      }
    },

    // Transparent variations (updated for light theme)
    transparent: {
      white10: 'rgba(255, 255, 255, 0.1)',
      white20: 'rgba(255, 255, 255, 0.2)',
      white30: 'rgba(255, 255, 255, 0.3)',
      black10: 'rgba(45, 43, 38, 0.1)',     // Light overlay using text primary
      black20: 'rgba(45, 43, 38, 0.2)',     // Medium overlay
      black30: 'rgba(45, 43, 38, 0.3)',     // Darker overlay
      accent20: 'rgba(210, 105, 30, 0.2)',  // Light accent overlay
      accent30: 'rgba(210, 105, 30, 0.3)',  // Medium accent overlay
    },
  },

  // Common styles (adjusted for light theme)
  shadows: {
    small: {
      shadowColor: '#2D2B26',  // Dark brown shadow for light theme
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,     // Slightly more visible on light background
      shadowRadius: 4,
      elevation: 3,
    },
    medium: {
      shadowColor: '#2D2B26',  // Dark brown shadow
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,      // More visible on light background
      shadowRadius: 8,
      elevation: 6,
    },
    large: {
      shadowColor: '#2D2B26',  // Dark brown shadow
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,     // More visible on light background
      shadowRadius: 12,
      elevation: 8,
    },
    accent: {
      shadowColor: '#D2691E',  // Chocolate brown accent shadow
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
  },

  // Border radius
  borderRadius: {
    xs: 4,
    small: 8,
    medium: 12,
    large: 16,
    xl: 20,
    full: 100,
  },

  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Font families
  fonts: {
    regular: 'SF-Pro-Rounded-Regular',
    medium: 'SF-Pro-Rounded-Medium',
    semibold: 'SF-Pro-Rounded-Semibold',
    bold: 'SF-Pro-Rounded-Bold',
  },
};

export default Theme; 