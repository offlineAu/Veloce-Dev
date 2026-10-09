'use client';
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { MeetingConfig, MeetingContext } from '@/lib/meeting';
import { prefersReducedMotion } from '@/lib/use-reduced-motion';

type MeetingState = { config: MeetingConfig; open: boolean; started: boolean; context?: MeetingContext; entryPoint: 'workbench' | 'contact'; refToken?: string; contactEmail: string; show: (context?: MeetingContext, entryPoint?: 'workbench' | 'contact') => void; back: () => void };
const Context = createContext<MeetingState | null>(null);
export function MeetingProvider({ children, config, refToken, contactEmail }: { children: ReactNode; config: MeetingConfig; refToken?: string; contactEmail: string }) {
  const [state, setState] = useState<{ open: boolean; started: boolean; context?: MeetingContext; entryPoint: 'workbench' | 'contact' }>({ open: false, started: false, entryPoint: 'workbench' });
  const show = useCallback((context?: MeetingContext, entryPoint: 'workbench' | 'contact' = 'workbench') => {
    setState(prev => ({ ...prev, open: true, context: prev.started ? prev.context : context, started: true, entryPoint: prev.started ? prev.entryPoint : entryPoint }));
    requestAnimationFrame(() => {
      const panel = document.getElementById('veloce-meeting-panel');
      panel?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      document.getElementById('veloce-meeting-title')?.focus({ preventScroll: true });
    });
  }, []);
  const back = useCallback(() => { setState(prev => ({ ...prev, open: false })); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-workbench-meeting]')?.focus()); }, []);
  return <Context.Provider value={{ config, ...state, show, back, refToken, contactEmail }}>{children}</Context.Provider>;
}
export function useMeeting() { const value = useContext(Context); if (!value) throw new Error('MeetingProvider is required'); return value; }
export function OpenMeetingButton({ context, entryPoint, ...props }: ButtonProps & { context?: MeetingContext; entryPoint?: 'workbench' | 'contact' }) {
  const meeting = useMeeting();
  return <Button {...props} onClick={e => { props.onClick?.(e); if (!e.defaultPrevented) meeting.show(context, entryPoint); }}>{props.children ?? (meeting.config.enabled ? 'Book a meeting with Veloce' : 'Request a meeting with Veloce')}</Button>;
}
