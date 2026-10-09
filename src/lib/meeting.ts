export interface MeetingConfig {
  enabled: boolean;
  duration?: number;
  format?: string;
  costLabel?: string;
}
export interface MeetingContext {
  workflow: 'booking' | 'approvals';
  priority: 'first' | 'later';
  improvement?: string;
}
export function suggestedDiscussion(context?: MeetingContext): string {
  if (!context) return '';
  const booking = context.workflow === 'booking';
  const priority = booking
    ? context.priority === 'first' ? 'letting customers choose an available time' : 'automated reminders'
    : context.priority === 'first' ? 'reviewing requests in one place' : 'automatic escalation';
  return `I'd like to discuss ${booking ? 'customer bookings' : 'team approvals'}. My first priority is ${priority}${context.improvement ? `, with ${context.improvement.toLowerCase()} as a possible next improvement` : ''}.`;
}
export interface MeetingResult {
  status: 'REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'RESCHEDULED';
  start: string;
  end: string;
  timezone: string;
  location?: string;
  manageUrl: string;
}
export interface MeetingSession {
  reference: string;
  accessToken: string;
  url: string;
  calLink: string;
  calOrigin?: string;
  embedJsUrl?: string;
  config: Record<string, string>;
}
