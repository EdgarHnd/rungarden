import WeekRewardModal from '@/components/modals/WeekRewardModal';
import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Rive from 'rive-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const NODE_SIZE = 75;
const CHEST_SIZE = 100;
const FLAME_SIZE = 130;
const RIVE_URL_IDDLE = "https://curious-badger-131.convex.cloud/api/storage/9caf3bc8-1fab-4dab-a8e5-4b6d563ca7d6";

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Compare dates (ignoring time)
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const tomorrowOnly = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());

  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Today';
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Yesterday';
  } else if (dateOnly.getTime() === tomorrowOnly.getTime()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  }
};

export default function ActivePlanView({ activePlan, completedMap, userId }: { activePlan: any, completedMap: any, userId: string }) {
  const router = useRouter();
  const [bubblePos, setBubblePos] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const nodeRefs = useRef<Record<string, View | null>>({});

  // Chest bubble state
  const [chestBubblePos, setChestBubblePos] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [selectedChest, setSelectedChest] = useState<{ weekNumber: number, state: 'locked' | 'unlocked' | 'claimed' } | null>(null);
  const chestRefs = useRef<Record<string, View | null>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollButtonAnim = useRef(new Animated.Value(0)).current;

  // Week reward modal state
  const [weekRewardModal, setWeekRewardModal] = useState<{
    visible: boolean;
    weekNumber: number;
    startFlipped?: boolean;
  }>({
    visible: false,
    weekNumber: 0,
    startFlipped: false,
  });

  // Queries for week rewards
  const weekRewards = useQuery(api.weekRewards.getWeekRewards,
    activePlan && userId ? { userId: userId as any, planId: activePlan._id } : 'skip'
  );

  // Preview card for current modal
  const previewCard = useQuery(api.weekRewards.previewWeekRewardCard,
    weekRewardModal.visible
      ? { weekNumber: weekRewardModal.weekNumber }
      : 'skip'
  );

  // Debug logging for modal state
  useEffect(() => {
    console.log('Week reward modal state:', weekRewardModal);
    console.log('Preview card:', previewCard);
  }, [weekRewardModal, previewCard]);

  // Mutations
  const claimWeekReward = useMutation(api.weekRewards.claimWeekReward);

  // Helper function to check if week reward is claimed
  const isWeekRewardClaimed = (weekNumber: number) => {
    return weekRewards?.some((reward: any) => reward.weekNumber === weekNumber);
  };

  // Helper function to get chest state
  const getChestState = (weekNumber: number, isWeekCompleted: boolean): 'locked' | 'unlocked' | 'claimed' => {
    if (!isWeekCompleted) return 'locked';
    if (isWeekRewardClaimed(weekNumber)) return 'claimed';
    return 'unlocked';
  };

  // Handle chest tap to show bubble
  const handleChestTap = (weekNumber: number, isWeekCompleted: boolean, chestRef: View | null) => {
    console.log('Chest tapped:', { weekNumber, isWeekCompleted });

    const chestState = getChestState(weekNumber, isWeekCompleted);
    console.log('Chest state:', chestState);

    if (!chestRef) return;

    // Show bubble for all states
    chestRef.measureInWindow((x, y, width, height) => {
      setChestBubblePos({ x, y, width, height });
      setSelectedChest({ weekNumber, state: chestState });
    });

    Haptics.selectionAsync();
  };

  // Handle chest bubble actions
  const handleChestBubbleAction = (action: 'close' | 'claim' | 'view') => {
    if (!selectedChest) return;

    if (action === 'claim') {
      // Open the claiming modal
      setWeekRewardModal({
        visible: true,
        weekNumber: selectedChest.weekNumber,
        startFlipped: false,
      });
      // Close bubble
      setSelectedChest(null);
      setChestBubblePos(null);
    } else if (action === 'view') {
      // Open the modal in view mode (card already flipped)
      setWeekRewardModal({
        visible: true,
        weekNumber: selectedChest.weekNumber,
        startFlipped: true,
      });
      // Close bubble
      setSelectedChest(null);
      setChestBubblePos(null);
    } else {
      // Close action
      setSelectedChest(null);
      setChestBubblePos(null);
    }
  };

  // Handle claiming reward
  const handleClaimReward = async () => {
    try {
      await claimWeekReward({
        userId: userId as any,
        planId: activePlan._id,
        weekNumber: weekRewardModal.weekNumber,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  };

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
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time for accurate date comparison
  const todayDateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

  activePlan.plan.forEach((week: any, weekIndex: number) => {
    const workoutDays = week.days.filter((d: any) => d.type !== 'rest');
    workoutDays.forEach((day: any, dayIndex: number) => {
      const pw = completedMap?.find((p: any) => p.scheduledDate === day.date);
      const workoutDate = new Date(day.date);
      workoutDate.setHours(0, 0, 0, 0);

      const isCompleted = completedDates.has(day.date);
      const isPastDue = workoutDate < today;
      const isMissed = isPastDue && !isCompleted;

      let bubbleTitle = `Run ${workoutCount + 1}`;
      let bubbleDescription = `Scheduled: ${day.date}`;

      // Override title for missed workouts
      if (isMissed) {
        bubbleTitle = "Missed";
        bubbleDescription = `Was scheduled: ${formatDate(day.date)}`;
      } else if (pw?.workout) {
        if (pw.hydrated?.description) {
          bubbleTitle = pw.hydrated.description;
        } else {
          const workoutName = pw.workout.name;
          if (workoutName && !workoutName.startsWith('TOKEN_')) {
            bubbleTitle = workoutName;
          } else if (pw.workout.description) {
            bubbleTitle = pw.workout.description;
          }
        }

        const mainSet = pw.workout.steps?.find((s: any) => s.label === 'Main Set');
        if (mainSet?.notes) {
          bubbleDescription = mainSet.notes;
        } else if (pw.hydrated?.summary) {
          bubbleDescription = `${pw.hydrated.summary} ${pw.workout.subType || ''}`;
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
        completed: isCompleted,
        missed: isMissed,
        isPastDue,
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
  // Priority: Today's workout > Next upcoming workout > First incomplete workout > Last workout

  // First, check if there's a workout scheduled for today
  const todayWorkoutIndex = nodes.findIndex(
    n => n.nodeType === 'workout' && n.date === todayDateString
  );

  // If no workout today, find the next upcoming workout (future date)
  const upcomingWorkoutIndex = nodes.findIndex(
    n => n.nodeType === 'workout' && new Date(n.date) > today
  );

  // If no upcoming workouts, find the first incomplete workout
  const firstIncompleteWorkoutIndex = nodes.findIndex(
    n => n.nodeType === 'workout' && !n.completed
  );

  // Determine flame position with priority order
  let flameNodeIndex = -1;
  if (todayWorkoutIndex !== -1) {
    flameNodeIndex = todayWorkoutIndex;
  } else if (upcomingWorkoutIndex !== -1) {
    flameNodeIndex = upcomingWorkoutIndex;
  } else if (firstIncompleteWorkoutIndex !== -1) {
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

  // Find the next upcoming workout for grey bubble logic
  const nextUpcomingWorkoutIndex = nodes.findIndex(
    n => n.nodeType === 'workout' && new Date(n.date) > today && !n.completed
  );

  // Add logic to determine which workouts should have grey bubbles
  nodes.forEach((node, index) => {
    if (node.nodeType === 'workout') {
      const workoutDate = new Date(node.date);
      workoutDate.setHours(0, 0, 0, 0);

      // Grey bubble for missed workouts or upcoming workouts (except the next one)
      node.shouldHaveGreyBubble = node.missed ||
        (workoutDate > today && !node.completed && index !== nextUpcomingWorkoutIndex);
    }
  });

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
              router.push('/manage-plan');
            }}
            activeOpacity={0.8}
          >
            <View style={styles.planInfo}>
              <Text style={styles.planTitle}>{(() => {
                const g = activePlan.meta.goal;
                if (g === '5K') return 'Couch to 5K';
                if (g === '10K') return 'First 10K';
                if (g === 'half-marathon') return 'First Half';
                if (g === 'marathon') return 'Marathon';
                return g.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              })()}</Text>
              <Text style={styles.planSubtitle}>Progressive plan for beginner</Text>
            </View>
            <View style={styles.planIcon}>
              <Ionicons name="create" size={28} color={Theme.colors.text.primary} />
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
              // Check if all workouts in this week are completed
              const weekIndex = n.week - 1;
              const week = activePlan.plan[weekIndex];
              const workoutDays = week?.days?.filter((d: any) => d.type !== 'rest') || [];
              const isWeekCompleted = workoutDays.every((day: any) => completedDates.has(day.date));
              const chestState = getChestState(n.week, isWeekCompleted);

              return (
                <TouchableOpacity
                  key={n.id}
                  ref={ref => { chestRefs.current[n.id] = ref; }}
                  style={[styles.chestContainer, { top: pos.y, left: pos.x }]}
                  onPress={() => handleChestTap(n.week, isWeekCompleted, chestRefs.current[n.id])}
                  activeOpacity={0.8}
                >
                  {/* Glow effect for unlocked chests */}
                  {chestState === 'unlocked' && (
                    <View style={styles.chestGlow} />
                  )}

                  <Image
                    source={
                      chestState === 'locked'
                        ? require('../../assets/images/backgrounds/treasure-chest-grey.png')
                        : chestState === 'claimed'
                          ? require('../../assets/images/backgrounds/treasure-chest-open.png')
                          : require('../../assets/images/backgrounds/treasure-chest.png')
                    }
                    style={styles.chestImage}
                  />
                  <Text style={[
                    styles.chestText,
                    chestState === 'claimed' && styles.chestTextClaimed
                  ]}>
                    WEEK {n.week}
                  </Text>
                </TouchableOpacity>
              );
            }

            // It's a workout node
            const isCurrentNode = i === flameNodeIndex;

            return (
              <View key={n.id}>
                <TouchableOpacity
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
                  activeOpacity={1}
                >
                  <Text style={[styles.nodeText, n.completed && styles.nodeTextDone, isCurrentNode && styles.nodeTextCurrent]}>{n.workoutNumber}</Text>
                  {n.workoutNumber === totalWorkouts && (
                    <Image
                      source={require('../../assets/images/backgrounds/finish-line.png')}
                      style={styles.finishLine}
                    />
                  )}
                </TouchableOpacity>
                <Text style={[
                  styles.nodeDate,
                  {
                    top: pos.y + NODE_SIZE,
                    left: pos.x,
                    width: NODE_SIZE
                  }
                ]}>{formatDate(n.date)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {selected && bubblePos && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            setSelected(null);
            setBubblePos(null);
          }}
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

            // Determine bubble variants
            const isGreyBubble = selected?.shouldHaveGreyBubble;
            let isTodayBubble = false;
            if (selected?.date) {
              const selDate = new Date(selected.date);
              selDate.setHours(0, 0, 0, 0);
              isTodayBubble = selDate.getTime() === today.getTime();
            }

            let triangleColorStyle = triangleStyle;
            if (isGreyBubble) {
              triangleColorStyle = showBelow ? styles.triangleGrey : styles.triangleGreyUp;
            } else if (isTodayBubble) {
              triangleColorStyle = showBelow ? styles.triangleExp : styles.triangleExpUp;
            }

            return (
              <>
                {/* Triangle pointer */}
                <View
                  style={[
                    styles.triangle,
                    triangleColorStyle,
                    {
                      top: triangleTop,
                      left: triangleLeft
                    }
                  ]}
                />

                {/* Bubble */}
                <View
                  style={[
                    isGreyBubble ? styles.bubbleGrey : (isTodayBubble ? styles.bubbleExp : styles.bubble),
                    {
                      top: bubbleTop,
                      left: 20
                    }
                  ]}
                  onStartShouldSetResponder={() => true}
                >
                  <Text style={isGreyBubble ? styles.bubbleTitleGrey : styles.bubbleTitle}>
                    {selected?.bubbleTitle}
                  </Text>
                  <Text style={isGreyBubble ? styles.bubbleSubtitleGrey : styles.bubbleSubtitle}>
                    {selected?.bubbleDescription}
                  </Text>
                  <TouchableOpacity
                    style={isGreyBubble ? styles.bubbleBtnGrey : (isTodayBubble ? styles.bubbleBtnExp : styles.bubbleBtn)}
                    onPress={() => {
                      if (selected?.plannedId) {
                        router.push({ pathname: '/training-detail', params: { scheduleWorkoutId: selected.plannedId } });
                      }
                    }}
                  >
                    <Text style={isGreyBubble ? styles.bubbleBtnTxtGrey : (isTodayBubble ? styles.bubbleBtnTxtExp : styles.bubbleBtnTxt)}>
                      {(() => {
                        // Determine if selected workout is today by comparing dates
                        if (!selected?.date) return "SEE WORKOUT";
                        const selectedDate = new Date(selected.date);
                        selectedDate.setHours(0, 0, 0, 0);
                        const isTodaysWorkout = selectedDate.getTime() === today.getTime();
                        return isTodaysWorkout ? "START WORKOUT" : "SEE WORKOUT";
                      })()}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </TouchableOpacity>
      )}

      {/* Chest Bubble */}
      {selectedChest && chestBubblePos && (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            setSelectedChest(null);
            setChestBubblePos(null);
          }}
        >
          {(() => {
            // Calculate if bubble should be above or below based on screen position
            const screenMiddle = screenHeight / 2;
            const chestScreenY = chestBubblePos.y;
            const showBelow = chestScreenY < screenMiddle;

            // Calculate bubble position
            const bubbleHeight = 140;
            const triangleSize = 12;

            let bubbleTop;
            let triangleTop;
            let triangleStyle;

            if (showBelow) {
              // Show bubble below the chest
              bubbleTop = chestBubblePos.y + chestBubblePos.height + triangleSize + 5;
              triangleTop = chestBubblePos.y + chestBubblePos.height - 5;
              triangleStyle = styles.triangleGrey; // Use grey triangle to match chest bubble color
            } else {
              // Show bubble above the chest
              bubbleTop = chestBubblePos.y - bubbleHeight - triangleSize - 5;
              triangleTop = chestBubblePos.y - triangleSize;
              triangleStyle = styles.triangleGreyUp; // Use grey triangle to match chest bubble color
            }

            // Calculate triangle horizontal position to point to center of chest
            const triangleLeft = chestBubblePos.x + (chestBubblePos.width / 2) - (triangleSize / 2);

            // Get bubble content based on chest state
            const getBubbleContent = () => {
              switch (selectedChest.state) {
                case 'locked':
                  return {
                    title: `Complete Week ${selectedChest.weekNumber}`,
                    subtitle: 'Finish all workouts to unlock your reward',
                    buttonText: 'CLOSE',
                    buttonAction: 'close' as const,
                    buttonStyle: styles.chestBubbleBtnClose
                  };
                case 'unlocked':
                  return {
                    title: `Week ${selectedChest.weekNumber} Reward Unlocked!`,
                    subtitle: 'Tap to claim your reward',
                    buttonText: 'CLAIM',
                    buttonAction: 'claim' as const,
                    buttonStyle: styles.chestBubbleBtnClaim
                  };
                case 'claimed':
                  return {
                    title: `Week ${selectedChest.weekNumber} Reward Claimed`,
                    subtitle: 'You\'ve already claimed this reward',
                    buttonText: 'VIEW',
                    buttonAction: 'view' as const,
                    buttonStyle: styles.chestBubbleBtnView
                  };
                default:
                  return {
                    title: 'Unknown State',
                    subtitle: '',
                    buttonText: 'CLOSE',
                    buttonAction: 'close' as const,
                    buttonStyle: styles.chestBubbleBtnClose
                  };
              }
            };

            const content = getBubbleContent();

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

                {/* Chest Bubble */}
                <View
                  style={[
                    styles.chestBubble,
                    {
                      top: bubbleTop,
                      left: 20
                    }
                  ]}
                  onStartShouldSetResponder={() => true}
                >
                  <Text style={styles.chestBubbleTitle}>{content.title}</Text>
                  <Text style={styles.chestBubbleSubtitle}>{content.subtitle}</Text>
                  <TouchableOpacity
                    style={[styles.chestBubbleBtn, content.buttonStyle]}
                    onPress={() => handleChestBubbleAction(content.buttonAction)}
                  >
                    <Text style={styles.chestBubbleBtnTxt}>{content.buttonText}</Text>
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
          <Ionicons name="arrow-up" size={30} color={Theme.colors.background.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Week Reward Modal */}
      <WeekRewardModal
        visible={weekRewardModal.visible}
        weekNumber={weekRewardModal.weekNumber}
        card={previewCard || null}
        startFlipped={weekRewardModal.startFlipped}
        onClaim={handleClaimReward}
        onClose={() => setWeekRewardModal(prev => ({ ...prev, visible: false }))}
      />
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
  bubbleGrey: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: 12,
    padding: 20,
    position: 'absolute',
    width: '85%',
    zIndex: 10,
  },
  bubbleExp: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Theme.colors.special.primary.exp,
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
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.text.secondary,
  },
  bubbleBtnGrey: {
    alignItems: 'center',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  bubbleBtnTxt: {
    color: Theme.colors.special.primary.plan,
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
  },
  bubbleBtnTxtGrey: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
  },
  bubbleBtnExp: {
    alignItems: 'center',
    backgroundColor: Theme.colors.special.primary.exp,
    borderRadius: 8,
    paddingVertical: 10,
    borderBottomWidth: 4,
    borderBottomColor: Theme.colors.special.secondary.exp,
  },
  bubbleBtnTxtExp: {
    color: Theme.colors.background.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
  },
  bubbleSubtitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    marginBottom: 16,
  },
  bubbleSubtitleGrey: {
    color: Theme.colors.text.tertiary,
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
  bubbleTitleGrey: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    marginBottom: 8,
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
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 12,
  },
  chestTextClaimed: {
    color: Theme.colors.text.tertiary,
  },
  chestGlow: {
    position: 'absolute',
    width: CHEST_SIZE - 20,
    height: CHEST_SIZE - 50,
    borderRadius: 20,
    backgroundColor: Theme.colors.special.primary.plan,
    opacity: 1,
    shadowColor: Theme.colors.special.primary.plan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
    top: 25,
  },
  // Chest Bubble Styles
  chestBubble: {
    backgroundColor: Theme.colors.background.tertiary,
    borderRadius: 12,
    padding: 20,
    position: 'absolute',
    width: '85%',
    zIndex: 10,
  },
  chestBubbleTitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 20,
    marginBottom: 8,
  },
  chestBubbleSubtitle: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    marginBottom: 16,
  },
  chestBubbleBtn: {
    alignItems: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    borderBottomWidth: 3,
    borderColor: Theme.colors.background.secondary,
  },
  chestBubbleBtnClose: {
    backgroundColor: Theme.colors.background.secondary,
    borderColor: Theme.colors.background.primary,
  },
  chestBubbleBtnClaim: {
    backgroundColor: Theme.colors.special.primary.plan,
    borderColor: Theme.colors.special.secondary.plan,
  },
  chestBubbleBtnView: {
    backgroundColor: Theme.colors.background.secondary,
    borderColor: Theme.colors.background.primary,
  },
  chestBubbleBtnTxt: {
    color: Theme.colors.text.primary,
    fontFamily: Theme.fonts.bold,
    fontSize: 18,
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
    borderBottomWidth: 3,
  },
  node: {
    alignItems: 'center',
    borderRadius: '100%',
    height: NODE_SIZE - 10,
    justifyContent: 'center',
    width: NODE_SIZE,
    position: 'absolute',
    borderBottomWidth: 8,
    borderColor: Theme.colors.background.secondary,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 2,
  },
  nodeCurrent: {
    backgroundColor: Theme.colors.background.secondary,
    borderColor: Theme.colors.special.primary.exp,
  },
  nodeDone: {
    backgroundColor: Theme.colors.special.primary.plan,
    borderColor: Theme.colors.special.secondary.plan,
  },
  nodeText: {
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.bold,
    fontSize: 30,
  },
  nodeTextCurrent: {
    color: Theme.colors.special.primary.exp,
  },
  nodeTextDone: {
    color: Theme.colors.text.primary,
  },
  nodeTodo: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  nodeDate: {
    position: 'absolute',
    textAlign: 'center',
    color: Theme.colors.text.tertiary,
    fontFamily: Theme.fonts.bold,
    fontSize: 14,
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
  triangleGrey: {
    borderBottomColor: Theme.colors.background.tertiary,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
  },
  triangleGreyUp: {
    borderBottomColor: 'transparent',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Theme.colors.background.tertiary,
  },
  triangleExp: {
    borderBottomColor: Theme.colors.special.primary.exp,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
  },
  triangleExpUp: {
    borderBottomColor: 'transparent',
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 12,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Theme.colors.special.primary.exp,
  },
});
