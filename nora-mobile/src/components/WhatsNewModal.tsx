import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  ScrollView,
} from 'react-native';

const IOS_STORE_URL = process.env.EXPO_PUBLIC_IOS_STORE_URL || '';
const ANDROID_STORE_URL = process.env.EXPO_PUBLIC_ANDROID_STORE_URL || '';

interface Props {
  visible: boolean;
  version: string;
  whatsNew: string[];
  onDismiss: () => void;
}

export const WhatsNewModal: React.FC<Props> = ({ visible, version, whatsNew, onDismiss }) => {
  const handleUpdate = () => {
    const url = Platform.OS === 'ios' ? IOS_STORE_URL : ANDROID_STORE_URL;
    if (url) {
      Linking.openURL(url);
    }
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>What's New</Text>
          <Text style={styles.version}>Version {version}</Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {whatsNew.map((item, index) => (
              <View key={index} style={styles.item}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss}>
            <Text style={styles.dismissButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 40,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#8C49D5',
    fontWeight: '600',
    marginBottom: 20,
  },
  list: {
    maxHeight: 200,
    marginBottom: 28,
  },
  item: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 16,
    color: '#8C49D5',
    marginRight: 10,
    lineHeight: 22,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  updateButton: {
    backgroundColor: '#8C49D5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissButtonText: {
    color: '#888888',
    fontSize: 15,
  },
});
