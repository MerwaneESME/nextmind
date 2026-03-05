"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"

export type TooltipItem = {
  id: string
  name: string
  role?: string | null
  image?: string | null
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

const AVATAR_GRADIENTS = [
  "from-primary-400 to-primary-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-600",
  "from-purple-400 to-purple-600",
  "from-rose-400 to-rose-600",
  "from-sky-400 to-sky-600",
  "from-teal-400 to-teal-600",
]

function gradientFor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

function AvatarItem({
  item,
  zIndex,
  size,
}: {
  item: TooltipItem
  zIndex: number
  size: "xs" | "sm" | "md"
}) {
  const [hovered, setHovered] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const gradient = gradientFor(item.name)
  const initials = getInitials(item.name)
  const dim = size === "xs" ? "w-5 h-5" : size === "sm" ? "w-7 h-7" : "w-8 h-8"
  const textSize = size === "xs" ? "text-[8px]" : size === "sm" ? "text-[9px]" : "text-[10px]"

  const handleMouseEnter = () => {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
    setHovered(true)
  }

  return (
    <>
      <div
        ref={ref}
        className="relative cursor-pointer"
        style={{ zIndex: hovered ? 50 : zIndex }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className={`${dim} rounded-full object-cover border-2 border-white shadow-sm`}
          />
        ) : (
          <div
            className={`${dim} rounded-full bg-gradient-to-br ${gradient} border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0`}
          >
            <span className={`${textSize} font-bold text-white select-none`}>{initials}</span>
          </div>
        )}
      </div>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {hovered && rect && (
              /* Outer div handles absolute positioning + centering */
              <div
                style={{
                  position: "fixed",
                  top: rect.top - 10,
                  left: rect.left + rect.width / 2,
                  transform: "translate(-50%, -100%)",
                  zIndex: 99999,
                  pointerEvents: "none",
                }}
              >
                {/* Inner motion div handles only opacity/y animation */}
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="relative"
                >
                  {/* Tooltip card */}
                  <div className="bg-white border border-neutral-200 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap text-center">
                    <p className="text-sm font-bold text-neutral-900 leading-tight">{item.name}</p>
                    {item.role && (
                      <p className="text-xs text-neutral-500 leading-tight mt-0.5">{item.role}</p>
                    )}
                  </div>
                  {/* Arrow pointing down (triangle + border) */}
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-0 h-0 border-x-[7px] border-x-transparent border-t-[7px] border-t-neutral-200" />
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-white" />
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  )
}

export function AnimatedTooltip({
  items,
  size = "sm",
  max,
}: {
  items: TooltipItem[]
  size?: "xs" | "sm" | "md"
  max?: number
}) {
  const shown = max ? items.slice(0, max) : items
  const remaining = max && items.length > max ? items.length - max : 0
  const dim = size === "xs" ? "w-5 h-5" : size === "sm" ? "w-7 h-7" : "w-8 h-8"
  const textSize = size === "xs" ? "text-[8px]" : size === "sm" ? "text-[9px]" : "text-[10px]"

  return (
    <div className="flex items-center -space-x-2">
      {shown.map((item, index) => (
        <AvatarItem
          key={item.id}
          item={item}
          zIndex={shown.length - index}
          size={size}
        />
      ))}
      {remaining > 0 && (
        <div
          className={`${dim} rounded-full bg-neutral-100 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0`}
        >
          <span className={`${textSize} font-semibold text-neutral-500 select-none`}>+{remaining}</span>
        </div>
      )}
    </div>
  )
}
