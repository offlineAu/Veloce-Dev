'use client';
import type { MeetingResult as Result } from '@/lib/meeting';
export function MeetingResult({ meeting }: { meeting: Result }) {
  const title = meeting.status === 'CONFIRMED' ? 'Your meeting with Veloce is booked.' : meeting.status === 'REQUESTED' ? 'Meeting requested—awaiting confirmation.' : meeting.status === 'RESCHEDULED' ? 'This meeting has been rescheduled.' : 'This meeting has been cancelled.';
  return <div role="status" className="mt-5 rounded-xl border border-line bg-surface p-5">
    <h4 className="text-xl">{title}</h4>
    <p className="mt-4 font-semibold">{new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short', timeZone: meeting.timezone }).format(new Date(meeting.start))}</p>
    <p className="mt-1 text-sm">{meeting.timezone} · {Math.round((Date.parse(meeting.end) - Date.parse(meeting.start)) / 60_000)} minutes</p>
    {meeting.location ? <p className="mt-3 break-words text-sm">{meeting.location.startsWith('https://') ? <a href={meeting.location} target="_blank" rel="noopener noreferrer" className="underline">Join the meeting</a> : meeting.location}</p> : <p className="mt-3 text-sm">Check the provider booking details for the meeting location.</p>}
    <a href={meeting.manageUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-semibold underline">View details, add to calendar, reschedule or cancel</a>
  </div>;
}
