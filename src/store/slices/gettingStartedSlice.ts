import { createSlice } from '@reduxjs/toolkit';

export interface GettingStartedState {
  createdFirstBucket: boolean;
  addedContent: boolean;
  updatedContent: boolean;
  chattedWithMemory: boolean;
}

const initialState: GettingStartedState = {
  createdFirstBucket: false,
  addedContent: false,
  updatedContent: false,
  chattedWithMemory: false,
};

const gettingStartedSlice = createSlice({
  name: 'gettingStarted',
  initialState,
  reducers: {
    markBucketCreated: (state) => {
      state.createdFirstBucket = true;
    },
    markContentAdded: (state) => {
      state.addedContent = true;
    },
    markContentUpdated: (state) => {
      state.updatedContent = true;
    },
    markChatStarted: (state) => {
      state.chattedWithMemory = true;
    },
    resetGettingStarted: () => initialState,
  },
});

export const {
  markBucketCreated,
  markContentAdded,
  markContentUpdated,
  markChatStarted,
  resetGettingStarted,
} = gettingStartedSlice.actions;

export default gettingStartedSlice.reducer;
