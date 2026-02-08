import { fromJS } from 'immutable';

// Initial state
const initialState = fromJS({
  trackerData: {
    frameIndex: 0,
    data: [],
  },
});

// Actions
const UPDATE_DATA = 'Tracker/UPDATE_DATA';

export function getTrackerAccuracyNbFrameBuffer() {
  return window.CONFIG.TRACKER_ACCURACY_DISPLAY.nbFrameBuffer;
}

export function getTrackerAccuracySettings() {
  return window.CONFIG.TRACKER_ACCURACY_DISPLAY.settings;
}

export function getTrackerFrameMaxBackwardDrift() {
  const configuredValue = window.CONFIG && window.CONFIG.TRACKER_FRAME_MAX_BACKWARD_DRIFT;
  const parsed = Number.parseInt(configuredValue, 10);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return 2;
}

export function updateTrackerData(trackerDataLastFrame) {
  return (dispatch, getState) => {
    if (!trackerDataLastFrame || typeof trackerDataLastFrame !== 'object') {
      return;
    }

    const nextFrameIndex = Number.parseInt(trackerDataLastFrame.frameIndex, 10);
    if (!Number.isFinite(nextFrameIndex)) {
      return;
    }

    const currentFrameIndex = Number.parseInt(getState().tracker.getIn(['trackerData', 'frameIndex']), 10);
    const maxBackwardDrift = getTrackerFrameMaxBackwardDrift();
    if (Number.isFinite(currentFrameIndex)
      && nextFrameIndex < (currentFrameIndex - maxBackwardDrift)) {
      return;
    }

    // Update tracker raw data
    dispatch({
      type: UPDATE_DATA,
      payload: trackerDataLastFrame,
    });
  };
}

// Reducer
export default function TrackerReducer(state = initialState, action = {}) {
  switch (action.type) {
    case UPDATE_DATA:
      return state.set('trackerData', fromJS(action.payload));
    default:
      return state;
  }
}
