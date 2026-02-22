import { motion } from "motion/react";

interface LoadingAnimationProps {
  onComplete?: () => void;
}

export function LoadingAnimation({ onComplete }: LoadingAnimationProps) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 1 }}
        animate={{
          opacity: 1,
          scale: [1, 1, 1.15, 1],
        }}
        transition={{
          opacity: { duration: 0.5 },
          scale: {
            times: [0, 0.65, 0.83, 1],
            duration: 2.3,
            ease: "easeInOut",
          },
        }}
        onAnimationComplete={() => onComplete?.()}
        className="flex flex-col items-center"
      >
        <div className="relative w-64 h-48 flex items-center justify-center">
          <svg
            viewBox="0 0 120 100"
            className="w-full h-full drop-shadow-sm"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Cap Outline */}
            <motion.path
              d="M 20 30 Q 60 10 100 30 L 95 70 Q 60 50 25 70 Z"
              stroke="black"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="white"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
            />

            {/* Red Cross Group */}
            <g transform="translate(60, 43)">
              <motion.g
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: 1.0,
                  duration: 0.4,
                  ease: "easeOut",
                }}
              >
                <motion.path
                  d="M 0 -12 V 12 M -12 0 H 12"
                  stroke="#DC2626"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              </motion.g>
            </g>
          </svg>
        </div>

        {/* Text Animation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.2,
            duration: 0.8,
            ease: "easeOut",
          }}
          className="mt-[-40px] z-10"
        >
          <h1 className="text-6xl font-bold text-gray-900 tracking-tight font-sans">
            Nursely
          </h1>
        </motion.div>
      </motion.div>
    </div>
  );
}
