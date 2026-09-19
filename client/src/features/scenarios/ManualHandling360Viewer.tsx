import { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import {
  MarkersPlugin,
  type MarkerConfig,
} from '@photo-sphere-viewer/markers-plugin';

import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

import warehousePanorama from '../../assets/scenarios/manual-handling/manual-handling-training-360.png';

/*
 * TEMPORARY DEVELOPMENT TOOL
 *
 * true:
 * - hides the normal numbered safety-point markers
 * - lets us click directly on the panorama
 * - displays the yaw/pitch coordinates we need
 *
 * false:
 * - restores the normal trainee scenario
 * - displays the real numbered hotspots
 *
 * IMPORTANT:
 * Leave this TRUE while we calibrate the five new positions.
 * After all five coordinates are saved into the database/seed,
 * change it back to FALSE.
 */
const CALIBRATION_MODE = false;

const FINAL_HOTSPOT_POSITIONS: Record<
  number,
  {
    yaw: number;
    pitch: number;
  }
> = {
  1: {
    yaw: -15.9,
    pitch: -26.5,
  },
  2: {
    yaw: -93.2,
    pitch: -9.5,
  },
  3: {
    yaw: -152.8,
    pitch: -16.5,
  },
  4: {
    yaw: 76.7,
    pitch: -11.3,
  },
  5: {
    yaw: 151,
    pitch: 2.4,
  },
};

interface PanoramaHazard {
  id: number;
  title: string;
  hotspotYaw: number;
  hotspotPitch: number;
  sequenceOrder: number;
  answeredCorrectly: boolean;
}

interface ManualHandling360ViewerProps {
  hazards: PanoramaHazard[];
  activeHazardId: number | null;
  focusRequestKey: number;
  onSelectHazard: (hazardId: number) => void;
}

interface CalibrationPoint {
  yaw: number;
  pitch: number;
}

type ViewerStatus = 'checking' | 'loading' | 'ready' | 'error';

function markerId(hazardId: number) {
  return `hazard-${hazardId}`;
}

function hazardIdFromMarker(marker: string) {
  const value = Number(marker.replace('hazard-', ''));

  return Number.isInteger(value) ? value : null;
}

function radiansToDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function normaliseDegrees(degrees: number) {
  let result = degrees;

  while (result > 180) {
    result -= 360;
  }

  while (result < -180) {
    result += 360;
  }

  return result;
}

function buildMarker(
  hazard: PanoramaHazard,
  activeHazardId: number | null,
): MarkerConfig {
  const complete = hazard.answeredCorrectly;
  const active = hazard.id === activeHazardId;

  const calibratedPosition = FINAL_HOTSPOT_POSITIONS[hazard.sequenceOrder];

  const classes = [
    'kists-360-hotspot',
    complete ? 'complete' : '',
    active ? 'active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: markerId(hazard.id),

    position: {
      yaw: `${calibratedPosition?.yaw ?? hazard.hotspotYaw}deg`,
      pitch: `${calibratedPosition?.pitch ?? hazard.hotspotPitch}deg`,
    },

    html: `
      <span class="${classes}" aria-hidden="true">
        <span>${complete ? '✓' : hazard.sequenceOrder}</span>
      </span>
    `,

    size: {
      width: 56,
      height: 56,
    },

    anchor: 'center center',

    tooltip: `Safety point ${hazard.sequenceOrder}: ${hazard.title}`,
  };
}

export function ManualHandling360Viewer({
  hazards,
  activeHazardId,
  focusRequestKey,
  onSelectHazard,
}: ManualHandling360ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const viewerRef = useRef<Viewer | null>(null);
  const markersRef = useRef<MarkersPlugin | null>(null);

  const onSelectHazardRef = useRef(onSelectHazard);

  const [status, setStatus] = useState<ViewerStatus>('checking');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [calibrationPoint, setCalibrationPoint] =
    useState<CalibrationPoint | null>(null);

  useEffect(() => {
    onSelectHazardRef.current = onSelectHazard;
  }, [onSelectHazard]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;

    const fail = (message: string) => {
      if (cancelled) {
        return;
      }

      setErrorMessage(message);
      setStatus('error');
    };

    const image = new Image();

    image.onload = () => {
      if (cancelled) {
        return;
      }

      const ratio = image.naturalWidth / image.naturalHeight;

      /*
       * A normal equirectangular 360 panorama should be
       * approximately twice as wide as it is tall.
       */
      if (!Number.isFinite(ratio) || Math.abs(ratio - 2) > 0.08) {
        fail(
          `The warehouse panorama loaded as ${image.naturalWidth}×${image.naturalHeight}. ` +
            'A full equirectangular 360° panorama should be approximately 2:1.',
        );

        return;
      }

      setStatus('loading');

      try {
        const viewer = new Viewer({
          container,

          panorama: warehousePanorama,

          caption: 'KISTS Manual Handling 360° Warehouse Scenario',

          description:
            'Explore the warehouse in 360 degrees and inspect each Manual Handling safety situation.',

          defaultYaw: '0deg',
          defaultPitch: '-7deg',
          defaultZoomLvl: 38,

          minFov: 32,
          maxFov: 90,

          navbar: ['zoom', 'move', 'fullscreen'],

          keyboard: 'always',
          mousewheel: true,
          touchmoveTwoFingers: false,

          plugins: [
            MarkersPlugin.withConfig({
              /*
               * During calibration we deliberately hide the
               * existing markers because their coordinates belong
               * to the previous panorama.
               */
              markers: CALIBRATION_MODE
                ? []
                : hazards.map((hazard) => buildMarker(hazard, activeHazardId)),

              defaultHoverScale: {
                amount: 1.15,
                duration: 120,
                easing: 'ease-out',
              },

              gotoMarkerSpeed: '10rpm',
            }),
          ],
        });

        viewerRef.current = viewer;

        const markers = viewer.getPlugin<MarkersPlugin>(MarkersPlugin);

        markersRef.current = markers;

        /*
         * NORMAL TRAINEE MODE
         *
         * Clicking a numbered marker selects the relevant
         * safety point in the scenario.
         */
        if (!CALIBRATION_MODE) {
          markers.addEventListener('select-marker', (event) => {
            const hazardId = hazardIdFromMarker(event.marker.id);

            if (hazardId !== null) {
              onSelectHazardRef.current(hazardId);
            }
          });
        }

        /*
         * DEVELOPMENT CALIBRATION MODE
         *
         * Clicking anywhere in the panorama gives us the exact
         * yaw and pitch required for a hotspot.
         *
         * Photo Sphere Viewer supplies yaw/pitch in radians.
         * KISTS stores these values in degrees.
         */
        viewer.addEventListener('click', (event) => {
          if (!CALIBRATION_MODE) {
            return;
          }

          const yaw = normaliseDegrees(radiansToDegrees(event.data.yaw));

          const pitch = radiansToDegrees(event.data.pitch);

          const point: CalibrationPoint = {
            yaw: Math.round(yaw * 10) / 10,
            pitch: Math.round(pitch * 10) / 10,
          };

          setCalibrationPoint(point);

          console.log(
            `[KISTS calibration] yaw: ${point.yaw}, pitch: ${point.pitch}`,
          );
        });

        viewer.addEventListener(
          'ready',
          () => {
            if (!cancelled) {
              setStatus('ready');
            }
          },
          { once: true },
        );

        viewer.addEventListener('panorama-error', () => {
          fail(
            'The Manual Handling panorama was found, but the 360° viewer could not render it.',
          );
        });

        /*
         * In the normal scenario, selecting a safety point from
         * elsewhere in the UI rotates the camera toward it.
         */
        if (!CALIBRATION_MODE && activeHazardId !== null) {
          void markers.gotoMarker(markerId(activeHazardId), '10rpm');
        }
      } catch (error) {
        const detail = error instanceof Error ? ` ${error.message}` : '';

        fail(`The 360° viewer could not start.${detail}`);
      }
    };

    image.onerror = () => {
      fail(
        'KISTS could not decode manual-handling-training-360.png. ' +
          'Confirm that the image exists in client/src/assets/scenarios/manual-handling/.',
      );
    };

    image.src = warehousePanorama;

    return () => {
      cancelled = true;

      image.onload = null;
      image.onerror = null;

      markersRef.current = null;

      viewerRef.current?.destroy();
      viewerRef.current = null;
    };

    /*
     * The Photo Sphere Viewer is intentionally created once.
     * Marker state is synchronised in the effects below.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * Update marker appearance when:
   *
   * - a safety point becomes complete
   * - the active safety point changes
   *
   * This is disabled while calibrating.
   */
  useEffect(() => {
    const markers = markersRef.current;

    if (!markers || CALIBRATION_MODE) {
      return;
    }

    markers.setMarkers(
      hazards.map((hazard) => buildMarker(hazard, activeHazardId)),
    );
  }, [hazards, activeHazardId]);

  /*
   * When the application activates a safety point,
   * automatically rotate the camera toward that hotspot.
   */
  useEffect(() => {
    const markers = markersRef.current;

    if (!markers || CALIBRATION_MODE || activeHazardId === null) {
      return;
    }

    void markers.gotoMarker(markerId(activeHazardId), '10rpm');
  }, [activeHazardId, focusRequestKey]);

  return (
    <div className="scenario-360-frame">
      <div className="scenario-360-stage">
        <div
          ref={containerRef}
          className="scenario-360-viewer"
          aria-label="Interactive 360 degree warehouse panorama with Manual Handling safety points"
        />

        {status !== 'ready' && (
          <div
            className={`scenario-360-status ${
              status === 'error' ? 'error' : ''
            }`}
            role="status"
          >
            <strong>
              {status === 'error'
                ? '360° panorama could not load'
                : 'Preparing 360° warehouse…'}
            </strong>

            <span>
              {status === 'checking'
                ? 'Checking the panorama image…'
                : status === 'loading'
                  ? 'Loading the equirectangular scene…'
                  : errorMessage}
            </span>
          </div>
        )}
      </div>

      {CALIBRATION_MODE && (
        <div
          style={{
            marginTop: '12px',
            padding: '16px 18px',
            border: '2px dashed #6C5CE7',
            borderRadius: '12px',
            background: '#F5F3FF',
            color: '#1F2937',
          }}
        >
          <strong
            style={{
              display: 'block',
              marginBottom: '6px',
              color: '#5B4BD8',
            }}
          >
            Development calibration mode
          </strong>

          <div
            style={{
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            Rotate the warehouse and click directly on the worker, load or
            situation where the safety point should appear.
          </div>

          {calibrationPoint ? (
            <div
              style={{
                marginTop: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#FFFFFF',
                border: '1px solid #DDD6FE',
                fontFamily: 'Consolas, monospace',
                fontWeight: 700,
              }}
            >
              yaw: {calibrationPoint.yaw}
              {'  |  '}
              pitch: {calibrationPoint.pitch}
            </div>
          ) : (
            <div
              style={{
                marginTop: '10px',
                fontSize: '14px',
                color: '#6B7280',
              }}
            >
              No calibration point selected yet.
            </div>
          )}

          <div
            style={{
              marginTop: '12px',
              fontSize: '13px',
              lineHeight: 1.55,
              color: '#4B5563',
            }}
          >
            Record five positions:
            <br />
            1. Obstructed handling route
            <br />
            2. Unstable stacked load
            <br />
            3. Poor lifting posture
            <br />
            4. Handling equipment
            <br />
            5. Assistance / team lift
          </div>
        </div>
      )}

      <div className="scenario-360-help" aria-label="360 scene controls">
        <span>↔ Drag to rotate</span>
        <span>↕ Look up and down</span>
        <span>＋/− Zoom</span>
        <span>⛶ Full screen</span>
      </div>

      <p className="scenario-360-credit">
        360° environment: purpose-built Manual Handling warehouse panorama for
        the KISTS prototype. Interactive safety points and training decisions
        are provided by KISTS.
      </p>
    </div>
  );
}
