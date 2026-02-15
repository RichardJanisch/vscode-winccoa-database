import type { AlertInstance, AlertClass } from './configs';

/**
 * WinCC OA color name → CSS color mapping.
 * Based on VDI/VDE 3699 standard alarm color conventions.
 */
export const WINCCOA_COLORS: Record<string, { bg: string; fg: string }> = {
  // Information - teal/cyan
  'informationCamAckn': { bg: '#0097a7', fg: '#ffffff' },

  // Advance alarm - light blue
  'advanceAlarmCamUna': { bg: '#4fc3f7', fg: '#000000' },
  'advanceAlarmCamAckn': { bg: '#4fc3f7', fg: '#000000' },
  'advanceAlarmWentUna': { bg: '#81d4fa', fg: '#000000' },

  // Warning - yellow
  'warningCamUna': { bg: '#fdd835', fg: '#000000' },
  'warningCamAckn': { bg: '#fdd835', fg: '#000000' },
  'warningCamWentUna': { bg: '#fff176', fg: '#000000' },

  // Alert - red
  'alertCamUna': { bg: '#f44336', fg: '#ffffff' },
  'alertCamAckn': { bg: '#e53935', fg: '#ffffff' },
  'alertWentUna': { bg: '#ef9a9a', fg: '#000000' },
  'alertCamWentUna': { bg: '#ef9a9a', fg: '#000000' },

  // Danger - dark red
  'dangerCamUna': { bg: '#b71c1c', fg: '#ffffff' },
  'dangerCamAckn': { bg: '#c62828', fg: '#ffffff' },
  'dangerWentUna': { bg: '#e57373', fg: '#000000' },
  'dangerCamWentUna': { bg: '#e57373', fg: '#000000' },

  // Disturbance - orange/amber
  'disturbanceCamUna': { bg: '#ff6f00', fg: '#000000' },
  'disturbanceCamAckn': { bg: '#ff8f00', fg: '#000000' },
  'disturbanceWentUna': { bg: '#ffb74d', fg: '#000000' },
  'disturbanceCamWentUna': { bg: '#ffb74d', fg: '#000000' },

  // System alarms (reuse alert colors)
  'Sys_AlarmCamUna': { bg: '#f44336', fg: '#ffffff' },
  'Sys_AlarmCamAckn': { bg: '#e53935', fg: '#ffffff' },

  // System warnings
  'warnKamUnq': { bg: '#fdd835', fg: '#000000' },
  'warnKamQuit': { bg: '#fdd835', fg: '#000000' },
};

export type AlarmState = 'came_unack' | 'came_ack' | 'went_unack' | 'went_ack' | 'none';

/** Determine the alarm state from an alert instance */
export function getAlarmState(alert: AlertInstance): AlarmState {
  const hasCame = alert.came_time !== null;
  const hasWent = alert.went_time !== null;
  const ackCame = alert.ack_time_came !== null;
  const ackWent = alert.ack_time_went !== null;

  if (!hasCame) return 'none';
  if (!hasWent) {
    return ackCame ? 'came_ack' : 'came_unack';
  }
  return ackWent ? 'went_ack' : 'went_unack';
}

/** Pick the matching color name from the alert class based on alarm state */
export function getAlarmColorName(alertClass: AlertClass, state: AlarmState): string | null {
  switch (state) {
    case 'came_unack': return alertClass.color_c_nack;
    case 'came_ack': return alertClass.color_c_ack;
    case 'went_unack': return alertClass.color_g_nack;
    default: return alertClass.color_none;
  }
}

/** Resolve a WinCC OA color name to CSS bg/fg colors */
export function resolveColor(colorName: string | null): { bg: string; fg: string } {
  if (!colorName) return { bg: 'transparent', fg: 'inherit' };
  return WINCCOA_COLORS[colorName] ?? { bg: '#666666', fg: '#ffffff' };
}

/** Get the CSS blink class for an alarm state (VDI/VDE 3699: 2Hz CAME, 0.5Hz WENT) */
export function getBlinkClass(state: AlarmState): string {
  switch (state) {
    case 'came_unack': return 'blink-fast';
    case 'went_unack': return 'blink-slow';
    default: return '';
  }
}

/** Human-readable label for an alarm state */
export function getAlarmStateLabel(state: AlarmState): string {
  switch (state) {
    case 'came_unack': return 'CAME (unacknowledged)';
    case 'came_ack': return 'CAME (acknowledged)';
    case 'went_unack': return 'WENT (unacknowledged)';
    case 'went_ack': return 'WENT (acknowledged)';
    default: return '';
  }
}
