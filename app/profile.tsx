import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>SF Pro Rounded Font Demo</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Font Weights</Text>

          <Text style={styles.ultralight}>Ultralight (100)</Text>
          <Text style={styles.thin}>Thin (200)</Text>
          <Text style={styles.light}>Light (300)</Text>
          <Text style={styles.regular}>Regular (400)</Text>
          <Text style={styles.medium}>Medium (500)</Text>
          <Text style={styles.semibold}>Semibold (600)</Text>
          <Text style={styles.bold}>Bold (700)</Text>
          <Text style={styles.heavy}>Heavy (800)</Text>
          <Text style={styles.black}>Black (900)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage Examples</Text>
          <Text style={styles.headline}>This is a Headline</Text>
          <Text style={styles.subtitle}>This is a subtitle using medium weight</Text>
          <Text style={styles.body}>This is body text using regular weight. Perfect for reading long form content and maintaining good readability.</Text>
          <Text style={styles.caption}>This is a caption using light weight</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Usage in StyleSheet</Text>
          <Text style={styles.codeExample}>
            {`// Use direct font family names in your styles:
fontFamily: 'SF-Pro-Rounded-Bold'
fontFamily: 'SF-Pro-Rounded-Medium'
fontFamily: 'SF-Pro-Rounded-Regular'

// Or use the helper function:
import { getSFProRounded } from '@/constants/Fonts';
fontFamily: getSFProRounded(700) // Returns 'SF-Pro-Rounded-Bold'`}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#111827',
    marginBottom: 30,
    textAlign: 'center',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#374151',
    marginBottom: 16,
  },
  ultralight: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Ultralight',
    color: '#374151',
    marginBottom: 8,
  },
  thin: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Thin',
    color: '#374151',
    marginBottom: 8,
  },
  light: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Light',
    color: '#374151',
    marginBottom: 8,
  },
  regular: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#374151',
    marginBottom: 8,
  },
  medium: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#374151',
    marginBottom: 8,
  },
  semibold: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Semibold',
    color: '#374151',
    marginBottom: 8,
  },
  bold: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#374151',
    marginBottom: 8,
  },
  heavy: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Heavy',
    color: '#374151',
    marginBottom: 8,
  },
  black: {
    fontSize: 18,
    fontFamily: 'SF-Pro-Rounded-Black',
    color: '#374151',
    marginBottom: 8,
  },
  headline: {
    fontSize: 28,
    fontFamily: 'SF-Pro-Rounded-Bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontFamily: 'SF-Pro-Rounded-Medium',
    color: '#6B7280',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#374151',
    lineHeight: 24,
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    fontFamily: 'SF-Pro-Rounded-Light',
    color: '#9CA3AF',
  },
  codeExample: {
    fontSize: 12,
    fontFamily: 'SF-Pro-Rounded-Regular',
    color: '#374151',
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    lineHeight: 18,
  },
}); 