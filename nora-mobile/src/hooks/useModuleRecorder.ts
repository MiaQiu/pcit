/**
 * useModuleRecorder
 * Records a Learn module session (e.g. a screen-time ending) in place on
 * LearnModuleScreen, instead of the Record tab's timed play/discipline
 * session. Same native recorder (AudioSessionManager, keeps recording in the
 * background) and upload path (UploadProcessingContext.startUpload, tagged
 * with the module) as RecordScreen, without a fixed session length: the
 * parent stops it, with a MAX_MODULE_RECORDING_SECONDS safety auto-stop.
 *
 * start('play') instead records a regular play session (the following-day "Play time
 * recording" card): uploaded untagged, so it gets the regular PCIT report, and
 * auto-stopped at PLAY_RECORDING_SECONDS like the Record tab's Special Time.
 * One hook per screen records both, since every instance would catch the
 * native auto-stop event.
 *
 * On stop: recordings under MIN_SECONDS are rejected; otherwise it uploads
 * and onUploaded runs (the server session now exists, so the module screen
 * can show "processing").
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import {
  startRecording as startNativeRecording,
  stopRecording as stopNativeRecording,
  getRecordingStatus,
  addAutoStopListener,
  removeAutoStopListener,
  getPendingRecording,
  endBackgroundTask,
} from '../utils/AudioSessionManager';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import { useNetworkStatus } from './useNetworkStatus';
import amplitudeService from '../services/amplitudeService';
import { reportError } from '../utils/reportError';
import type { LearnModuleKey } from '../constants/learnModules';

// Screen-time endings run 10–30 min (the module's tag); stop a forgotten
// recording at 30.
const MAX_MODULE_RECORDING_SECONDS = 30 * 60;
const PLAY_RECORDING_SECONDS = 5 * 60;
const MIN_SECONDS = 10;
const POLL_MS = 500;

export type ModuleRecorderState = 'idle' | 'recording' | 'stopping';
export type ModuleRecorderKind = 'module' | 'play';

export const useModuleRecorder = ({
  moduleKey,
  onUploaded,
}: {
  moduleKey: LearnModuleKey;
  onUploaded: (kind: ModuleRecorderKind) => void;
}) => {
  const { t } = useTranslation();
  const uploadProcessing = useUploadProcessing();
  const { isOnline } = useNetworkStatus();
  const [state, setState] = useState<ModuleRecorderState>('idle');
  const [durationMillis, setDurationMillis] = useState(0);
  const [kind, setKind] = useState<ModuleRecorderKind>('module');
  const kindRef = useRef<ModuleRecorderKind>('module');
  const stateRef = useRef<ModuleRecorderState>('idle');
  const autoStopRef = useRef<EmitterSubscription | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);

  const setRecorderState = (next: ModuleRecorderState) => {
    stateRef.current = next;
    setState(next);
  };

  const clearWatchers = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (autoStopRef.current) {
      removeAutoStopListener(autoStopRef.current);
      autoStopRef.current = null;
    }
  };

  useEffect(() => () => clearWatchers(), []);

  // Shared by Stop and the native auto-stop: validate, then upload.
  const finish = async (uri: string, millis: number) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    clearWatchers();
    await getPendingRecording().catch(() => null); // clear native pending copy (auto-stop path)

    const durationSeconds = Math.floor(millis / 1000);
    const isPlay = kindRef.current === 'play';
    amplitudeService.trackRecordingCompleted(durationSeconds, undefined, { source: isPlay ? 'learn_module_play' : 'learn_module', moduleKey });
    if (durationSeconds < MIN_SECONDS) {
      setRecorderState('idle');
      finishingRef.current = false;
      await endBackgroundTask();
      Alert.alert(t('learnV2.moduleRecorder.tooShortTitle'),
        t(isPlay ? 'learnV2.moduleScreenV2.playTime.tooShortMessage' : 'learnV2.moduleRecorder.tooShortMessage'));
      return;
    }

    const upload = async () => {
      try {
        await uploadProcessing.startUpload(uri, durationSeconds, 'CDI', isPlay ? undefined : moduleKey);
        setRecorderState('idle');
        onUploaded(isPlay ? 'play' : 'module');
      } catch (error) {
        reportError(error, 'useModuleRecorder.upload');
        Alert.alert(t('record.uploadFailedTitle'), t('record.uploadFailedMessage'), [
          { text: t('common.cancel'), style: 'cancel', onPress: () => setRecorderState('idle') },
          { text: t('record.retry'), onPress: upload },
        ]);
      }
    };
    await upload();
    await endBackgroundTask();
    finishingRef.current = false;
  };

  const start = async (nextKind: ModuleRecorderKind = 'module') => {
    if (stateRef.current !== 'idle') return;
    if (!isOnline) {
      Alert.alert(t('learnV2.moduleRecorder.offlineTitle'), t('learnV2.moduleRecorder.offlineMessage'));
      return;
    }
    // UploadProcessingContext tracks one upload at a time and ignores a new
    // one while another is uploading/processing.
    if (uploadProcessing.isProcessing) {
      Alert.alert(t('learnV2.moduleRecorder.busyTitle'), t('learnV2.moduleRecorder.busyMessage'));
      return;
    }
    if (AppState.currentState !== 'active') return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('record.permissionRequiredTitle'), t('record.permissionRequiredMessage'));
        return;
      }

      autoStopRef.current = addAutoStopListener(event => {
        finish(event.uri, event.durationMillis).catch(err => reportError(err, 'useModuleRecorder.autoStop'));
      });
      kindRef.current = nextKind;
      setKind(nextKind);
      await startNativeRecording(nextKind === 'play' ? PLAY_RECORDING_SECONDS : MAX_MODULE_RECORDING_SECONDS);
      setDurationMillis(0);
      setRecorderState('recording');
      amplitudeService.trackRecordingStarted(nextKind === 'play'
        ? { source: 'learn_module_play', sessionType: 'specialTime' }
        : { source: 'learn_module', sessionType: moduleKey });

      pollRef.current = setInterval(async () => {
        try {
          const status = await getRecordingStatus();
          if (status.isRecording) {
            setDurationMillis(status.durationMillis);
          } else if (stateRef.current === 'recording') {
            // Native stopped (auto-stop) while the event was missed — recover it.
            const pending = await getPendingRecording();
            if (pending) await finish(pending.uri, pending.durationMillis);
          }
        } catch (error) {
          console.error('[useModuleRecorder] status poll failed:', error);
        }
      }, POLL_MS);
    } catch (error) {
      clearWatchers();
      setRecorderState('idle');
      reportError(error, 'useModuleRecorder.start');
      Alert.alert(t('record.recordingIssueTitle'), t('record.recordingIssueMessage'));
    }
  };

  const stop = async () => {
    if (stateRef.current !== 'recording') return;
    setRecorderState('stopping');
    try {
      const result = await stopNativeRecording();
      if (!result.uri) throw new Error('stopRecording returned empty URI');
      await finish(result.uri, result.durationMillis);
    } catch (error) {
      clearWatchers();
      setRecorderState('idle');
      finishingRef.current = false;
      reportError(error, 'useModuleRecorder.stop');
      Alert.alert(t('record.recordingIssueTitle'), t('record.recordingIssueMessage'));
    }
  };

  return { state, kind, durationMillis, start, stop, isRecording: state !== 'idle' };
};
