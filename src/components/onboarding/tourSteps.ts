export type TourStepType = 'modal' | 'spotlight' | 'illustration' | 'fork-choice' | 'welcome-personalized';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';
export type OnboardingSource = 'direct' | 'extension' | 'save-context' | 'third-party';
export type ForkChoice = 'extension' | 'memory-studio';

export interface PlatformLink {
  name: string;
  url: string;
  icon: string;
}

export interface TourStep {
  id: string;
  type: TourStepType;
  title: string;
  content: string;
  targetSelector?: string;
  position?: TooltipPosition;
  buttonText?: string;
  showSkip?: boolean;
  showBack?: boolean;
  ctaButton?: {
    text: string;
    url?: string;
    onClick?: () => void;
  };
  confetti?: boolean;
  // For fork-choice type
  forkOptions?: {
    primary: { label: string; description: string; choice: ForkChoice };
    secondary: { label: string; description: string; choice: ForkChoice };
  };
  // For fork-choice with platform links (replaces primary option)
  platforms?: PlatformLink[];
  hints?: string[];
}

// ============================================
// FLOW 1: Direct Login (user visits domain directly)
// ============================================
export const directLoginSteps: TourStep[] = [
  {
    id: 'welcome',
    type: 'modal',
    title: 'Welcome aboard, {userName}!',
    content: 'Your AI-powered second brain awaits. Let me show you around in 30 seconds.',
    buttonText: "Let's go!",
    showSkip: true,
    showBack: false,
    position: 'center',
  },
  {
    id: 'sidebar',
    type: 'spotlight',
    title: 'Your Command Center',
    content: 'This sidebar is your home base. Pin favorite memories for quick access and track your getting started progress.',
    targetSelector: '[data-tour-id="left-sidebar"]',
    position: 'right',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'create-memory',
    type: 'spotlight',
    title: 'Capture Everything',
    content: 'One click to create a new memory bucket. Drop in files, paste text, or add URLs - your AI will remember it all.',
    targetSelector: '[data-tour-id="create-memory-button"]',
    position: 'bottom',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'buckets-grid',
    type: 'spotlight',
    title: 'Organize Your Mind',
    content: 'Each bucket is a topic, project, or persona. Create one for Work, Personal, Research - whatever fits your life.',
    targetSelector: '[data-tour-id="buckets-container"]',
    position: 'center',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'mcp-cta',
    type: 'spotlight',
    title: 'Connect Your Memory Everywhere',
    content: 'Use MCP servers to share your AI Memory with any compatible tool — Cursor, Windsurf, VS Code, Claude Desktop, ChatGPT, and more.',
    targetSelector: '[data-tour-id="mcp-connect-button"]',
    position: 'bottom',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'chat-preview',
    type: 'illustration',
    title: 'Talk to Your Memories',
    content: 'Open any bucket and chat with AI about everything inside. Ask questions, get summaries, find connections you missed.',
    position: 'center',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'extension-cta',
    type: 'modal',
    title: 'Stop Repeating Yourself',
    content: 'Our browser extension brings your AI memory to every platform. Improve prompts at chat agents, save text from any website, and access your context anywhere.',
    ctaButton: {
      text: 'Get Extension',
      url: 'https://chromewebstore.google.com/detail/cfegfckldnmbdnimjgfamhjnmjpcmgnf',
    },
    showSkip: true,
    showBack: true,
    position: 'center',
  },
  {
    id: 'completion',
    type: 'modal',
    title: "You're All Set!",
    content: 'Your memory journey begins now. Create your first bucket and start building your second brain.',
    buttonText: 'Start Creating',
    showSkip: false,
    showBack: true,
    confetti: true,
    position: 'center',
  },
];

