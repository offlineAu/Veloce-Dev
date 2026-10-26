'use client';
import { track } from "@/lib/analytics/client";
import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import type { MeetingConfig, MeetingContext } from '@/lib/meeting';
import { prefersReducedMotion } from '@/lib/use-reduced-motion';

type MeetingState = { config: MeetingConfig; open: boolean; started: boolean; context?: MeetingContext; entryPoint: 'workbench' | 'contact'; returnToExample: boolean; refToken?: string; contactEmail: string; show: (context?: MeetingContext, entryPoint?: 'workbench' | 'contact', opener?: HTMLElement) => void; back: () => void };
const Context = createContext<MeetingState | null>(null);
export function MeetingProvider({ children, config, refToken, contactEmail }: { children: ReactNode; config: MeetingConfig; refToken?: string; contactEmail: string }) {
  const [state, setState] = useState<{ open: boolean; started: boolean; context?: MeetingContext; entryPoint: 'workbench' | 'contact' }>({ open: false, started: false, entryPoint: 'workbench' });
  const opener = useRef<HTMLElement | undefined>(undefined);
  const [returnToExample, setReturnToExample] = useState(true);
  const show = useCallback((context?: MeetingContext, entryPoint: 'workbench' | 'contact' = 'workbench', trigger?: HTMLElement) => {
    opener.current = trigger;
    setReturnToExample(entryPoint === 'workbench');
    track("cta_clicked", { placement: "meeting" });
    setState(prev => ({ ...prev, open: true, context: prev.started ? prev.context : context, started: true, entryPoint: prev.started ? prev.entryPoint : entryPoint }));
    requestAnimationFrame(() => {
      const panel = document.getElementById('veloce-meeting-panel');
      panel?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      document.getElementById('veloce-meeting-title')?.focus({ preventScroll: true });
    });
  }, []);
  const back = useCallback(() => {
    setState(prev => ({ ...prev, open: false }));
    requestAnimationFrame(() => {
      const usable = (element?: HTMLElement | null) => element?.isConnected && !element.closest('[inert], [hidden], [aria-hidden="true"]') && element.getClientRects().length > 0;
      // Menu buttons unmount and floating controls collapse when focus moves into the panel.
      const fallback = document.querySelector<HTMLButtonElement>(returnToExample ? '[data-workbench-meeting]' : '[data-hero-cta]');
      const target = usable(opener.current) ? opener.current : fallback;
      target?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      target?.focus({ preventScroll: true });
    });
  }, [returnToExample]);
  return <Context.Provider value={{ config, ...state, returnToExample, show, back, refToken, contactEmail }}>{children}</Context.Provider>;
}
export function useMeeting() { const value = useContext(Context); if (!value) throw new Error('MeetingProvider is required'); return value; }
export function OpenMeetingButton({ context, entryPoint, ...props }: ButtonProps & { context?: MeetingContext; entryPoint?: 'workbench' | 'contact' }) {
  const meeting = useMeeting();
  return <Button {...props} data-meeting-trigger onClick={e => { props.onClick?.(e); if (!e.defaultPrevented) meeting.show(context, entryPoint, e.currentTarget); }}>{props.children ?? (meeting.config.enabled ? 'Book a meeting with Veloce' : 'Request a meeting with Veloce')}</Button>;
}
