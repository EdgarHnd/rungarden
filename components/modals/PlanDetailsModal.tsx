import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, Modal, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PlanDetailsModal({ visible, onClose, plan, onStart, isGenerating }: { visible: boolean, onClose: () => void, plan: any, onStart: () => void, isGenerating: boolean }) {
  if (!plan) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <TouchableOpacity
          style={styles.modalCloseButton}
          onPress={onClose}
        >
          <Ionicons name="close" size={24} color={Theme.colors.text.primary} />
        </TouchableOpacity>

        <ImageBackground
          source={plan.image}
          style={styles.modalImageBackground}
          imageStyle={styles.modalImageBackgroundImageStyle}
        >
          <View style={styles.modalImageBackgroundOverlay} />
          <Text style={styles.modalPlanTitle}>{plan.title}</Text>
          <Text style={styles.modalPlanSubtitle}>{plan.subtitle}</Text>
        </ImageBackground>
        <View style={styles.modalContent}>

          <View style={styles.modalStatsContainer}>
            <View style={styles.modalStatItem}>
              <Text style={styles.modalStatValue}>{plan.weeks}</Text>
              <Text style={styles.modalStatLabel}>weeks long</Text>
            </View>
            <View style={styles.modalStatItem}>
              <Text style={styles.modalStatValue}>{plan.totalRuns}</Text>
              <Text style={styles.modalStatLabel}>total workouts</Text>
            </View>
            <View style={styles.modalStatItem}>
              <Text style={styles.modalStatValue}>3</Text>
              <Text style={styles.modalStatLabel}>runs per week</Text>
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>About this plan</Text>
            <Text style={styles.modalDescription}>{plan.description}</Text>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>What to expect</Text>
            <View style={styles.modalFeaturesList}>
              <View style={styles.modalFeature}>
                <Ionicons name="calendar-outline" size={20} color={Theme.colors.special.primary.plan} />
                <Text style={styles.modalFeatureText}>Structured weekly progression</Text>
              </View>
              <View style={styles.modalFeature}>
                <Ionicons name="fitness-outline" size={20} color={Theme.colors.special.primary.plan} />
                <Text style={styles.modalFeatureText}>Mix of running and walking intervals</Text>
              </View>
              <View style={styles.modalFeature}>
                <Ionicons name="trending-up-outline" size={20} color={Theme.colors.special.primary.plan} />
                <Text style={styles.modalFeatureText}>Gradual intensity increases</Text>
              </View>
              <View style={styles.modalFeature}>
                <Ionicons name="trophy-outline" size={20} color={Theme.colors.special.primary.plan} />
                <Text style={styles.modalFeatureText}>Achievement tracking and rewards</Text>
              </View>
            </View>
          </View>

          <View style={styles.modalSection}>
            <Text style={styles.modalSectionTitle}>Timeline</Text>
            <View style={styles.modalTimeline}>
              <Text style={styles.modalTimelineText}>
                Start today and complete your first {plan.value} by{' '}
                <Text style={styles.modalTimelineDate}>{plan.targetDate}</Text>
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.modalStartButton, isGenerating && styles.modalStartButtonDisabled]}
            onPress={onStart}
            disabled={isGenerating}
          >
            <Text style={styles.modalStartButtonText}>
              {isGenerating ? 'Creating Your Plan...' : `Start`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: Theme.colors.background.primary,
    flex: 1,
  },
  modalCloseButton: {
    padding: 10,
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  modalContent: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  modalDescription: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalFeature: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 10,
  },
  modalFeaturesList: {
    marginTop: 10,
  },
  modalFeatureText: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    marginLeft: 10,
  },
  modalFooter: {
    alignItems: 'center',
  },
  modalImageBackground: {
    height: 200,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalImageBackgroundImageStyle: {
    resizeMode: 'cover',
  },
  modalImageBackgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalPlanSubtitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    marginBottom: 8,
    opacity: 0.9,
  },
  modalPlanTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 28,
    marginBottom: 4,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    marginBottom: 10,
  },
  modalStartButton: {
    alignItems: 'center',
    backgroundColor: Theme.colors.special.primary.plan,
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  modalStartButtonDisabled: {
    opacity: 0.7,
  },
  modalStartButtonText: {
    color: Theme.colors.background.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    textTransform: 'uppercase',
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatLabel: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    marginTop: 4,
  },
  modalStatValue: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
  },
  modalStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  modalTimeline: {
    alignItems: 'center',
    marginTop: 10,
  },
  modalTimelineDate: {
    color: Theme.colors.special.primary.plan,
    fontFamily: Theme.fonts.semibold,
    fontSize: 18,
  },
  modalTimelineText: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    textAlign: 'center',
  },
  modalTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    textAlign: 'center',
  },
});
