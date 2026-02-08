import React from 'react'
import { connect } from 'react-redux'; 

import CounterAreasEditor from '../shared/CounterAreasEditor';
import CanvasEngine from '../canvas/CanvasEngine';

import { CANVAS_RENDERING_MODE } from '../../utils/constants';
import CounterAreasVisualizer from '../shared/CounterAreasVisualizer';
import BtnRecording from '../shared/BtnRecording';
import { restoreCountingAreas } from '../../statemanagement/app/CounterStateManagement';

class CounterView extends React.PureComponent {

  componentDidMount() {
    this.props.dispatch(restoreCountingAreas());
  }

  render () {
    return (
      <div>
        {!this.props.isRecording &&
          <>
            <CounterAreasEditor />
            <CanvasEngine mode={CANVAS_RENDERING_MODE.COUNTERVIEW} />
          </>
        }
        {this.props.isRecording && this.props.isAtLeastOneCountingAreasDefined &&
          <>
            <CounterAreasVisualizer />
            <CanvasEngine mode={CANVAS_RENDERING_MODE.COUNTERVIEW_RECORDING} />
          </>
        }
        {this.props.isRecording && !this.props.isAtLeastOneCountingAreasDefined &&
          <>
            <div className="modal">
              No counting areas are configured yet. Stop recording, add at least one line or
              polygon, then start recording again.
            </div>
          </>
        }
        <BtnRecording />
        <style jsx>{`
            .modal {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
            }
        `}</style>
      </div>
    )
  }
}

export default connect((state) => {

  return {
    isAtLeastOneCountingAreasDefined: state.counter.get('countingAreas').size > 0,
    isRecording: state.app.getIn(['recordingStatus','isRecording'])
  }
})(CounterView);
