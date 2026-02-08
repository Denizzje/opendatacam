const { Tracker } = require('node-moving-things-tracker');
const cloneDeep = require('lodash.clonedeep');
const Opendatacam = require('../../server/Opendatacam');
const demoDetections = require('../../public/static/placeholder/alexeydetections30FPS.json');
const config = require('../../config.json');

describe('Opendatacam', () => {
  let dbSpy = null;

  beforeEach(() => {
    Opendatacam.setVideoResolution({ w: 1280, h: 720 });

    const testConfig = cloneDeep(config);
    testConfig.TRACKER_SETTINGS = {
      objectMaxAreaInPercentageOfFrame: 50,
      confidence_threshold: 0.5,
      iouLimit: 0.05,
      unMatchedFrameTolerance: 5,
      fastDelete: true,
      matchingAlgorithm: 'kdTree',
    };
    testConfig.COUNTER_SETTINGS = {
      countingAreaMinFramesInsideToBeCounted: 1,
      countingAreaVerifyIfObjectEntersCrossingOneEdge: false,
      minAngleWithCountingLineThreshold: 5,
      computeTrajectoryBasedOnNbOfPastFrame: 5,
    };
    // Keep fixture expectations stable regardless of repo-level default class set.
    testConfig.VALID_CLASSES = ['*'];
    Opendatacam.setConfig(testConfig);

    dbSpy = jasmine.createSpyObj('DbManager', [
      'connect',
      'disconnect',
      'isConnected',
      'persistAppSettings',
      'getAppSettings',
      'insertRecording',
      'getRecording',
      'deleteRecording',
      'updateRecordingWithNewframe',
      'getRecordings',
      'getRecordingsCount',
      'getTrackerHistoryOfRecording',
      'getCounterHistoryOfRecording',
    ]);
    dbSpy.insertRecording.and.resolveTo({ id: Math.random().toString() });
    dbSpy.getAppSettings.and.resolveTo(null);
    dbSpy.persistAppSettings.and.resolveTo();
    dbSpy.updateRecordingWithNewframe.and.resolveTo();
    Opendatacam.setDatabase(dbSpy);

    Tracker.reset();
    Tracker.setParams({
      iouLimit: 0.2,
      unMatchedFrameTolerance: 5,
      fastDelete: true,
    });
    Opendatacam.setTracker(Tracker);

    Opendatacam.isListeningToYOLO = true;
    Opendatacam.registerCountingAreas({
      'cc8354b6-d8ec-41d3-ab12-38ced6811f7c': {
        color: 'yellow',
        type: 'bidirectional',
        location: {
          points: [
            { x: 0, y: 360 },
            { x: 1280, y: 360 },
          ],
          refResolution: { w: 1280, h: 720 },
        },
        name: 'test',
      },
    });
  });

  describe('recording', () => {
    beforeEach(() => {
      Opendatacam.startRecording(false);
    });

    afterEach(() => {
      Opendatacam.stopRecording();
    });

    it('is Recording', () => {
      expect(Opendatacam.isRecording()).toBeTrue();
    });

    describe('counts demo cars', () => {
      const expectSummary = {
        'cc8354b6-d8ec-41d3-ab12-38ced6811f7c': {
          _total: 41, car: 41,
        },
      };

      beforeEach(() => {
        demoDetections.forEach((frame) => {
          Opendatacam.updateWithNewFrame(frame.objects, frame.frame_id);
        });
      });

      it('returns correct summary while counting', () => {
        expect(dbSpy.updateRecordingWithNewframe).toHaveBeenCalledTimes(demoDetections.length);
        expect(dbSpy.updateRecordingWithNewframe.calls.mostRecent().args[2]).toEqual(expectSummary);
        expect(Opendatacam.getCounterSummary()).toEqual(expectSummary);
      });

      it('does not change summary after recording stopped', () => {
        expect(dbSpy.updateRecordingWithNewframe).toHaveBeenCalledTimes(demoDetections.length);
        expect(dbSpy.updateRecordingWithNewframe.calls.mostRecent().args[2]).toEqual(expectSummary);

        Opendatacam.stopRecording();

        expect(dbSpy.updateRecordingWithNewframe).toHaveBeenCalledTimes(demoDetections.length);
        expect(dbSpy.updateRecordingWithNewframe.calls.mostRecent().args[2]).toEqual(expectSummary);
      });
    });
  });

  describe('video resolution updates', () => {
    it('does not query app settings again when resolution did not change', () => {
      dbSpy.getAppSettings.calls.reset();

      Opendatacam.setVideoResolution({ w: 1280, h: 720 });

      expect(dbSpy.getAppSettings).not.toHaveBeenCalled();
    });

    it('does not throw when restoring app settings fails', () => {
      dbSpy.getAppSettings.and.rejectWith(new Error('Not connected'));

      expect(() => {
        Opendatacam.setVideoResolution({ w: 640, h: 480 });
      }).not.toThrow();
    });

    it('recomputes counting areas when the resolution changes', () => {
      Opendatacam.registerCountingAreas({
        test: {
          color: 'yellow',
          type: 'bidirectional',
          location: {
            points: [
              { x: 10, y: 20 },
              { x: 90, y: 20 },
            ],
            refResolution: { w: 100, h: 100 },
          },
          name: 'test',
        },
      });

      Opendatacam.setVideoResolution({ w: 200, h: 100 });

      const countingArea = Opendatacam.getCountingAreas().test;
      expect(countingArea.computed.point1.x).toEqual(20);
      expect(countingArea.computed.point2.x).toEqual(180);
      expect(countingArea.computed.point1.y).toEqual(-20);
      expect(countingArea.computed.point2.y).toEqual(-20);
    });
  });

  describe('counting area registration', () => {
    it('does not throw when refResolution is missing', () => {
      expect(() => {
        Opendatacam.registerCountingAreas({
          test: {
            color: 'yellow',
            type: 'bidirectional',
            location: {
              points: [
                { x: 100, y: 100 },
                { x: 200, y: 100 },
              ],
            },
            name: 'test',
          },
        });
      }).not.toThrow();
    });

    it('resets stale counter summary when replacing counting areas', () => {
      Opendatacam.registerCountingAreas({
        oldArea: {
          color: 'yellow',
          type: 'bidirectional',
          location: {
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
            ],
            refResolution: { w: 1280, h: 720 },
          },
          name: 'oldArea',
        },
      });

      Opendatacam.registerCountingAreas({
        newArea: {
          color: 'yellow',
          type: 'bidirectional',
          location: {
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
            ],
            refResolution: { w: 1280, h: 720 },
          },
          name: 'newArea',
        },
      });

      expect(Opendatacam.getCounterSummary()).toEqual({
        newArea: {
          _total: 0,
        },
      });
    });
  });
});
