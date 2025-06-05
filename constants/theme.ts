export const Theme = {
  colors: {
    background: {
      primary: '#1F2937',      // Dark blue-gray - main background
      secondary: '#2A3441',    // Lighter blue-gray - secondary background
      tertiary: '#374151',     // Light blue-gray - tertiary background
      overlay: 'rgba(0, 0, 0, 0.8)', // Modal overlay
    },

    // Text colors
    text: {
      primary: '#ffffff',      // Primary text
      secondary: '#E2E8F0',    // Secondary text
      tertiary: '#94A3B8',     // Tertiary text
      muted: '#64748B',        // Muted text
      disabled: '#475569',     // Disabled text
    },

    // Accent colors
    accent: {
      primary: '#F97316',      // Orange - main accent color
      secondary: '#EA580C',    // Darker orange
      light: '#FDBA74',        // Light orange
    },

    // Status colors
    status: {
      success: '#10B981',      // Green
      warning: '#F59E0B',      // Yellow/amber
      error: '#EF4444',        // Red
      info: '#3B82F6',         // Blue (kept for info states)
    },

    // Border colors
    border: {
      primary: '#334155',      // Primary border
      secondary: '#475569',    // Secondary border
      accent: '#F97316',       // Accent border
    },

    // Special colors
    special: {
      coin: '#F59E0B',         // Gold for coins
      level: '#10B981',        // Green for level progress
      shadow: '#000000',       // Shadow color
      heart: '#FF0000',        // Red for heart
    },

    // Transparent variations
    transparent: {
      white10: 'rgba(255, 255, 255, 0.1)',
      white20: 'rgba(255, 255, 255, 0.2)',
      white30: 'rgba(255, 255, 255, 0.3)',
      black30: 'rgba(0, 0, 0, 0.3)',
      black50: 'rgba(0, 0, 0, 0.5)',
      accent20: 'rgba(249, 115, 22, 0.2)',
      accent30: 'rgba(249, 115, 22, 0.3)',
    },
  },

  // Common styles
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    accent: {
      shadowColor: '#F97316',
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