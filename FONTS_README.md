# SF Pro Rounded Font Setup

This project is configured to use **SF Pro Rounded** as the primary font family across the entire app using `expo-font`.

## Available Font Weights

All SF Pro Rounded font weights are loaded and available:

| Font Weight | Font Family Name | CSS Equivalent |
|-------------|------------------|----------------|
| Ultralight  | `SF-Pro-Rounded-Ultralight` | 100 |
| Thin        | `SF-Pro-Rounded-Thin` | 200 |
| Light       | `SF-Pro-Rounded-Light` | 300 |
| Regular     | `SF-Pro-Rounded-Regular` | 400 |
| Medium      | `SF-Pro-Rounded-Medium` | 500 |
| Semibold    | `SF-Pro-Rounded-Semibold` | 600 |
| Bold        | `SF-Pro-Rounded-Bold` | 700 |
| Heavy       | `SF-Pro-Rounded-Heavy` | 800 |
| Black       | `SF-Pro-Rounded-Black` | 900 |

## Usage

### Method 1: Direct Font Family Names

Use the font family names directly in your StyleSheet:

```javascript
import { StyleSheet, Text } from 'react-native';

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#666',
  },
  body: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#333',
  },
  caption: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Light',
    color: '#999',
  },
});
```

### Method 2: Using Font Constants

Import and use the font constants for better consistency:

```javascript
import { Fonts, getSFProRounded } from '@/constants/Fonts';
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  // Using direct constants
  title: {
    fontFamily: Fonts.SFProRounded.Bold,
  },
  
  // Using helper function
  subtitle: {
    fontFamily: getSFProRounded(600), // Returns 'SF-Pro-Rounded-Semibold'
  },
});
```

## Font Loading

The fonts are loaded in `app/_layout.tsx` using the `useFonts` hook from `expo-font`. The app will show a loading state until all fonts are loaded.

## Best Practices

### Typography Hierarchy

- **Headlines**: Use Bold (700) or Heavy (800)
- **Subheadings**: Use Semibold (600) or Medium (500)
- **Body Text**: Use Regular (400)
- **Captions/Labels**: Use Light (300) or Regular (400)
- **Large Numbers/Data**: Use Black (900) for emphasis

### Examples

```javascript
const typographyStyles = StyleSheet.create({
  // Large headlines
  h1: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Bold',
  },
  
  // Section headers
  h2: {
    fontSize: 24,
    fontFamily: 'SF-Pro-Rounded-Semibold',
  },
  
  // Body text
  body: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    lineHeight: 24,
  },
  
  // Large numbers/statistics
  largeNumber: {
    fontSize: 48,
    fontFamily: 'SF-Pro-Rounded-Black',
    letterSpacing: -2,
  },
  
  // Small labels
  label: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
```

## Font Files Location

All font files are stored in:
```
assets/fonts/
├── SF-Pro-Rounded-Ultralight.ttf
├── SF-Pro-Rounded-Thin.ttf
├── SF-Pro-Rounded-Light.ttf
├── SF-Pro-Rounded-Regular.ttf
├── SF-Pro-Rounded-Medium.ttf
├── SF-Pro-Rounded-Semibold.ttf
├── SF-Pro-Rounded-Bold.ttf
├── SF-Pro-Rounded-Heavy.ttf
└── SF-Pro-Rounded-Black.ttf
```

## Demo

Check out the **Profile** tab in the app to see a live demo of all font weights and usage examples.

## Important Notes

1. **Don't use `fontWeight`**: Since we're using specific font files, avoid using the `fontWeight` property. Use `fontFamily` instead.
2. **Fallback**: On platforms where the font might not load, React Native will fall back to the system font.
3. **Performance**: All fonts are loaded at app startup for optimal performance. 