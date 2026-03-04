export const statusColors = {
  phase: {
    planifiee: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      border: "border-gray-300",
      dot: "bg-gray-500",
    },
    planifie: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      border: "border-gray-300",
      dot: "bg-gray-500",
    },
    devis: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      border: "border-yellow-300",
      dot: "bg-yellow-500",
    },
    validee: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      border: "border-blue-300",
      dot: "bg-blue-500",
    },
    en_cours: {
      bg: "bg-orange-100",
      text: "text-orange-700",
      border: "border-orange-300",
      dot: "bg-orange-500",
    },
    terminee: {
      bg: "bg-green-100",
      text: "text-green-700",
      border: "border-green-300",
      dot: "bg-green-500",
    },
    receptionnee: {
      bg: "bg-purple-100",
      text: "text-purple-700",
      border: "border-purple-300",
      dot: "bg-purple-500",
    },
  },

  project: {
    planification: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      dot: "bg-gray-500",
    },
    draft: {
      bg: "bg-gray-100",
      text: "text-gray-700",
      dot: "bg-gray-500",
    },
    en_attente: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
      dot: "bg-yellow-500",
    },
    en_cours: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      dot: "bg-blue-500",
    },
    termine: {
      bg: "bg-green-100",
      text: "text-green-700",
      dot: "bg-green-500",
    },
    archive: {
      bg: "bg-gray-100",
      text: "text-gray-500",
      dot: "bg-gray-400",
    },
  },

  lot: {
    planifie: {
      bg: "bg-gray-100",
      text: "text-gray-700",
    },
    devis_en_cours: {
      bg: "bg-yellow-100",
      text: "text-yellow-700",
    },
    devis_valide: {
      bg: "bg-blue-100",
      text: "text-blue-700",
    },
    en_cours: {
      bg: "bg-orange-100",
      text: "text-orange-700",
    },
    termine: {
      bg: "bg-green-100",
      text: "text-green-700",
    },
    valide: {
      bg: "bg-purple-100",
      text: "text-purple-700",
    },
  },

  alert: {
    success: {
      bg: "bg-green-50",
      text: "text-green-800",
      border: "border-green-200",
      icon: "✅",
    },
    warning: {
      bg: "bg-yellow-50",
      text: "text-yellow-800",
      border: "border-yellow-200",
      icon: "⚠️",
    },
    error: {
      bg: "bg-red-50",
      text: "text-red-800",
      border: "border-red-200",
      icon: "❌",
    },
    info: {
      bg: "bg-blue-50",
      text: "text-blue-800",
      border: "border-blue-200",
      icon: "💡",
    },
  },
} as const;

export const phaseGradients = {
  1: "from-red-400 to-red-600",
  2: "from-orange-400 to-orange-600",
  3: "from-yellow-400 to-yellow-600",
  4: "from-green-400 to-green-600",
  5: "from-blue-400 to-blue-600",
  6: "from-purple-400 to-purple-600",
  7: "from-pink-400 to-pink-600",
  8: "from-indigo-400 to-indigo-600",
} as const;

export function getPhaseGradient(order: number): string {
  return phaseGradients[order as keyof typeof phaseGradients] || phaseGradients[1];
}

