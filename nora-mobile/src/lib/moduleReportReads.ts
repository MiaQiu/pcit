/**
 * Reports the parent has opened, per Learn module (module and play reports),
 * so the module's Today shows "Read report" until the report is opened —
 * from Today, My plan, Progress or anywhere else. Per user, on this device.
 */

import * as userStorage from './userStorage';
import type { LearnModuleKey } from '../constants/learnModules';

const readReportsKey = (moduleKey: string) => `@learn_module_read_reports_${moduleKey}`;
// Newest last; only the latest report on Today ever needs checking.
const READ_REPORTS_KEPT = 20;

export const getReadReportIds = async (moduleKey: LearnModuleKey): Promise<string[]> => {
  try {
    const value = await userStorage.getItem(readReportsKey(moduleKey));
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

export const markModuleReportRead = async (moduleKey: LearnModuleKey, recordingId: string): Promise<string[]> => {
  const ids = await getReadReportIds(moduleKey);
  if (ids.includes(recordingId)) return ids;
  const next = [...ids, recordingId].slice(-READ_REPORTS_KEPT);
  await userStorage.setItem(readReportsKey(moduleKey), JSON.stringify(next)).catch(() => {});
  return next;
};
