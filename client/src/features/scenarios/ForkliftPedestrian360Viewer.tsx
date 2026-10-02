import { useEffect, useRef, useState } from 'react';
import { Viewer } from '@photo-sphere-viewer/core';
import {
  MarkersPlugin,
  type MarkerConfig,
} from '@photo-sphere-viewer/markers-plugin';

import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

// The supplied panorama currently lives with the Forklift training assets.
// Keep one source file rather than copying it into the scenario asset folder.
import forkliftPanorama from '../../assets/training/forklift-pedestrian-safety/forklift-pedestrian-training-360.png';

export const CALIBRATION_MODE = false;

interface PanoramaHazard {
  id: number;
  title: string;
  hotspotYaw: number;
  hotspotPitch: number;
  sequenceOrder: number;
  answeredCorrectly: boolean;
}

interface ForkliftPedestrian360ViewerProps {
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

function buildMarker(
  hazard: PanoramaHazard,
  activeHazardId: number | null,
): MarkerConfig {
  const classes = [
    'kists-360-hotspot',
    hazard.answeredCorrectly ? 'complete' : '',
    hazard.id === activeHazardId ? 'active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    id: markerId(hazard.id),
    position: {
      yaw: `${hazard.hotspotYaw}deg`,
      pitch: `${hazard.hotspotPitch}deg`,
    },
    html: `<span class="${classes}" aria-hidden="true"><span>${hazard.sequenceOrder}</span></span>`,
    size: { width: 56, height: 56 },
    anchor: 'center center',
    tooltip: `Safety point ${hazard.sequenceOrder}: ${hazard.title}`,
  };
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function normaliseYaw(degrees: number) {
  return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

export function ForkliftPedestrian360Viewer({
  hazards,
  activeHazardId,
  focusRequestKey,
  onSelectHazard,
}: ForkliftPedestrian360ViewerProps) {
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
    if (!container) return;

    let cancelled = false;
    const fail = (message: string) => {
      if (cancelled) return;
      setErrorMessage(message);
      setStatus('error');
    };

    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const ratio = image.naturalWidth / image.naturalHeight;
      if (!Number.isFinite(ratio) || Math.abs(ratio - 2) > 0.08) {
        fail('The Forklift panorama must be an equirectangular 2:1 image.');
        return;
      }

      setStatus('loading');
      try {
        const viewer = new Viewer({
          container,
          panorama: forkliftPanorama,
          caption:
            'KISTS Forklift and Pedestrian Safety 360° Warehouse Scenario',
          description:
            'Explore forklift and pedestrian safety in the warehouse.',
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

        if (!CALIBRATION_MODE) {
          markers.addEventListener('select-marker', (event) => {
            const hazardId = Number(event.marker.id.replace('hazard-', ''));
            if (Number.isInteger(hazardId)) {
              onSelectHazardRef.current(hazardId);
            }
          });
        }

        viewer.addEventListener('click', (event) => {
          if (!CALIBRATION_MODE) return;
          const point = {
            yaw:
              Math.round(normaliseYaw(toDegrees(event.data.yaw)) * 100) / 100,
            pitch: Math.round(toDegrees(event.data.pitch) * 100) / 100,
          };
          setCalibrationPoint(point);
          console.info(
            `[KISTS Forklift calibration] yaw: ${point.yaw.toFixed(2)}, pitch: ${point.pitch.toFixed(2)}`,
          );
        });

        viewer.addEventListener(
          'ready',
          () => {
            if (!cancelled) setStatus('ready');
          },
          { once: true },
        );
        viewer.addEventListener('panorama-error', () => {
          fail('The Forklift panorama could not be rendered.');
        });
      } catch (error) {
        const detail = error instanceof Error ? ` ${error.message}` : '';
        fail(`The 360° viewer could not start.${detail}`);
      }
    };
    image.onerror = () => {
      fail(
        'The Forklift panorama could not be loaded from the training assets.',
      );
    };
    image.src = forkliftPanorama;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
      markersRef.current = null;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };

    // The viewer is created once; the effects below sync marker state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (CALIBRATION_MODE) return;
    markersRef.current?.setMarkers(
      hazards.map((hazard) => buildMarker(hazard, activeHazardId)),
    );
  }, [hazards, activeHazardId]);

  useEffect(() => {
    if (CALIBRATION_MODE || activeHazardId === null) return;
    void markersRef.current?.gotoMarker(markerId(activeHazardId), '10rpm');
  }, [activeHazardId, focusRequestKey]);

  return (
    <div className="scenario-360-frame">
      <div className="scenario-360-stage">
        <div
          ref={containerRef}
          className="scenario-360-viewer"
          aria-label="Interactive 360 degree Forklift and Pedestrian Safety warehouse panorama"
        />
        {status !== 'ready' && (
          <div
            className={`scenario-360-status ${status === 'error' ? 'error' : ''}`}
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
        <section className="forklift-calibration-panel" aria-live="polite">
          <strong>Forklift calibration point</strong>
          <p>
            Rotate the panorama, then click the centre of each hazard. Record
            the yaw and pitch before moving to the next point.
          </p>
          <pre>
            {calibrationPoint
              ? `yaw: ${calibrationPoint.yaw.toFixed(2)}\npitch: ${calibrationPoint.pitch.toFixed(2)}`
              : 'Click the panorama to measure yaw and pitch.'}
          </pre>
        </section>
      )}

      <div className="scenario-360-help" aria-label="360 scene controls">
        <span>↔ Drag to rotate</span>
        <span>↕ Look up and down</span>
        <span>＋/− Zoom</span>
        <span>⛶ Full screen</span>
      </div>
      <p className="scenario-360-credit">
        360° environment: Forklift and Pedestrian Safety warehouse panorama.
      </p>
    </div>
  );
}
