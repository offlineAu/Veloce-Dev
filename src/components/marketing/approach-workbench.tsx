"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, CheckCheck, ChevronRight, Hammer, Map, RefreshCw } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { CardRibbons } from "@/components/brand/card-ribbons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deliveryStages, workflowExamples } from "@/content/site";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import styles from "./veloce-bento.module.css";

export function ApproachWorkbench() {
  const [stage, setStage] = useState("think");
  const [exampleIndex, setExampleIndex] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [priority, setPriority] = useState("first");
  const reduce = useReducedMotion();
  const id = useId();
  const stageButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeStage = deliveryStages.find((s) => s.id === stage) ?? deliveryStages[0];
  const example = workflowExamples[exampleIndex] ?? workflowExamples[0];
  const icons = { map: Map, hammer: Hammer, refresh: RefreshCw };
  const firstFeature = priority === "first" ? example.first : example.later;
  const laterFeature = priority === "first" ? example.later : example.first;
  const demo = priority === "first" ? { title: example.buildTitle, options: example.options, selectionLabel: example.selectionLabel, selectionResult: example.selectionResult } : example.alternate;
  const improvements = priority === "first" ? example.feedback : example.alternateFeedback;

  function goToStage(next: string) {
    setStage(next);
    stageButtons.current[next]?.focus();
  }

  function chooseExample(index: number) {
    setExampleIndex(index);
    setSelection(null);
    setFeedback(null);
    setPriority("first");
    setStage("think");
  }

  return (
    <Tabs value={stage} onValueChange={setStage} className="mt-12" data-approach-workbench>
      <TabsList aria-label="How we work together" className={styles.stageNav}>
        {deliveryStages.map((s, i) => {
          const StageIcon = icons[s.icon];
          return <TabsTrigger key={s.id} value={s.id} ref={(node) => { stageButtons.current[s.id] = node; }} className={styles.stageButton}><span className={styles.stageIndex} aria-hidden>0{i + 1}</span><StageIcon aria-hidden /><span>{s.label}</span><ChevronRight aria-hidden className={styles.stageArrow} /></TabsTrigger>;
        })}
      </TabsList>
      <div className={styles.workbench}>
        <div className={styles.delivery}>
          <CardRibbons activeStage={activeStage.id} />
          {deliveryStages.map((s, i) => (
            <TabsContent key={s.id} value={s.id} className={styles.deliveryContent}>
              <p className={styles.eyebrow}>Working together / 0{i + 1}</p>
              <h3 className={styles.flipHeading}><motion.span key={s.id} initial={reduce ? false : { rotateX: -70, y: 12, opacity: 0 }} animate={{ rotateX: 0, y: 0, opacity: 1 }} transition={{ duration: reduce ? 0 : 0.5 }}>{s.headline}</motion.span></h3>
              <p className={styles.stageSummary}>{s.summary}</p>
              <ol start={i * 2 + 1} className={styles.steps}>
                {s.steps.map((step, j) => <li key={step.title}><span aria-hidden className={styles.stepNumber}>0{i * 2 + j + 1}</span><div><h4>{step.title}</h4><p>{step.body}</p></div></li>)}
              </ol>
              <dl className={styles.handoff}>
                <div><dt>Your part</dt><dd>{s.yourPart}</dd></div>
                <div><dt>What you receive</dt><dd>{s.youReceive}</dd></div>
              </dl>
              <p className={styles.principle}><CheckCheck aria-hidden />{s.principle}</p>
            </TabsContent>
          ))}
        </div>
        <aside className={styles.example} aria-labelledby={`${id}-example-title`}>
          <div className={styles.exampleTop}><LogoMark className={styles.mark} /><p className={styles.eyebrow}>The working version</p><span className={styles.exampleBadge}>Example</span></div>
          <h3 id={`${id}-example-title`}>Try the process.</h3>
          <p className={styles.muted}>Pick a workflow, then explore how it moves from a problem to a useful system.</p>
          <div className={styles.examplePicker} role="group" aria-label="Example workflows">
            {workflowExamples.map((e, i) => <button key={e.id} type="button" aria-pressed={exampleIndex === i} onClick={() => chooseExample(i)}>{e.label}</button>)}
          </div>
          <div className={styles.prototype}>
            <div className={styles.prototypeBar}><span className={styles.prototypeDots} aria-hidden><i /><i /><i /></span><span>{example.label}</span><span className={styles.prototypeStage}>{activeStage.label}</span></div>
            <AnimatePresence initial={false} mode="wait">
              <motion.div key={`${stage}-${example.id}`} className={styles.prototypeBody}
                initial={reduce ? false : { opacity: 0, y: 14, rotateX: -5 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: reduce ? 0 : -12 }} transition={{ duration: reduce ? 0 : 0.22 }}>
                {stage === "think" ? <>
                  <p className={styles.eyebrow}>The problem</p><p className={styles.problem}>{example.problem}</p>
                  <p className={styles.eyebrow}>What should come first?</p>
                  <div className={styles.priorityOptions} role="group" aria-label="First version priority">
                    {[{ value: "first", label: example.first }, { value: "later", label: example.later }].map((option) => <button type="button" key={option.value} aria-pressed={priority === option.value} onClick={() => { setPriority(option.value); setSelection(null); setFeedback(null); }}><span className={styles.choiceDot} aria-hidden>{priority === option.value ? <Check /> : null}</span>{option.label}</button>)}
                  </div>
                  <div className={styles.scopeResult} role="status"><p><strong>First version</strong>{firstFeature}</p><p><strong>Later</strong>{laterFeature}</p></div>
                  <button type="button" className={styles.demoNext} onClick={() => goToStage("build")}>See a working example <ArrowRight aria-hidden /></button>
                </> : stage === "build" ? <>
                  <p className={styles.eyebrow}>A small, usable interaction</p><h4>{demo.title}</h4>
                  <div className={styles.demoOptions} role="group" aria-label={demo.selectionLabel}>{demo.options.map((option) => <button type="button" key={option} aria-pressed={selection === option} onClick={() => setSelection(option)}>{option}</button>)}</div>
                  <div className={styles.demoResult} role="status"><CheckCheck aria-hidden /><p>{selection ? <><strong>{demo.selectionResult}: {selection}</strong><span>The example now reflects your choice.</span></> : <><strong>Ready for your input</strong><span>Choose an option above to try the interaction.</span></>}</p></div>
                  <p className={styles.demoNote}>A working version makes the flow easier to review.</p>
                  <button type="button" className={styles.demoNext} onClick={() => goToStage("improve")}>Choose an improvement <ArrowRight aria-hidden /></button>
                </> : <>
                  <p className={styles.eyebrow}>Learn from the working version</p><h4>{example.feedbackLabel}</h4>
                  <div className={styles.priorityOptions} role="group" aria-label="Next improvement">{improvements.map((option) => <button type="button" key={option} aria-pressed={feedback === option} onClick={() => setFeedback(option)}><span className={styles.choiceDot} aria-hidden>{feedback === option ? <Check /> : null}</span>{option}</button>)}</div>
                  <div className={styles.demoResult} role="status"><RefreshCw aria-hidden /><p><strong>{feedback ? "Next improvement to discuss" : "Your feedback guides the next step"}</strong><span>{feedback ?? "Select a change that would make this workflow more useful."}</span></p></div>
                  <p className={styles.demoNote}>In a real project, we review feedback, agree the change, and test the improvement.</p>
                  <button type="button" className={styles.demoNext} onClick={() => goToStage("think")}>Revisit the scope <ArrowRight aria-hidden /></button>
                </>}
              </motion.div>
            </AnimatePresence>
          </div>
          <p className={styles.exampleDisclaimer}>Illustrative workflow only. No real booking or request is created.</p>
        </aside>
      </div>
    </Tabs>
  );
}
