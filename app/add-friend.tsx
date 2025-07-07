import Theme from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useMutation, useQuery } from 'convex/react';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function AddFriendScreen() {
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');

  // Debounce input 300ms
  useEffect(() => {
    const id = setTimeout(() => {
      setSearchText(query.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const results = useQuery(api.userProfile.searchProfiles, { text: searchText });
  const incomingRequests = useQuery(api.friends.getPendingFriendRequests);
  const outgoingRequests = useQuery(api.friends.getSentFriendRequests);
  const sendRequest = useMutation(api.friends.sendFriendRequest);
  const respondRequest = useMutation(api.friends.respondToFriendRequest);

  const handleAdd = async (userId: string) => {
    try {
      await sendRequest({ toUserId: userId as any });
      alert('Request sent!');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleRespond = async (requestId: string, accept: boolean) => {
    try {
      await respondRequest({ requestId: requestId as any, accept });
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Add Friends</Text>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search by name"
          placeholderTextColor={Theme.colors.text.tertiary}
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={() => setQuery('')}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Incoming Requests Section (only if any) */}
      {incomingRequests && incomingRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Incoming Requests</Text>
          <FlatList
            data={incomingRequests}
            keyExtractor={(item) => item._id as string}
            renderItem={({ item }) => (
              <View style={styles.requestRow}>
                <Text style={styles.resultName}>{item.name}</Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={[styles.acceptButton, styles.requestButton]}
                    onPress={() => handleRespond(item._id as string, true)}
                  >
                    <Text style={styles.requestButtonText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectButton, styles.requestButton]}
                    onPress={() => handleRespond(item._id as string, false)}
                  >
                    <Text style={styles.requestButtonText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      <Text style={[styles.sectionTitle, { marginTop: Theme.spacing.xl }]}>Search Results</Text>

      <FlatList
        data={results || []}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => (
          <View style={styles.resultRow}>
            <Text style={styles.resultName}>{item.name}</Text>
            {(() => {
              const alreadySent = outgoingRequests?.some((r: any) => r.userId === item.userId);
              return (
                <TouchableOpacity
                  style={[styles.addButton, alreadySent && styles.addButtonDisabled]}
                  onPress={() => alreadySent ? null : handleAdd(item.userId as string)}
                  disabled={alreadySent}
                >
                  <Text style={styles.addButtonText}>{alreadySent ? 'Sent' : 'Add'}</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.noResults}>No results</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background.primary,
    padding: Theme.spacing.lg,
  },
  header: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: Theme.spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    backgroundColor: Theme.colors.background.secondary,
    borderRadius: Theme.borderRadius.medium,
    padding: Theme.spacing.md,
    color: Theme.colors.text.primary,
    flex: 1,
  },
  clearButton: {
    marginLeft: Theme.spacing.sm,
    padding: Theme.spacing.sm,
  },
  clearButtonText: {
    fontSize: 16,
    color: Theme.colors.text.tertiary,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  resultName: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text.primary,
  },
  addButton: {
    backgroundColor: Theme.colors.accent.primary,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
    borderRadius: Theme.borderRadius.medium,
  },
  addButtonDisabled: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  addButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
    marginTop: Theme.spacing.lg,
    marginBottom: Theme.spacing.sm,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Theme.spacing.md,
    borderBottomWidth: 1,
    borderColor: Theme.colors.border.primary,
  },
  requestActions: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  requestButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.medium,
    marginLeft: Theme.spacing.sm,
  },
  acceptButton: {
    backgroundColor: Theme.colors.accent.primary,
  },
  rejectButton: {
    backgroundColor: Theme.colors.background.tertiary,
  },
  requestButtonText: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text.primary,
  },
  noResults: {
    textAlign: 'center',
    marginTop: Theme.spacing.xl,
    color: Theme.colors.text.tertiary,
  },
}); 