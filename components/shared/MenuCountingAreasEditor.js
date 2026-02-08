import React, { Component } from 'react';
import { connect } from 'react-redux';
import SVG from 'react-inlinesvg';

import {
  deleteCountingArea, setMode, EDITOR_MODE, restoreCountingAreasFromJSON,
} from '../../statemanagement/app/CounterStateManagement';

const LINE_TYPES = new Set(['bidirectional', 'leftright_topbottom', 'rightleft_bottomtop']);

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidPoint(point) {
  return point && typeof point === 'object'
    && isFiniteNumber(point.x)
    && isFiniteNumber(point.y);
}

function isValidResolution(resolution) {
  return resolution && typeof resolution === 'object'
    && isFiniteNumber(resolution.w)
    && isFiniteNumber(resolution.h)
    && resolution.w > 0
    && resolution.h > 0;
}

function validateImportedCountingAreas(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Counting areas file must contain an object keyed by area IDs.');
  }

  Object.keys(data).forEach((areaKey) => {
    const area = data[areaKey];
    if (area == null) {
      return;
    }

    if (!area.location || typeof area.location !== 'object') {
      throw new Error(`Area "${areaKey}" is missing location.`);
    }

    if (!Array.isArray(area.location.points)) {
      throw new Error(`Area "${areaKey}" location.points must be an array.`);
    }

    if (!isValidResolution(area.location.refResolution)) {
      throw new Error(`Area "${areaKey}" has an invalid location.refResolution.`);
    }

    area.location.points.forEach((point, index) => {
      if (!isValidPoint(point)) {
        throw new Error(`Area "${areaKey}" has invalid point at index ${index}.`);
      }
    });

    const areaType = area.type || 'bidirectional';
    if (LINE_TYPES.has(areaType) && area.location.points.length !== 2) {
      throw new Error(`Line area "${areaKey}" must contain exactly 2 points.`);
    }

    if (areaType === 'polygon') {
      if (area.location.points.length < 4) {
        throw new Error(`Polygon area "${areaKey}" must contain at least 4 points.`);
      }

      const first = area.location.points[0];
      const last = area.location.points[area.location.points.length - 1];
      if (first.x !== last.x || first.y !== last.y) {
        throw new Error(`Polygon area "${areaKey}" must be closed (first and last point must match).`);
      }
    }
  });
}

class MenuCountingAreasEditor extends Component {
  handleDelete() {
    if (this.props.countingAreas.size > 1) {
      this.props.dispatch(setMode(EDITOR_MODE.DELETE));
    } else {
      this.props.dispatch(deleteCountingArea(this.props.countingAreas.keySeq().first()));
    }
  }

  loadFile() {
    let input; let file; let
      fr;

    if (typeof window.FileReader !== 'function') {
      alert("The file API isn't supported on this browser yet.");
      return;
    }

    input = document.getElementById('upload');
    if (!input) {
      alert("Um, couldn't find the fileinput element.");
    } else if (!input.files) {
      alert("This browser doesn't seem to support the `files` property of file inputs.");
    } else if (!input.files[0]) {
      alert("Please select a file before clicking 'Load'");
    } else {
      file = input.files[0];
      fr = new FileReader();
      fr.onload = (e) => {
        try {
          const lines = e.target.result;
          const json = JSON.parse(lines);
          validateImportedCountingAreas(json);
          this.props.dispatch(restoreCountingAreasFromJSON(json));
        } catch (error) {
          alert(`Failed to import counting areas: ${error.message}`);
        }
      };
      fr.readAsText(file);
    }
  }

  render() {
    return (
      <div className="menu-active-areas flex fixed bottom-0 left-0 mb-2 ml-2">
        {this.props.mode !== EDITOR_MODE.DELETE
          && (
          <>
            <button
              className="btn btn-default p-0 rounded-l shadow"
              onClick={() => this.handleDelete()}
            >
              <SVG
                className="w-10 h-10 svg-icon flex items-center"
                cacheRequests
                src="/static/icons/ui/delete.svg"
                aria-label="icon delete"
              />
            </button>
            <button
              className={`btn btn-default p-0 shadow ${this.props.mode === EDITOR_MODE.EDIT_LINE ? 'btn-default--active' : ''}`}
              onClick={() => this.props.dispatch(setMode(EDITOR_MODE.EDIT_LINE))}
            >
              <SVG
                className="w-10 h-10 svg-icon flex items-center"
                cacheRequests
                src="/static/icons/ui/addline.svg"
                aria-label="icon addline"
              />
            </button>
            <button
              className={`btn btn-default p-0 shadow rounded-r ${this.props.mode === EDITOR_MODE.EDIT_POLYGON ? 'btn-default--active' : ''}`}
              onClick={() => this.props.dispatch(setMode(EDITOR_MODE.EDIT_POLYGON))}
            >
              <SVG
                className="w-10 h-10 svg-icon flex items-center"
                cacheRequests
                src="/static/icons/ui/addpolygon.svg"
                aria-label="icon addpolygon"
              />
            </button>
            <a
              href="/api/v2/counting/areas"
              target="_blank"
              download
              className="btn btn-default p-0 ml-4 rounded-l shadow"
            >
              <SVG
                className="w-10 h-10 svg-icon flex items-center"
                cacheRequests
                src="/static/icons/ui/download.svg"
                aria-label="icon download"
              />
            </a>
            <label
              htmlFor="upload"
              className="btn btn-default p-0 rounded-r shadow cursor-pointer	"
            >
              <SVG
                className="w-10 h-10 svg-icon flex items-center"
                cacheRequests
                src="/static/icons/ui/upload.svg"
                aria-label="icon upload"
              />
              <input type="file" id="upload" onChange={() => this.loadFile()} style={{ display: 'none' }} />
            </label>
          </>
          )}
        {this.props.mode === EDITOR_MODE.DELETE
          && (
          <button
            className="btn btn-default p-0 rounded shadow"
            onClick={() => this.props.dispatch(setMode(this.props.lastEditingMode))}
          >
            <SVG
              className="w-10 h-10 svg-icon flex items-center"
              cacheRequests
              src="/static/icons/ui/close.svg"
              aria-label="icon edit"
            />
          </button>
          )}
        <style jsx>
          {`
          .menu-active-areas {
            z-index: 8;
          }
        `}
        </style>
      </div>
    );
  }
}

export default connect((state) => ({
  countingAreas: state.counter.get('countingAreas'),
  selectedCountingArea: state.counter.get('selectedCountingArea'),
  mode: state.counter.get('mode'),
  lastEditingMode: state.counter.get('lastEditingMode'),
}))(MenuCountingAreasEditor);