// ============================================
// FLOW 2: Extension Login (user came from extension)
// ============================================
export const extensionLoginSteps: TourStep[] = [
  {
    id: 'welcome-extension',
    type: 'modal',
    title: 'Welcome aboard, {userName}!',
    content: "Great to have you here! You've just unlocked your AI-powered memory vault. Your extension is ready to use anywhere on the web.",
    buttonText: 'Continue',
    showSkip: false,
    showBack: false,
    position: 'center',
  },
  {
    id: 'fork-choice',
    type: 'fork-choice',
    title: 'Where would you like to start?',
    content: '',
    position: 'center',
    showSkip: false,
    showBack: false,
    platforms: [
      { name: 'ChatGPT', url: 'https://chat.openai.com', icon: 'chatgpt' },
      { name: 'Claude', url: 'https://claude.ai', icon: 'claude' },
      { name: 'Gemini', url: 'https://gemini.google.com', icon: 'gemini' },
      { name: 'Perplexity', url: 'https://perplexity.ai', icon: 'perplexity' },
      { name: 'Grok', url: 'https://grok.com', icon: 'grok' },
    ],
    hints: [
      'Right-click on any page to save it to your AI Memory',
      'Right-click on any page to open AI Chat Sidebar to chat with the website',
      'Cross reference every chat with your AI memories',
    ],
    forkOptions: {
      primary: {
        label: 'Try at AI Chat Agents',
        description: 'Open your favorite AI platform and try it out',
        choice: 'extension',
      },
      secondary: {
        label: 'Explore Memory Studio',
        description: 'Take a quick tour of your memory dashboard',
        choice: 'memory-studio',
      },
    },
  },
];

// Steps to show after user chooses "Explore Memory Studio" in extension flow
export const extensionMemoryStudioSteps: TourStep[] = [
  {
    id: 'sidebar',
    type: 'spotlight',
    title: 'Your Command Center',
    content: 'This sidebar is your home base. Pin favorite memories for quick access and track your getting started progress.',
    targetSelector: '[data-tour-id="left-sidebar"]',
    position: 'right',
    showSkip: true,
    showBack: false,
  },
  {
    id: 'create-memory',
    type: 'spotlight',
    title: 'Capture Everything',
    content: 'One click to create a new memory bucket. Drop in files, paste text, or add URLs - your AI will remember it all.',
    targetSelector: '[data-tour-id="create-memory-button"]',
    position: 'bottom',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'buckets-grid',
    type: 'spotlight',
    title: 'Organize Your Mind',
    content: 'Each bucket is a topic, project, or persona. Create one for Work, Personal, Research - whatever fits your life.',
    targetSelector: '[data-tour-id="buckets-container"]',
    position: 'center',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'mcp-cta-extension',
    type: 'spotlight',
    title: 'Connect Your Memory Everywhere',
    content: 'Use MCP servers to share your AI Memory with any compatible tool — Cursor, Windsurf, VS Code, Claude Desktop, ChatGPT, and more.',
    targetSelector: '[data-tour-id="mcp-connect-button"]',
    position: 'bottom',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'chat-preview',
    type: 'illustration',
    title: 'Talk to Your Memories',
    content: 'Open any bucket and chat with AI about everything inside. Ask questions, get summaries, find connections you missed.',
    position: 'center',
    showSkip: true,
    showBack: true,
  },
  {
    id: 'completion-extension',
    type: 'modal',
    title: "You're Ready to Go!",
    content: "Memory Studio is all yours. Your extension is synced and ready - click it anytime to save content from the web!",
    buttonText: 'Start Exploring',
    showSkip: false,
    showBack: true,
    confetti: true,
    position: 'center',
  },
];

// ============================================
// FLOW 3: Third-Party / Sync from AI Platforms
// Quick welcome and redirect back to the AI platform
// Used when user signs up via Sync button on ChatGPT, Claude, etc.
// ============================================
export const thirdPartySteps: TourStep[] = [
  {
    id: 'third-party-welcome',
    type: 'modal',
    title: 'Welcome aboard, {userName}!',
    content: "You can now use your universal AI Memory everywhere.",
    buttonText: 'Back to my chat',
    showSkip: false,
    showBack: false,
    position: 'center',
  },
];

// Alias for backward compatibility
export const saveContextSteps = thirdPartySteps;

// Helper function to get steps based on source
export const getStepsForSource = (source: OnboardingSource): TourStep[] => {
  switch (source) {
    case 'extension':
      return extensionLoginSteps;
    case 'third-party':
    case 'save-context':
      return thirdPartySteps;
    case 'direct':
    default:
      return directLoginSteps;
  }
};

// For backward compatibility
export const tourSteps = directLoginSteps;
export const getTotalSteps = () => tourSteps.length;
