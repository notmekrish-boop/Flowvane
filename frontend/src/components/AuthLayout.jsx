import { MotionConfig, motion, useReducedMotion } from "motion/react";
import SlicedText from "./kokonutui/sliced-text";

function AuthLayout({ title, description, children, footer }) {
  const reduceMotion = useReducedMotion();

  return (
    <MotionConfig reducedMotion="user">
      <main className="auth-page">
        <div className="auth-shell">
          <section className="auth-story" aria-label="About Flowvane">
            <div className="auth-story-top">
              <SlicedText as="h1" text="Flowvane" splitSpacing={0} className="auth-brand-wordmark" containerClassName="auth-brand-wordmark-wrap" aria-label="Flowvane" />
              <p className="auth-brand-caption">PROJECTS · TASKS · TEAMWORK</p>
            </div>

            <div className="auth-story-copy">
              <p className="auth-story-kicker">Make room for good work.</p>
              <h2>Keep the moving parts<br />moving together.</h2>
              <p>Bring projects, tasks, and team conversations into one clear workspace.</p>
            </div>

            <div className="auth-story-footer">
              <span>Plan with context</span>
              <span>Keep work in view</span>
              <span>Move forward together</span>
            </div>
          </section>

          <section className="auth-form-region" aria-label={title}>
            <motion.div
              className="auth-form-panel"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="auth-panel-kicker">FLOWVANE WORKSPACE</p>
              <h2>{title}</h2>
              <p className="auth-panel-description">{description}</p>
              {children}
              {footer}
            </motion.div>
          </section>
        </div>
      </main>
    </MotionConfig>
  );
}

export default AuthLayout;
