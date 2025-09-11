import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { FontAwesome5 } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface ChatMessage {
  _id: string;
  userId: string;
  message: string;
  isFromSupport: boolean;
  createdAt: string;
  userName?: string;
}

export default function SupportScreen() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Queries and mutations
  const messages = useQuery(api.support.getUserSupportMessages) as ChatMessage[] | undefined;
  const sendMessage = useMutation(api.support.sendSupportMessage);
  const currentUser = useQuery(api.userProfile.currentUser);
  const profile = useQuery(api.userProfile.getOrCreateProfile);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await sendMessage({ message: message.trim() });
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const userName = profile?.firstName
    ? `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`
    : currentUser?.name || 'You';

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isFromUser = !item.isFromSupport;

    return (
      <View style={[
        styles.messageContainer,
        isFromUser ? styles.userMessageContainer : styles.supportMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isFromUser ? styles.userMessageBubble : styles.supportMessageBubble
        ]}>
          {!isFromUser && (
            <Text style={styles.supportLabel}>RunGarden Support</Text>
          )}
          <Text style={[
            styles.messageText,
            isFromUser ? styles.userMessageText : styles.supportMessageText
          ]}>
            {item.message}
          </Text>
          <Text style={[
            styles.messageTime,
            isFromUser ? styles.userMessageTime : styles.supportMessageTime
          ]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <FontAwesome5 name="headset" size={48} color={Theme.colors.text.secondary} />
      <Text style={styles.emptyStateTitle}>Welcome to Support!</Text>
      <Text style={styles.emptyStateText}>
        Hi {userName.split(' ')[0]}! 👋 {'\n\n'}
        Have a question or need help with RunGarden? Send us a message and we'll get back to you as soon as possible.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
        >
          <FontAwesome5 name="arrow-left" size={20} color={Theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages || []}
          renderItem={renderMessage}
          keyExtractor={(item) => item._id}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContent,
            (!messages || messages.length === 0) && styles.messagesContentEmpty
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message..."
              placeholderTextColor={Theme.colors.text.secondary}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!message.trim() || isLoading) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!message.trim() || isLoading}
            >
              <FontAwesome5
                name="paper-plane"
                size={16}
                color={(!message.trim() || isLoading) ? Theme.colors.text.secondary : Theme.colors.background.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.background.secondary,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Theme.colors.text.primary,
  },
  headerSpacer: {
    width: 36,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 10,
  },
  messagesContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Theme.colors.text.primary,
    marginTop: 16,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: Theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 280,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  supportMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userMessageBubble: {
    backgroundColor: Theme.colors.accent.primary,
  },
  supportMessageBubble: {
    backgroundColor: Theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  supportLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Theme.colors.text.secondary,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: Theme.colors.background.primary,
  },
  supportMessageText: {
    color: Theme.colors.text.primary,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  userMessageTime: {
    color: Theme.colors.transparent.white30,
  },
  supportMessageTime: {
    color: Theme.colors.text.secondary,
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.background.secondary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Theme.colors.text.primary,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: Theme.colors.background.secondary,
  },
});
