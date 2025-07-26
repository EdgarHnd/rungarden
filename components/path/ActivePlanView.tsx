import Theme from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Rive from 'rive-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const NODE_SIZE = 70;
const CHEST_SIZE = 80;
const FLAME_SIZE = 130;
const RIVE_URL_IDDLE = "https://curious-badger-131.convex.cloud/api/storage/9caf3bc8-1fab-4dab-a8e5-4b6d563ca7d6";

export default function ActivePlanView({ activePlan, completedMap }: { activePlan: any, completedMap: any }) {
  const router = useRouter();
  const [bubblePos, setBubblePos] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const nodeRefs = useRef<Record<string, View | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollButtonAnim = useRef(new Animated.Value(0)).current;

  const completedDates = new Set<string>();
  if (completedMap) {
    completedMap.forEach((pw: any) => {
      if (pw.status === 'completed') completedDates.add(pw.scheduledDate);
    });
  }

  // Create a unified list of nodes including workouts and chests
  const nodes: any[] = [];
  const totalWeeks = activePlan.plan.length;
  let workoutCount = 0;

  activePlan.plan.forEach((week: any, weekIndex: number) => {
    const workoutDays = week.days.filter((d: any) => d.type !== 'rest');
    workoutDays.forEach((day: any, dayIndex: number) => {
      const pw = completedMap?.find((p: any) => p.scheduledDate === day.date);

      let bubbleTitle = `Run ${workoutCount + 1}`;
      let bubbleDescription = `Scheduled: ${day.date}`;

      if (pw?.workout) {
        const workoutName = pw.workout.name;
        if (workoutName && !workoutName.startsWith('TOKEN_')) {
          bubbleTitle = workoutName;
        } else if (pw.workout.description) {
          bubbleTitle = pw.workout.description;
        }

        const mainSet = pw.workout.steps?.find((s: any) => s.label === 'Main Set');
        if (mainSet?.notes) {
          bubbleDescription = mainSet.notes;
        } else if (pw.hydrated?.distanceMi) {
          bubbleDescription = `${pw.hydrated.distanceMi} mi ${pw.workout.subType || 'run'}`;
        } else if (pw.hydrated?.minutes) {
          bubbleDescription = `${pw.hydrated.minutes} min ${pw.workout.subType || 'cross-training'}`;
        } else if (pw.hydrated?.globalDescription) {
          bubbleDescription = pw.hydrated.globalDescription;
        }
      } else {
        // Fallback for when planned workout data isn't available yet
        const [base] = day.description.split('/');
        const info: any = {
          R: { title: "Rest Day" }, WR: { title: "Walk/Run Intervals" },
          E: { title: "Easy Run" }, L: { title: "Long Run" },
          X: { title: "Cross-Training" }, T: { title: "Tempo Run" },
          F: { title: "Fartlek Run" }, U: { title: "Recovery Run" },
        };
        bubbleTitle = info[base]?.title || day.description;
      }

      nodes.push({
        nodeType: 'workout',
        id: `workout-${workoutCount}`,
        workoutNumber: workoutCount + 1,
        date: day.date,
        description: day.description, // Keep original token
        completed: completedDates.has(day.date),
        plannedId: pw?._id,
        bubbleTitle,
        bubbleDescription,
      });
      workoutCount++;

      const isLastWorkoutOfWeek = dayIndex === workoutDays.length - 1;
      const isLastWeek = weekIndex === totalWeeks - 1;
      if (isLastWorkoutOfWeek && !isLastWeek) {
        nodes.push({
          nodeType: 'chest',
          id: `chest-${weekIndex}`,
          week: weekIndex + 1,
        });
      }
    });
  });

  const nodePositions = nodes.map((node, i) => {
    const y = i * 140 + 50; // A bit less vertical space
    // Using a sine wave for a smoother, more organic path
    const centerX = (screenWidth - NODE_SIZE) / 2;
    const amplitude = screenWidth * 0.3; // Controls how far left/right it goes
    const frequency = 0.9; // Controls the "waviness"
    const phase = 0; // Starts the wave in the center
    const x = centerX + amplitude * Math.sin(frequency * i + phase);
    return { x, y };
  });

  // Find the current node to position the flame next to
  const firstIncompleteWorkoutIndex = nodes.findIndex(
    n => n.nodeType === 'workout' && !n.completed
  );

  // If all are complete, place it by the last workout, otherwise by the first incomplete one.
  let flameNodeIndex = -1;
  if (firstIncompleteWorkoutIndex !== -1) {
    flameNodeIndex = firstIncompleteWorkoutIndex;
  } else {
    // Find the index of the last workout in the nodes array
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (nodes[i].nodeType === 'workout') {
        flameNodeIndex = i;
        break;
      }
    }
  }

  const totalWorkouts = nodes.filter(n => n.nodeType === 'workout').length;
  const currentWorkoutNode = flameNodeIndex !== -1 ? nodePositions[flameNodeIndex] : null;

  // Automatically scroll to the current workout node once (per node) when the component mounts
  const hasAutoScrolledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentWorkoutNode || !scrollViewRef.current) return;

    const currentNodeId = nodes[flameNodeIndex]?.id;

    // If we haven't scrolled to this node yet, do it now
    if (currentNodeId && hasAutoScrolledRef.current !== currentNodeId) {
      hasAutoScrolledRef.current = currentNodeId;

      // Delay the scroll slightly to ensure the ScrollView has rendered its content
      const timeout = setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: currentWorkoutNode.y - screenHeight / 4,
          animated: false,
        });
      }, 0);

      return () => clearTimeout(timeout);
    }
  }, [currentWorkoutNode, flameNodeIndex, nodes]);

  const pathData = (() => {
    if (nodePositions.length <= 1) return "";
    const pathPoints = nodePositions.map((p, i) => {
      const node = nodes[i];
      const nodeSize = node.nodeType === 'chest' ? CHEST_SIZE : NODE_SIZE;
      return { x: p.x + nodeSize / 2, y: p.y + nodeSize / 2 };
    });
    let d = "M" + pathPoints[0].x + "," + pathPoints[0].y;
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p0 = i > 0 ? pathPoints[i - 1] : pathPoints[i];
      const p1 = pathPoints[i];
      const p2 = pathPoints[i + 1];
      const p3 = i < pathPoints.length - 2 ? pathPoints[i + 2] : p2;
      const t = 1 / 6;
      const cp1x = p1.x + (p2.x - p0.x) * t;
      const cp1y = p1.y + (p2.y - p0.y) * t;
      const cp2x = p2.x - (p3.x - p1.x) * t;
      const cp2y = p2.y - (p3.y - p1.y) * t;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  })();

  const completedCount = nodes.filter(n => n.nodeType === 'workout' && n.completed).length;
  const progress = totalWorkouts > 0 ? (completedCount / totalWorkouts) * 100 : 0;
  const totalHeight = nodePositions.length > 0 ? nodePositions[nodePositions.length - 1].y + 200 : screenHeight;

  const handleScroll = (event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    const shouldShow = currentWorkoutNode ? scrollY > currentWorkoutNode.y + screenHeight / 2 : false;

    if (shouldShow !== showScrollButton) {
      setShowScrollButton(shouldShow);
      Animated.timing(scrollButtonAnim, {
        toValue: shouldShow ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  };

  const scrollToCurrent = () => {
    if (currentWorkoutNode && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: currentWorkoutNode.y - screenHeight / 4,
        animated: true,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {activePlan?.meta?.goal && (
        <View style={styles.header}>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <LinearGradient
                colors={[Theme.colors.accent.primary, Theme.colors.accent.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.planSection}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/training');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planTitle}>{(() => {
                const g = activePlan.meta.goal;
                if (g === '5K') return 'First 5K';
                if (g === '10K') return 'First 10K';
                if (g === 'half-marathon') return 'First Half';
                if (g === 'marathon') return 'Marathon';
                return g.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              })()}</Text>
              <Text style={styles.planSubtitle}>Progressive plan for beginner</Text>
            </View>
            <View style={styles.planIcon}>
              <Ionicons name="library-outline" size={28} color={Theme.colors.text.primary} />
            </View>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={{ height: totalHeight }}>
          <Svg height={totalHeight} width={screenWidth} style={StyleSheet.absoluteFill}>
            <Path d={pathData} stroke={Theme.colors.background.tertiary} strokeWidth="8" fill="none" />
          </Svg>

          {flameNodeIndex !== -1 && (() => {
            const flameNodePos = nodePositions[flameNodeIndex];
            const isNodeOnLeft = flameNodePos.x + NODE_SIZE / 2 < screenWidth / 2;

            const flameStyle = {
              top: flameNodePos.y + (NODE_SIZE - FLAME_SIZE) / 2 - 10,
              left: isNodeOnLeft
                ? flameNodePos.x + NODE_SIZE + 10 // To the right
                : flameNodePos.x - FLAME_SIZE - 10, // To the left
              position: 'absolute' as 'absolute',
              width: FLAME_SIZE,
              height: FLAME_SIZE,
              zIndex: 1,
            };
            return <Rive url={RIVE_URL_IDDLE} style={flameStyle} autoplay={true} />;
          })()}

          {nodes.map((n, i) => {
            const pos = nodePositions[i];
            if (n.nodeType === 'chest') {
              return (
                <View key={n.id} style={[styles.chestContainer, { top: pos.y, left: pos.x }]}>
                  <Image
                    source={require('../../assets/images/backgrounds/treasure-chest.png')}
                    style={styles.chestImage}
                  />
                  <Text style={styles.chestText}>WEEK {n.week}</Text>
                </View>
              );
            }

            // It's a workout node
            const isCurrentNode = i === flameNodeIndex;

            return (
              <TouchableOpacity
                key={n.id}
                ref={ref => { nodeRefs.current[n.id] = ref; }}
                style={[
                  styles.node,
                  n.completed ? styles.nodeDone : styles.nodeTodo,
                  isCurrentNode && styles.nodeCurrent,
                  { top: pos.y, left: pos.x }
                ]}
                onPress={() => {
                  nodeRefs.current[n.id]?.measureInWindow((x, y, width, height) => {
                    setBubblePos({ x, y, width, height });
                    setSelected(n);
                  });
                  Haptics.selectionAsync();
                }}
              >
                <Text style={[styles.nodeText, n.completed && styles.nodeTextDone, isCurrentNode && styles.nodeTextCurrent]}>{n.workoutNumber}</Text>
                {n.completed && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={20} color={Theme.colors.accent.primary} />
                  </View>
                )}
                {n.workoutNumber === totalWorkouts && (
                  <Image
                    source={require('../../assets/images/backgrounds/finish-line.png')}
                    style={styles.finishLine}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      {selected && bubblePos && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setSelected(null)}
        >
          {(() => {
            // Calculate if bubble should be above or below based on screen position
            const screenMiddle = screenHeight / 2;
            const nodeScreenY = bubblePos.y;
            const showBelow = nodeScreenY < screenMiddle;

            // Calculate bubble position
            const bubbleHeight = 140;
            const bubbleMargin = 20;
            const triangleSize = 12;

            let bubbleTop;
            let triangleTop;
            let triangleStyle;

            if (showBelow) {
              // Show bubble below the node
              bubbleTop = bubblePos.y + bubblePos.height + triangleSize + 5;
              triangleTop = bubblePos.y + bubblePos.height - 5;
              triangleStyle = styles.triangleDown;
            } else {
              // Show bubble above the node
              bubbleTop = bubblePos.y - bubbleHeight - triangleSize - 5;
              triangleTop = bubblePos.y - triangleSize;
              triangleStyle = styles.triangleUp;
            }

            // Calculate triangle horizontal position to point to center of node
            const triangleLeft = bubblePos.x + (bubblePos.width / 2) - (triangleSize / 2);

            return (
              <>
                {/* Triangle pointer */}
                <View
                  style={[
                    styles.triangle,
                    triangleStyle,
                    {
                      top: triangleTop,
                      left: triangleLeft
                    }
                  ]}
                />

                {/* Bubble */}
                <View
                  style={[
                    styles.bubble,
                    {
                      top: bubbleTop,
                      left: 20
                    }
                  ]}
                  onStartShouldSetResponder={() => true}
                >
                  <Text style={styles.bubbleTitle}>{selected?.bubbleTitle}</Text>
                  <Text style={styles.bubbleSubtitle}>{selected?.bubbleDescription}</Text>
                  <TouchableOpacity style={styles.bubbleBtn} onPress={() => {
                    if (selected?.plannedId) {
                      router.push({ pathname: '/training-detail', params: { scheduleWorkoutId: selected.plannedId } });
                    }
                  }}>
                    <Text style={styles.bubbleBtnTxt}>SEE WORKOUT</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </TouchableOpacity>
      )}
      <Animated.View style={[styles.fabContainer, {
        transform: [{
          translateY: scrollButtonAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [100, 0]
          })
        }]
      }]}>
        <TouchableOpacity style={styles.fab} onPress={scrollToCurrent}>
          <Ionicons name="arrow-up" size={30} color={Theme.colors.text.primary} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: Theme.colors.special.primary.plan,
    borderRadius: 12,
    padding: 20,
    position: 'absolute',
    width: '85%',
    zIndex: 10,
  },
  bubbleBtn: {
    alignItems: 'center',
    backgroundColor: Theme.colors.text.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  bubbleBtnTxt: {
    color: Theme.colors.special.primary.plan,
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
  },
  bubbleSubtitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    marginBottom: 16,
  },
  bubbleTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    marginBottom: 8,
  },
  check: {
    position: 'absolute',
    right: -10,
    top: -10,
    backgroundColor: Theme.colors.text.primary,
    borderRadius: 100,
    padding: 5,
  },
  chestContainer: {
    position: 'absolute',
    alignItems: 'center',
    width: CHEST_SIZE,
    height: CHEST_SIZE,
  },
  chestImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  chestText: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.bold,
    fontSize: 12,
    marginTop: 4,
  },
  container: {
    backgroundColor: Theme.colors.background.primary,
    flex: 1,
  },
  fab: {
    backgroundColor: Theme.colors.accent.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 120,
    right: 30,
  },
  finishLine: {
    height: 150,
    position: 'absolute',
    resizeMode: 'contain',
    width: 150,
    top: -90,
  },
  header: {
    borderBottomColor: Theme.colors.background.tertiary,
    //borderBottomWidth: 3,
  },
  node: {
    alignItems: 'center',
    borderRadius: NODE_SIZE / 2,
    height: NODE_SIZE,
    justifyContent: 'center',
    width: NODE_SIZE,
    position: 'absolute',
  },
  nodeCurrent: {
    borderColor: Theme.colors.special.primary.plan,
    borderWidth: 4,
  },
  nodeDone: {
    backgroundColor: Theme.colors.special.primary.plan,
  },
  nodeText: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.bold,
    fontSize: 24,
  },
  nodeTextCurrent: {
    color: Theme.colors.special.primary.plan,
  },
  nodeTextDone: {
    color: Theme.colors.text.primary,
  },
  nodeTodo: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  planIcon: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    padding: 12,
  },
  planInfo: {
    flex: 1,
  },
  planSection: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 20,
    paddingHorizontal: Theme.spacing.xl,
    paddingVertical: 20,
  },
  planSubtitle: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
  },
  planTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 28,
    marginBottom: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressBarContainer: {
    paddingHorizontal: Theme.spacing.xl,
    paddingTop: Theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: Theme.borderRadius.full,
  },
  triangle: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Theme.colors.special.primary.plan,
  },
  triangleUp: {
    borderBottomColor: 'transparent',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Theme.colors.special.primary.plan,
  },
  triangleDown: {
    borderBottomColor: Theme.colors.special.primary.plan,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
  },
});
