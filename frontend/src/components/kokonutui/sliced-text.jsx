"use client";;
/**
 * @author: @dorianbaffier
 * @description: Sliced Text
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { MotionConfig, motion } from "motion/react";
import { cn } from "@/lib/utils";

const SlicedText = ({
  text = "Sliced Text",
  className,
  containerClassName,
  splitSpacing = 2,
  as = "span",
  ...props
}) => {
  const Root = motion[as];

  return (
    // Under reduced motion the slices still merge (clip-path, opacity) but
    // skip the vertical offset.
    <MotionConfig reducedMotion="user">
      <Root
        className={cn("relative inline-block text-center", containerClassName)}
        initial="default"
        whileHover="hover"
        {...props}
      >
        <motion.span
          aria-hidden="true"
          // -ml-0.5 nudges the top half left, so the cut reads as a slice.
          className={cn(
            "absolute top-0 left-0 -ml-0.5 w-full text-4xl",
            className
          )}
          transition={{ duration: 0.1 }}
          variants={{
            default: {
              clipPath: "inset(0 0 50% 0)",
              y: -splitSpacing / 2,
              opacity: 1,
            },
            hover: {
              clipPath: "inset(0 0 0 0)",
              y: 0,
              opacity: 0,
            },
          }}
        >
          {text}
        </motion.span>
        <motion.span
          aria-hidden="true"
          className={cn("absolute top-0 left-0 w-full text-4xl", className)}
          transition={{ duration: 0.1 }}
          variants={{
            default: {
              clipPath: "inset(50% 0 0 0)",
              y: splitSpacing / 2,
              opacity: 1,
            },
            hover: {
              clipPath: "inset(0 0 0 0)",
              y: 0,
              opacity: 1,
            },
          }}
        >
          {text}
        </motion.span>

        {/* Sizes the container and is the one copy exposed to assistive tech.
            opacity-0 comes last so a consumer's className can't reveal it. */}
        <span className={cn("block text-4xl", className, "opacity-0")}>
          {text}
        </span>
      </Root>
    </MotionConfig>
  );
};

export default SlicedText;
