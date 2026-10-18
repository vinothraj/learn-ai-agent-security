import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export { buildLabReportHtml } from '@laas/shared';

/** Creates a PDF on-device and opens the share sheet. Returns false if unsupported. */
export async function exportLabReport(html: string, fileTitle: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return true;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileTitle });
  return true;
}
