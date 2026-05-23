import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { OnboardingSource, ForkChoice } from '../../components/onboarding/tourSteps';

type FlowType = 'direct' | 'extension' | 'extension-memory-studio' | 'save-context' | 'third-party';

export interface OnboardingState {
  tourCompleted: boolean;
  tourActive: boolean;
  currentStep: number;
  source: OnboardingSource;
  flowType: FlowType;
  forkChoice: ForkChoice | null;
}

const initialState: OnboardingState = {
  tourCompleted: false,
  tourActive: false,
  currentStep: 0,
  source: 'direct',
  flowType: 'direct',
  forkChoice: null,
};

const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState,
  reducers: {
    startTour: (state, action: PayloadAction<OnboardingSource | undefined>) => {
      const source = action.payload || 'direct';
      state.tourActive = true;
      state.currentStep = 0;
      state.source = source;
      state.flowType = source;
      state.forkChoice = null;
    },
    nextStep: (state) => {
      state.currentStep += 1;
    },
    prevStep: (state) => {
      if (state.currentStep > 0) {
        state.currentStep -= 1;
      }
    },
    goToStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    setForkChoice: (state, action: PayloadAction<ForkChoice>) => {
      state.forkChoice = action.payload;
      if (action.payload === 'memory-studio') {
        // Switch to memory studio tour steps
        state.flowType = 'extension-memory-studio';
        state.currentStep = 0;
      }
      // If 'extension' is chosen, the component will handle closing the tab
    },
    completeTour: (state) => {
      state.tourActive = false;
      state.tourCompleted = true;
      state.currentStep = 0;
    },
    skipTour: (state) => {
      state.tourActive = false;
      state.tourCompleted = true;
      state.currentStep = 0;
    },
    resetTour: (state) => {
      state.tourCompleted = false;
      state.tourActive = false;
      state.currentStep = 0;
      state.source = 'direct';
      state.flowType = 'direct';
      state.forkChoice = null;
    },
  },
});

export const {
  startTour,
  nextStep,
  prevStep,
  goToStep,
  setForkChoice,
  completeTour,
  skipTour,
  resetTour,
} = onboardingSlice.actions;

export default onboardingSlice.reducer;
